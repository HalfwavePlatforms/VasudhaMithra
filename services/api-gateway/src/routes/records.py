import base64
import os
import uuid

import httpx
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models.db_models import Record, RecordField, ValidationResult, AuditLog

from dotenv import load_dotenv

load_dotenv()
router = APIRouter(prefix="/records", tags=["records"])

OCR_SERVICE_URL = os.getenv("OCR_SERVICE_URL", "http://127.0.0.1:8001")
EXTRACTION_SERVICE_URL = os.getenv("EXTRACTION_SERVICE_URL", "http://127.0.0.1:8002")
GIS_SERVICE_URL = os.getenv("GIS_SERVICE_URL", "http://127.0.0.1:8003")


import traceback
import logging
logger = logging.getLogger("api-gateway.records")

@router.post("/upload")
async def upload_record(
    file: UploadFile = File(...),
    actor: str = "Officer (demo)",
    db: Session = Depends(get_db),
):
    try:
        content = await file.read()
        image_b64 = base64.b64encode(content).decode("utf-8")

        record = Record(original_filename=file.filename, status="processing")
        db.add(record)
        db.commit()
        db.refresh(record)
        _log(db, record.id, "uploaded", actor=actor, details={"filename": file.filename})

        # 1. OCR Step
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                ocr_resp = await client.post(
                    f"{OCR_SERVICE_URL}/ocr/extract",
                    json={"image_base64": image_b64, "language_hint": "hi", "document_id": str(record.id)},
                )
                ocr_resp.raise_for_status()
                ocr_data = ocr_resp.json()
            except httpx.HTTPError as e:
                record.status = "rejected"
                db.commit()
                raise HTTPException(status_code=502, detail=f"OCR service failed: {e}")

        record.raw_ocr_text = ocr_data["raw_text"]
        record.ocr_confidence = ocr_data["confidence"]
        record.document_type = ocr_data.get("document_type", "Standard Land Record")
        record.language = ocr_data.get("language", "en")
        db.commit()
        _log(db, record.id, "ocr_completed", actor="OCR Engine", details={"confidence": ocr_data["confidence"], "doc_type": record.document_type})

        # 2. Information Extraction Step
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                extract_resp = await client.post(
                    f"{EXTRACTION_SERVICE_URL}/extraction/parse",
                    json={"raw_text": ocr_data["raw_text"], "bounding_boxes": ocr_data.get("bounding_boxes", [])},
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
                    confidence=extraction_data["confidence_per_field"].get(field_name, 0.85),
                )
            )

        # 3. Rule-based Validation + Duplicate Checking
        violations = _validate_and_check_duplicates(db, record.id, extraction_data["fields"])

        # 4. WINNING FEATURE: Document <-> Data <-> GIS Spatial Consistency Engine
        survey_no = extraction_data["fields"].get("survey_number")
        doc_acres = extraction_data.get("area_acres")
        record.area_doc_acres = doc_acres

        if survey_no:
            async with httpx.AsyncClient(timeout=10.0) as client:
                try:
                    gis_resp = await client.get(f"{GIS_SERVICE_URL}/gis/parcel/{survey_no}")
                    if gis_resp.status_code == 200:
                        gis_data = gis_resp.json()
                        record.parcel_id = gis_data.get("parcel_id")
                        record.area_gis_acres = gis_data.get("area_gis")
                        record.gis_geojson = gis_data.get("geometry")

                        if doc_acres and record.area_gis_acres:
                            delta_pct = abs(doc_acres - record.area_gis_acres) / record.area_gis_acres * 100.0
                            record.spatial_delta_pct = round(delta_pct, 2)

                            if delta_pct <= 5.0:
                                record.spatial_consistency = "MATCH"
                            else:
                                record.spatial_consistency = "DISCREPANCY"
                                violations.append({
                                    "field": "plot_area",
                                    "rule": "spatial_consistency",
                                    "severity": "HIGH",
                                    "message": f"Spatial Discrepancy: Deed extent ({doc_acres} ac) differs by {round(delta_pct, 1)}% from Cadastral GIS parcel ({record.area_gis_acres} ac).",
                                })
                        else:
                            record.spatial_consistency = "MATCH"
                except Exception:
                    record.spatial_consistency = "NOT_EVALUATED"

        for v in violations:
            db.add(
                ValidationResult(
                    record_id=record.id,
                    field_name=v.get("field"),
                    rule=v.get("rule", "validation_error"),
                    passed=False,
                    message=v.get("message"),
                )
            )

        has_issues = bool(extraction_data.get("needs_review") or violations or record.spatial_consistency == "DISCREPANCY")
        record.status = "pending_review" if has_issues else "validated"
        record.risk_level = "HIGH" if record.spatial_consistency == "DISCREPANCY" or len(violations) > 1 else ("MEDIUM" if has_issues else "LOW")
        db.commit()
        _log(db, record.id, "extracted_and_validated", actor="System", details={"status": record.status, "spatial_consistency": record.spatial_consistency})

        return {
            "record_id": str(record.id),
            "status": record.status,
            "risk_level": record.risk_level,
            "spatial_consistency": record.spatial_consistency,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Upload failed: %s\n%s", e, traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Upload pipeline failed: {e}\n{traceback.format_exc()}")




@router.get("/{record_id}")
def get_record(record_id: uuid.UUID, db: Session = Depends(get_db)):
    record = db.query(Record).filter(Record.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return _serialize(record)


@router.get("")
def list_records(
    status: str | None = None,
    risk_level: str | None = None,
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    query = db.query(Record)
    if status:
        query = query.filter(Record.status == status)
    if risk_level:
        query = query.filter(Record.risk_level == risk_level)
    total = query.count()
    records = query.order_by(Record.uploaded_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "records": [_serialize(r) for r in records],
    }


@router.patch("/{record_id}")
def correct_record(record_id: uuid.UUID, corrections: dict, db: Session = Depends(get_db)):
    record = db.query(Record).filter(Record.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    actor = corrections.get("actor", "Revenue Officer")
    notes = corrections.get("reviewer_notes", "")
    decision = corrections.get("decision")  # "APPROVED" | "REJECTED" | None

    fields = corrections.get("fields", {})
    for field_name, new_value in fields.items():
        rf = db.query(RecordField).filter(RecordField.record_id == record_id, RecordField.field_name == field_name).first()
        if rf:
            rf.was_corrected = True
            rf.corrected_value = str(new_value)
        else:
            db.add(RecordField(record_id=record_id, field_name=field_name, field_value=str(new_value), was_corrected=True, corrected_value=str(new_value), confidence=1.0))

    if notes:
        record.reviewer_notes = notes
    record.reviewed_by = actor
    record.reviewed_at = func.now()

    db.commit()
    _log(db, record.id, "human_reviewed", actor=actor, details={"fields_corrected": list(fields.keys()), "notes": notes, "decision": decision})

    # Re-validate after correction
    current_fields = {rf.field_name: (rf.corrected_value or rf.field_value) for rf in record.fields}
    violations = _validate_and_check_duplicates(db, record.id, current_fields)
    db.query(ValidationResult).filter(ValidationResult.record_id == record_id).delete()
    for v in violations:
        db.add(ValidationResult(record_id=record.id, field_name=v["field"], rule=v["rule"], passed=False, message=v["message"]))

    if decision == "APPROVED":
        record.status = "validated"
        record.risk_level = "LOW"
    elif decision == "REJECTED":
        record.status = "rejected"
        record.risk_level = "HIGH"
    else:
        record.status = "validated" if not violations else "pending_review"
        record.risk_level = "LOW" if not violations else "MEDIUM"

    db.commit()
    _log(db, record.id, "status_updated", actor=actor, details={"status": record.status, "violations": len(violations)})

    return _serialize(record)


def _validate_and_check_duplicates(db: Session, record_id: uuid.UUID, fields: dict) -> list[dict]:
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
                    "severity": "HIGH",
                    "message": f"Duplicate detected: {field_name} '{value}' matches prior record {existing.record_id}",
                }
            )
    return violations


def _serialize(record: Record) -> dict:
    return {
        "record_id": str(record.id),
        "original_filename": record.original_filename,
        "uploaded_at": record.uploaded_at.isoformat() if record.uploaded_at else None,
        "status": record.status,
        "document_type": record.document_type or "Standard Land Record",
        "language": record.language or "en",
        "risk_level": record.risk_level or "LOW",
        "ocr_confidence": record.ocr_confidence,
        "raw_ocr_text": record.raw_ocr_text,
        "fields": {f.field_name: (f.corrected_value or f.field_value) for f in record.fields},
        "confidence_per_field": {f.field_name: f.confidence for f in record.fields},
        "corrections": {f.field_name: f.corrected_value for f in record.fields if f.was_corrected},
        "violations": [
            {"field": v.field_name, "rule": v.rule, "message": v.message} for v in record.validations
        ],
        "gis": {
            "parcel_id": record.parcel_id,
            "area_doc_acres": record.area_doc_acres,
            "area_gis_acres": record.area_gis_acres,
            "spatial_consistency": record.spatial_consistency or "NOT_EVALUATED",
            "spatial_delta_pct": record.spatial_delta_pct,
            "geometry": record.gis_geojson,
        },
        "review": {
            "reviewer_notes": record.reviewer_notes,
            "reviewed_by": record.reviewed_by,
            "reviewed_at": record.reviewed_at.isoformat() if record.reviewed_at else None,
        },
    }


def _log(db: Session, record_id: uuid.UUID, action: str, actor: str = "system", details: dict = None):
    db.add(AuditLog(record_id=record_id, action=action, actor=actor, details=details or {}))
    db.commit()

