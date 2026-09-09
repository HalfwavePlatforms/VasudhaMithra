"""
Tier-2 LLM Structured Field Extraction Fallback.

Extracts standard land-record schema directly from raw OCR text using an LLM
(Gemini, Anthropic, or mock test provider) when rule-based extraction cannot
confidently handle a document.

Safeguards:
- Strict JSON schema enforcement for 12 target fields.
- Cost / budget limiter: LLM_EXTRACTION_MAX_CALLS (default 100).
- Provider-agnostic: LLM_PROVIDER ('gemini' | 'anthropic' | 'none', default 'none').
- Fail-safe: Network / API / JSON errors never crash the request.
"""
import os
import json
import logging
import re
from typing import Optional

import httpx

logger = logging.getLogger("extraction-engine.llm_extractor")

SCHEMA_FIELDS = [
    "survey_number",
    "khasra_number",
    "khata_number",
    "owner_name",
    "plot_area",
    "village",
    "tehsil",
    "district",
    "land_classification",
    "mutation_number",
    "registration_info",
    "ownership_type",
]

EXTRACTION_SYSTEM_PROMPT = """Extract ONLY the following fields from this raw OCR text, which may be in any Indian language or script. Return ONLY valid JSON matching this exact schema. If a field is not present in the text, return null for it. NEVER guess or infer a value that isn't explicitly present in the text.

Schema:
{
  "survey_number": null,
  "khasra_number": null,
  "khata_number": null,
  "owner_name": null,
  "plot_area": null,
  "village": null,
  "tehsil": null,
  "district": null,
  "land_classification": null,
  "mutation_number": null,
  "registration_info": null,
  "ownership_type": null
}"""

# In-memory session counter for budget safeguarding
_llm_calls = 0


def get_llm_call_count() -> int:
    global _llm_calls
    return _llm_calls


def reset_llm_call_count() -> None:
    global _llm_calls
    _llm_calls = 0


def is_llm_enabled() -> bool:
    provider = os.getenv("LLM_PROVIDER", "none").lower().strip()
    return provider in ("gemini", "anthropic", "mock")


def get_max_calls() -> int:
    try:
        return int(os.getenv("LLM_EXTRACTION_MAX_CALLS", "100"))
    except ValueError:
        return 100


def clean_json_response(raw_resp: str) -> Optional[dict]:
    """
    Cleans markdown formatting and parses JSON object.
    Ensures that only expected fields are returned with string or None values.
    """
    if not raw_resp or not raw_resp.strip():
        return None

    cleaned = raw_resp.strip()
    # Strip markdown code fences if present
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        cleaned = cleaned.strip()

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        # Try finding JSON block inside braces
        m = re.search(r"(\{.*\})", cleaned, re.DOTALL)
        if m:
            try:
                data = json.loads(m.group(1))
            except json.JSONDecodeError:
                return None
        else:
            return None

    if not isinstance(data, dict):
        return None

    validated = {}
    for f in SCHEMA_FIELDS:
        val = data.get(f)
        if val is None:
            validated[f] = None
        else:
            val_str = str(val).strip()
            # Normalize empty strings or stringified nulls to None
            if val_str.lower() in ("", "null", "none", "n/a", "nil", "not specified", "not present"):
                validated[f] = None
            else:
                validated[f] = val_str

    return validated


def _call_gemini(raw_text: str) -> Optional[str]:
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_VISION_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        logger.warning("Gemini LLM extraction requested but GEMINI_API_KEY is not configured.")
        return None

    model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": f"{EXTRACTION_SYSTEM_PROMPT}\n\nRAW OCR TEXT:\n\"\"\"\n{raw_text}\n\"\"\""
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json",
        },
    }

    try:
        resp = httpx.post(url, json=payload, timeout=25.0)
        if resp.status_code != 200:
            logger.error("Gemini API error (%s): %s", resp.status_code, resp.text[:300])
            return None
        resp_json = resp.json()
        candidates = resp_json.get("candidates", [])
        if not candidates:
            return None
        parts = candidates[0].get("content", {}).get("parts", [])
        if parts:
            return parts[0].get("text", "")
    except Exception as e:
        logger.error("Gemini LLM call failed: %s", e)
        return None

    return None


def _call_anthropic(raw_text: str) -> Optional[str]:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        logger.warning("Anthropic LLM extraction requested but ANTHROPIC_API_KEY is not configured.")
        return None

    model = os.getenv("ANTHROPIC_MODEL", "claude-3-5-haiku-20241022")

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model=model,
            max_tokens=1024,
            temperature=0.1,
            system=EXTRACTION_SYSTEM_PROMPT,
            messages=[
                {"role": "user", "content": f"RAW OCR TEXT:\n\"\"\"\n{raw_text}\n\"\"\""}
            ],
        )
        if message and message.content:
            return message.content[0].text
    except Exception as e:
        logger.error("Anthropic LLM call failed: %s", e)
        return None

    return None


def _call_ollama(raw_text: str) -> Optional[str]:
    """
    100% Free, offline local LLM extraction using Ollama or OpenAI-compatible local endpoints.
    Supported models: qwen2.5:3b, llama3.2:3b, mistral, gemma2:2b.
    """
    base_url = (os.getenv("OLLAMA_BASE_URL") or os.getenv("LOCAL_LLM_URL") or "http://localhost:11434").rstrip("/")
    model = os.getenv("OLLAMA_MODEL") or os.getenv("LOCAL_LLM_MODEL", "qwen2.5:3b")

    prompt = f"{EXTRACTION_SYSTEM_PROMPT}\n\nRAW OCR TEXT:\n\"\"\"\n{raw_text}\n\"\"\""

    # 1. Native Ollama API with format="json"
    try:
        url = f"{base_url}/api/generate"
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {"temperature": 0.1},
        }
        resp = httpx.post(url, json=payload, timeout=25.0)
        if resp.status_code == 200:
            return resp.json().get("response", "")
    except Exception as e:
        logger.debug("Ollama native endpoint failed (%s). Trying local OpenAI endpoint...", e)

    # 2. Local OpenAI-compatible endpoint (vLLM, LMStudio, LocalAI)
    try:
        v1_url = f"{base_url}/v1/chat/completions"
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
                {"role": "user", "content": f"RAW OCR TEXT:\n\"\"\"\n{raw_text}\n\"\"\""},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1,
        }
        resp = httpx.post(v1_url, json=payload, timeout=25.0)
        if resp.status_code == 200:
            choices = resp.json().get("choices", [])
            if choices:
                return choices[0].get("message", {}).get("content", "")
    except Exception as e:
        logger.debug("Local OpenAI-compatible LLM call failed: %s", e)

    return None


def extract_fields_llm(raw_text: str, mock_data: Optional[dict] = None) -> tuple[Optional[dict], Optional[str]]:
    """
    Executes Tier-2 LLM extraction against raw OCR text.

    Returns:
        (extracted_fields_dict, status_note)
        status_note can be:
          - "ai_extracted": LLM successfully returned structured fields
          - "ai_extraction_budget_reached": budget safeguard triggered
          - "llm_provider_disabled": provider set to none
          - "llm_extraction_failed": API call or schema parsing failed
    """
    global _llm_calls

    provider = os.getenv("LLM_PROVIDER", "none").lower().strip()
    if provider == "none" and not mock_data:
        return None, "llm_provider_disabled"

    max_calls = get_max_calls()
    if _llm_calls >= max_calls:
        logger.warning("LLM extraction skipped: session budget reached (%d/%d calls)", _llm_calls, max_calls)
        return None, "ai_extraction_budget_reached"

    # Increment budget counter
    _llm_calls += 1
    logger.info("Triggering Tier-2 LLM extraction (call %d/%d, provider='%s')", _llm_calls, max_calls, provider)

    if mock_data is not None:
        validated = clean_json_response(json.dumps(mock_data))
        return validated, "ai_extracted"

    if provider == "mock":
        # Built-in heuristic mock for offline test verification
        mock_res = {f: None for f in SCHEMA_FIELDS}
        # Simple extraction heuristics for test verification
        m_survey = re.search(r"(\d+/\d+[A-Za-z]?)", raw_text)
        if m_survey:
            mock_res["survey_number"] = m_survey.group(1)
        m_area = re.search(r"(\d+(\.\d+)?\s*(?:acre|acres|hectare|guntha|एकड़|हेक्टेयर))", raw_text, re.I)
        if m_area:
            mock_res["plot_area"] = m_area.group(1)
        return mock_res, "ai_extracted"

    raw_response_text = None
    if provider in ("ollama", "local", "local_ai"):
        raw_response_text = _call_ollama(raw_text)
    elif provider == "gemini":
        raw_response_text = _call_gemini(raw_text)
        # Automatic fallback to local Ollama if cloud key is missing or quota exhausted
        if not raw_response_text:
            logger.info("Cloud Gemini extraction unavailable, falling back to local Ollama engine...")
            raw_response_text = _call_ollama(raw_text)
    elif provider == "anthropic":
        raw_response_text = _call_anthropic(raw_text)
        if not raw_response_text:
            logger.info("Anthropic extraction unavailable, falling back to local Ollama engine...")
            raw_response_text = _call_ollama(raw_text)
    else:
        logger.warning("Unknown LLM provider: '%s'", provider)
        return None, "llm_extraction_failed"

    if not raw_response_text:
        return None, "llm_extraction_failed"

    parsed = clean_json_response(raw_response_text)
    if not parsed:
        logger.warning("Failed to parse valid JSON schema from LLM response")
        return None, "llm_extraction_failed"

    return parsed, "ai_extracted"
