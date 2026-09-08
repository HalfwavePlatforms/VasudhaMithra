"""
Extraction Engine service.
Owns: turning raw OCR text into structured fields, plus rule-based validation.
Contract: see docs/api-contracts.md — section 2.
"""
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional

import logging
import os
from field_extractor import extract_fields, _load_rules, parse_area_to_struct, parse_area_to_acres
from llm_extractor import extract_fields_llm, SCHEMA_FIELDS, is_llm_enabled
from validators import validate_fields

logger = logging.getLogger("extraction-engine.main")
app = FastAPI(title="Extraction Engine")


class BoundingBox(BaseModel):
    text: str
    confidence: float
    box: list[float]


class ParseRequest(BaseModel):
    raw_text: str
    bounding_boxes: list[BoundingBox] = []
    document_type: Optional[str] = None
    language: Optional[str] = None
    classification_confidence: Optional[float] = None
    mock_llm_data: Optional[dict] = None


class ValidateRequest(BaseModel):
    record_id: str
    fields: dict[str, str | None]
    confidence_per_field: dict[str, float] = {}
    # Optional: GIS cadastral area in acres, from GET /gis/parcel/{survey_number}.
    # When provided, triggers area discrepancy consistency check (the WOW feature).
    gis_area_acres: Optional[float] = None


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/extraction/parse")
def parse(req: ParseRequest):
    boxes = [b.model_dump() for b in req.bounding_boxes]
    result = extract_fields(
        raw_text=req.raw_text,
        bounding_boxes=boxes,
        document_type=req.document_type,
        classification_confidence=req.classification_confidence,
        mock_llm_data=req.mock_llm_data,
        language=req.language,
    )

    # STEP 2 & 3: Fallback branch for overall low confidence documents
    # Reuse threshold constant from field_rules.yaml (confidence_review_threshold)
    rules = _load_rules()
    review_threshold = rules.get("confidence_review_threshold", 0.75)

    # Compute overall document confidence from rule-based extraction
    conf_values = [
        c for c in result.get("confidence_per_field", {}).values()
        if c is not None and isinstance(c, (int, float))
    ]
    overall_confidence = (sum(conf_values) / len(conf_values)) if conf_values else 0.0

    # If document confidence is below threshold and LLM is enabled (or mock data provided)
    # and AI fallback was not already triggered for this document
    provider = os.getenv("LLM_PROVIDER", "none").lower().strip()
    llm_active = (provider != "none" and is_llm_enabled()) or (req.mock_llm_data is not None)

    if overall_confidence < review_threshold and llm_active and not result.get("ai_fallback_triggered"):
        llm_fields, status_note = extract_fields_llm(req.raw_text, mock_data=req.mock_llm_data)
        if llm_fields:
            fields = result.get("fields", {})
            confidence_per_field = result.get("confidence_per_field", {})
            extraction_sources = result.get("extraction_sources", {})
            needs_review = result.get("needs_review", [])
            structured_record = result.get("structured_record", {})

            for fn in SCHEMA_FIELDS:
                llm_val = llm_fields.get(fn)
                if not llm_val:
                    continue

                curr_val = fields.get(fn)
                curr_conf = confidence_per_field.get(fn)

                # Merge without overwriting fields the rule-based extractor was already confident about (>= review_threshold)
                rule_is_confident = (curr_val is not None and curr_conf is not None and curr_conf >= review_threshold)
                if not rule_is_confident:
                    fields[fn] = llm_val
                    extraction_sources[fn] = "llm"
                    confidence_per_field[fn] = None  # AI-extracted fields do not get artificial numeric confidence
                    result["has_ai_assisted"] = True
                    result["ai_fallback_triggered"] = True
                    if fn not in needs_review:
                        needs_review.append(fn)

                    logger.info("Field '%s' produced by path: LLM fallback (value='%s')", fn, llm_val)

                    if fn == "plot_area":
                        area_struct = parse_area_to_struct(llm_val)
                        if area_struct:
                            structured_record[fn] = {
                                "value": area_struct["value"],
                                "unit": area_struct["unit"],
                                "raw": area_struct["raw"],
                                "confidence": None,
                                "extraction_source": "llm",
                            }
                        else:
                            structured_record[fn] = {
                                "value": None,
                                "unit": None,
                                "raw": llm_val,
                                "confidence": None,
                                "extraction_source": "llm",
                            }
                    else:
                        structured_record[fn] = {
                            "value": llm_val,
                            "confidence": None,
                            "extraction_source": "llm",
                        }
                else:
                    logger.info("Field '%s' retained from path: rule-based (confidence=%.3f)", fn, curr_conf)

            # Recompute top-level area_acres if plot_area changed
            if fields.get("plot_area"):
                acres, _ = parse_area_to_acres(fields["plot_area"])
                result["area_acres"] = acres

            result["fields"] = fields
            result["confidence_per_field"] = confidence_per_field
            result["extraction_sources"] = extraction_sources
            result["needs_review"] = needs_review
            result["structured_record"] = structured_record

    # Log provenance for each field
    for fn, src in result.get("extraction_sources", {}).items():
        logger.debug("Final extraction path for field '%s': %s", fn, src)

    # Ensure extraction_source per field is explicitly mapped ("rules" | "llm")
    api_sources = {}
    for fn, src in result.get("extraction_sources", {}).items():
        api_sources[fn] = "llm" if src in ("ai_assisted", "llm") else "rules"
    result["extraction_source"] = api_sources

    return result



@app.post("/extraction/validate")
def validate(req: ValidateRequest):
    return validate_fields(
        fields=req.fields,
        record_id=req.record_id,
        confidence_per_field=req.confidence_per_field,
        duplicate_lookup=None,
        gis_area_acres=req.gis_area_acres,
    )
