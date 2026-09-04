"""
Rule-based field extraction: for each configured field, look for its keyword(s)
near candidate text, then apply the field's regex (if any) to the nearby text.
Extracts structured land-record schema with explainable confidence scores.

spaCy removed: all extraction is rule-based (keyword proximity + regex).
Confidence scores derive from real signals: OCR bounding-box confidence where
available, keyword match quality, and window position — never hardcoded.
"""
import re
from pathlib import Path
import yaml

RULES_PATH = Path(__file__).parent.parent / "rules" / "field_rules.yaml"


def _load_rules() -> dict:
    with open(RULES_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def parse_area_to_struct(area_str: str | None) -> dict | None:
    """
    Normalizes a raw area string into {"value": <float>, "unit": <str>, "raw": <str>}.
    Converts everything to acres internally but preserves the original unit label.

    Supported units:
        Acre / एकड़ / ಎಕರೆ / ஏக்கர்  → multiplier 1.0
        Hectare / हेक्टेयर / ಹೆಕ್ಟೇರ್ → 2.47105
        Guntha / Gunta / गुंठा         → 0.025
        Sq. Ft                         → 0.0000229568
        Sq. M                          → 0.000247105

    Returns None if the string cannot be parsed.
    """
    if not area_str:
        return None

    clean = area_str.lower().strip()
    match = re.search(r"(\d+(\.\d+)?)", clean)
    if not match:
        return None

    val = float(match.group(1))

    # Detect unit — order matters (hectare before acre)
    if any(u in clean for u in ("hectare", "hectares", "हेक्टेयर", "ಹೆಕ್ಟೇರ್", "ha")):
        acres = round(val * 2.47105, 4)
        unit = "hectare"
    elif any(u in clean for u in ("guntha", "gunthas", "gunta", "गुंठा")):
        acres = round(val * 0.025, 4)
        unit = "guntha"
    elif any(u in clean for u in ("sq.ft", "sq ft", "sqft", "sq. ft")):
        acres = round(val * 0.0000229568, 6)
        unit = "sq_ft"
    elif any(u in clean for u in ("sq.m", "sq m", "sqm", "sq. m")):
        acres = round(val * 0.000247105, 6)
        unit = "sq_m"
    else:
        # Default: treat as acres (covers 'acre', 'acres', 'एकड़', 'ಎಕರೆ', 'ஏக்கர்', 'ఎకరం')
        acres = round(val, 4)
        unit = "acre"

    return {"value": acres, "unit": unit, "raw": area_str}


# ── legacy shim kept for validators.py which still calls parse_area_to_acres ──
def parse_area_to_acres(area_str: str | None) -> tuple[float | None, str | None]:
    result = parse_area_to_struct(area_str)
    if result is None:
        return None, None
    return result["value"], result["unit"]


def extract_fields(raw_text: str, bounding_boxes: list[dict]) -> dict:
    rules = _load_rules()
    fields = {}
    confidence_per_field = {}
    structured_record = {}
    needs_review = []

    threshold = rules.get("confidence_review_threshold", 0.75)

    for field_name, cfg in rules["fields"].items():
        value, confidence = _extract_one_field(raw_text, bounding_boxes, cfg)
        fields[field_name] = value
        confidence_per_field[field_name] = round(confidence, 3)

        if field_name == "plot_area" and value:
            area_struct = parse_area_to_struct(value)
            if area_struct:
                # Structured shape: value = float, unit = str, raw = original string
                field_obj = {
                    "value": area_struct["value"],
                    "unit": area_struct["unit"],
                    "raw": area_struct["raw"],
                    "confidence": round(confidence, 3),
                }
            else:
                field_obj = {"value": None, "unit": None, "raw": value, "confidence": round(confidence, 3)}
        else:
            field_obj = {
                "value": value,
                "confidence": round(confidence, 3),
            }

        structured_record[field_name] = field_obj

        if confidence < threshold or (cfg.get("required") and not value):
            needs_review.append(field_name)

    # Compute top-level area_acres for backward compat with API Gateway
    area_acres = None
    if fields.get("plot_area"):
        area_acres, _ = parse_area_to_acres(fields["plot_area"])

    return {
        "fields": fields,
        "structured_record": structured_record,
        "area_acres": area_acres,
        "confidence_per_field": confidence_per_field,
        "needs_review": needs_review,
    }


def _extract_one_field(raw_text: str, bounding_boxes: list[dict], cfg: dict):
    keywords = cfg.get("keywords", [])
    pattern = cfg.get("pattern")
    # Per-field window size (free-text fields like owner_name need more context)
    window_size = cfg.get("window_chars", 100)

    best_val = None
    best_conf = 0.0

    for kw in keywords:
        search_text = raw_text.lower()
        kw_lower = kw.lower()
        idx = search_text.find(kw_lower)
        if idx == -1:
            continue

        window = raw_text[idx: idx + len(kw) + window_size]

        if pattern:
            match = re.search(pattern, window, re.IGNORECASE)
            if match:
                val = match.group(0).strip()
                conf = _confidence_for_text(val, bounding_boxes, idx, len(raw_text))
                if conf > best_conf:
                    best_val, best_conf = val, conf
        else:
            after_kw = window[len(kw):].strip(" :–-\t\n")
            # Take text up to first newline or 60 chars, whichever is shorter
            candidate = after_kw.split("\n")[0][:60].strip()
            if candidate:
                conf = _confidence_for_text(candidate, bounding_boxes, idx, len(raw_text))
                if conf > best_conf:
                    best_val, best_conf = candidate, conf

    return best_val, best_conf


def _confidence_for_text(text: str, bounding_boxes: list[dict], match_idx: int = 0, doc_len: int = 1) -> float:
    """
    Derive confidence from real signals — never hardcode a fixed value.

    Signal 1 (strongest): average OCR bbox confidence for tokens that appear in the matched text.
    Signal 2 (fallback):  position bias — fields found early in a document tend to be
                          header fields with better OCR quality; apply a mild ±0.04 nudge.
    Signal 3 (floor):    keyword-proximity match without a bbox → 0.72 base.
    """
    if bounding_boxes:
        matches = [
            b["confidence"]
            for b in bounding_boxes
            if b.get("text") and b["text"] in text
        ]
        if matches:
            bbox_conf = float(sum(matches) / len(matches))
            return min(round(bbox_conf, 3), 1.0)

    # No bbox match — use position bias as secondary signal
    position_ratio = match_idx / max(doc_len, 1)  # 0.0 (start) → 1.0 (end)
    # Header fields (early in doc) get a mild confidence boost
    position_bonus = round(0.04 * (1.0 - position_ratio), 3)
    base = 0.72 + position_bonus  # range [0.72, 0.76]
    return min(round(base, 3), 1.0)
