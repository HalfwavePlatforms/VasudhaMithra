import os
import logging
from typing import Optional

from .field_extractor import extract_fields, _load_rules, parse_area_to_struct, parse_area_to_acres
from .llm_extractor import extract_fields_llm, SCHEMA_FIELDS, is_llm_enabled
from .validators import validate_fields

logger = logging.getLogger("embedded_extraction")


def parse_extraction(
    raw_text: str,
    bounding_boxes: list = None,
    document_type: Optional[str] = None,
    language: Optional[str] = None,
    classification_confidence: Optional[float] = None,
    mock_llm_data: Optional[dict] = None,
) -> dict:
    """
    In-process field extraction: turns raw OCR text into structured land-record fields.
    Matches the Extraction Engine contract (ParseResponse).
    """
    try:
        boxes = bounding_boxes or []
        result = extract_fields(
            raw_text=raw_text,
            bounding_boxes=boxes,
            document_type=document_type,
            classification_confidence=classification_confidence,
            mock_llm_data=mock_llm_data,
            language=language,
        )

        # Fallback branch for overall low confidence documents
        rules = _load_rules()
        review_threshold = rules.get("confidence_review_threshold", 0.75)

        conf_values = [
            c for c in result.get("confidence_per_field", {}).values()
            if c is not None and isinstance(c, (int, float))
        ]
        overall_confidence = (sum(conf_values) / len(conf_values)) if conf_values else 0.0

        provider = os.getenv("LLM_PROVIDER", "none").lower().strip()
        gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_VISION_API_KEY")
        llm_active = ((provider != "none" or gemini_key) and is_llm_enabled()) or (mock_llm_data is not None)

        if overall_confidence < review_threshold and llm_active and not result.get("ai_fallback_triggered"):
            llm_fields, status_note = extract_fields_llm(raw_text, mock_data=mock_llm_data)
            if llm_fields:
                fields = result.get("fields", {})
                confidence_per_field = result.get("confidence_per_field", {})
                extraction_sources = result.get("extraction_sources", {})

                for fn in SCHEMA_FIELDS:
                    llm_val = llm_fields.get(fn)
                    if not llm_val:
                        continue

                    curr_val = fields.get(fn)
                    curr_conf = confidence_per_field.get(fn)

                    rule_is_confident = (
                        curr_val is not None and curr_conf is not None and curr_conf >= review_threshold
                    )
                    if not rule_is_confident:
                        fields[fn] = llm_val
                        extraction_sources[fn] = "llm"

        return result
    except Exception as e:
        logger.error(f"Embedded extraction error: {e}", exc_info=True)
        # Resilient fallback so upload pipeline never returns 502
        return {
            "fields": {
                "survey_number": None,
                "khasra_number": None,
                "khata_number": None,
                "owner_name": None,
                "plot_area": None,
                "village": None,
                "tehsil": None,
                "district": None,
                "land_classification": "Agricultural",
            },
            "confidence_per_field": {},
            "extraction_sources": {},
            "needs_review": ["manual_verification_recommended"],
        }
