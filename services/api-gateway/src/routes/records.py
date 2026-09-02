import base64
import os
import uuid

import httpx
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session

from database import get_db
from models.db_models import Record, RecordField, ValidationResult, AuditLog

from dotenv import load_dotenv

load_dotenv()
router = APIRouter(prefix="/records", tags=["records"])

OCR_SERVICE_URL = os.getenv("OCR_SERVICE_URL", "http://127.0.0.1:8001")
EXTRACTION_SERVICE_URL = os.getenv("EXTRACTION_SERVICE_URL", "http://127.0.0.1:8002")


@router.post("/upload")
async def upload_record(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    image_b64 = base64.b64encode(content).decode("utf-8")

    record = Record(original_filename=file.filename, status="processing")
    db.add(record)
    db.commit()
    db.refresh(record)
    _log(db, record.id, "uploaded", details={"filename": file.filename})

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            ocr_resp = await client.post(
                f"{OCR_SERVICE_URL}/ocr/extract",
                json={"image_base64": image_b64, "language_hint": "hi"},
            )
            ocr_resp.raise_for_status()
            ocr_data = ocr_resp.json()
        except httpx.HTTPError as e:
            record.status = "rejected"
            db.commit()
            raise HTTPException(status_code=502, detail=f"OCR service failed: {e}")

    record.raw_ocr_text = ocr_data["raw_text"]
    record.ocr_confidence = ocr_data["confidence"]
    db.commit()
    _log(db, record.id, "ocr_completed", details={"confidence": ocr_data["confidence"]})

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            extract_resp = await client.post(
                f"{EXTRACTION_SERVICE_URL}/extraction/parse",
                json={"raw_text": ocr_data["raw_text"], "bounding_boxes": ocr_data["bounding_boxes"]},
            )
            extract_resp.raise_for_status()
            extraction_data = extract_resp.json()
        except httpx.HTTPError as e:
            record.status = "rejected"
            db.commit()
            raise HTTPException(status_code=502, detail=f"Extraction service failed: {e}")

    for field_name, value in extraction_data["fields"].items():
        db.add(
            RecordField(
                record_id=record.id,
                field_name=field_name,
                field_value=value,
                confidence=extraction_data["confidence_per_field"].get(field_name, 0.0),
            )
        )

    violations = _validate_and_check_duplicates(db, record.id, extraction_data["fields"])
    for v in violations:
        db.add(ValidationResult(record_id=record.id, field_name=v["field"], rule=v["rule"], passed=False, message=v["message"]))

    record.status = "pending_review" if (extraction_data["needs_review"] or violations) else "validated"
    db.commit()
    _log(db, record.id, "extracted", details={"needs_review": extraction_data["needs_review"]})

    return {"record_id": str(record.id), "status": record.status}


@router.get("/{record_id}")
def get_record(record_id: uuid.UUID, db: Session = Depends(get_db)):
    record = db.query(Record).filter(Record.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return _serialize(record)


@router.get("")
def list_records(status: str | None = None, page: int = 1, limit: int = 20, db: Session = Depends(get_db)):
    query = db.query(Record)
    if status:
        query = query.filter(Record.status == status)
    total = query.count()
    records = query.offset((page - 1) * limit).limit(limit).all()
    return {"total": total, "page": page, "limit": limit, "records": [_serialize(r) for r in records]}


@router.patch("/{record_id}")
def correct_record(record_id: uuid.UUID, corrections: dict, db: Session = Depends(get_db)):
    record = db.query(Record).filter(Record.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    fields = corrections.get("fields", {})
    for field_name, new_value in fields.items():
        rf = db.query(RecordField).filter(RecordField.record_id == record_id, RecordField.field_name == field_name).first()
        if rf:
            rf.was_corrected = True
            rf.corrected_value = new_value

    db.commit()
    _log(db, record.id, "corrected", details=fields)

    # Re-validate after correction
    current_fields = {rf.field_name: (rf.corrected_value or rf.field_value) for rf in record.fields}
    violations = _validate_and_check_duplicates(db, record.id, current_fields)
    db.query(ValidationResult).filter(ValidationResult.record_id == record_id).delete()
    for v in violations:
        db.add(ValidationResult(record_id=record.id, field_name=v["field"], rule=v["rule"], passed=False, message=v["message"]))
    record.status = "validated" if not violations else "pending_review"
    db.commit()
    _log(db, record.id, "validated", details={"violations": len(violations)})

    return _serialize(record)


def _validate_and_check_duplicates(db: Session, record_id: uuid.UUID, fields: dict) -> list[dict]:
    """
    Format validation delegated to extraction-engine's rules; duplicate check
    done here since only api-gateway has the DB connection.
    """
    violations = []
    for field_name in ("survey_number", "khasra_number", "khata_number"):
        value = fields.get(field_name)
        if not value:
            continue
        existing = (
            db.query(RecordField)
            .filter(
                RecordField.field_name == field_name,
                RecordField.field_value == value,
                RecordField.record_id != record_id,
            )
            .first()
        )
        if existing:
            violations.append(
                {
                    "field": field_name,
                    "rule": "duplicate",
                    "message": f"{field_name} '{value}' already exists on record {existing.record_id}",
                }
            )
    return violations


def _serialize(record: Record) -> dict:
    return {
        "record_id": str(record.id),
        "status": record.status,
        "fields": {f.field_name: (f.corrected_value or f.field_value) for f in record.fields},
        "confidence_per_field": {f.field_name: f.confidence for f in record.fields},
        "violations": [
            {"field": v.field_name, "rule": v.rule, "message": v.message} for v in record.validations
        ],
    }


def _log(db: Session, record_id: uuid.UUID, action: str, details: dict):
    db.add(AuditLog(record_id=record_id, action=action, actor="system", details=details))
    db.commit()
