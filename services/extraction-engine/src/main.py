"""
Extraction Engine service.
Owns: turning raw OCR text into structured fields, plus rule-based validation.
Contract: see docs/api-contracts.md — section 2.
"""
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional

from field_extractor import extract_fields
from validators import validate_fields

app = FastAPI(title="Extraction Engine")


class BoundingBox(BaseModel):
    text: str
    confidence: float
    box: list[float]


class ParseRequest(BaseModel):
    raw_text: str
    bounding_boxes: list[BoundingBox] = []
    document_type: Optional[str] = None


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
    if req.document_type == "legacy_tabular_register":
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
                "land_classification": None,
                "mutation_number": None,
                "registration_info": None,
                "ownership_type": None,
            },
            "structured_record": {},
            "area_acres": None,
            "confidence_per_field": {
                "survey_number": None,
                "khasra_number": None,
                "khata_number": None,
                "owner_name": None,
                "plot_area": None,
                "village": None,
                "tehsil": None,
                "district": None,
                "land_classification": None,
                "mutation_number": None,
                "registration_info": None,
                "ownership_type": None,
            },
            "needs_review": ["all_fields_legacy_tabular_format"],
            "triage_reason": "Legacy tabular format detected — automated field extraction not yet supported, routed for manual transcription.",
        }
    boxes = [b.model_dump() for b in req.bounding_boxes]
    return extract_fields(req.raw_text, boxes)


@app.post("/extraction/validate")
def validate(req: ValidateRequest):
    return validate_fields(
        fields=req.fields,
        record_id=req.record_id,
        confidence_per_field=req.confidence_per_field,
        duplicate_lookup=None,
        gis_area_acres=req.gis_area_acres,
    )
