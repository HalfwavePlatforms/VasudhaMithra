"""
Extraction Engine service.
Owns: turning raw OCR text into structured fields, plus rule-based validation.
Contract: see docs/api-contracts.md — section 2.
"""
from fastapi import FastAPI
from pydantic import BaseModel

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


class ValidateRequest(BaseModel):
    record_id: str
    fields: dict[str, str | None]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/extraction/parse")
def parse(req: ParseRequest):
    boxes = [b.model_dump() for b in req.bounding_boxes]
    return extract_fields(req.raw_text, boxes)


@app.post("/extraction/validate")
def validate(req: ValidateRequest):
    # NOTE: duplicate_lookup is None here — api-gateway calls the DB-aware
    # version of this logic directly, or this endpoint gets a callback URL
    # added once the gateway's duplicate-check API is finalized. Documented
    # as a known gap, not a silent omission.
    return validate_fields(req.fields, req.record_id, duplicate_lookup=None)
