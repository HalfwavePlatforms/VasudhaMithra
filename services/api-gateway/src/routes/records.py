import base64
import os
import uuid

from pathlib import Path
import httpx
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Header
from fastapi.responses import FileResponse

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

# Persistent Document Storage Path
BASE_DIR = Path(__file__).resolve().parent
REPO_ROOT = BASE_DIR
for p in [BASE_DIR] + list(BASE_DIR.parents):
    if (p / "storage").exists() or (p / "services").exists():
        REPO_ROOT = p
        break

STORAGE_PATH_ENV = os.getenv("STORAGE_PATH")
if STORAGE_PATH_ENV:
    STORAGE_PATH = Path(STORAGE_PATH_ENV)
else:
    STORAGE_PATH = REPO_ROOT / "storage"

STORAGE_PATH.mkdir(parents=True, exist_ok=True)

# Upload File Constraints
MAX_UPLOAD_SIZE_MB = int(os.getenv("MAX_UPLOAD_SIZE_MB", "15"))
MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024

ALLOWED_MIME_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "application/pdf",
}
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}


def require_role(allowed_roles: list[str]):
    """
    Lightweight header-based RBAC check.
    Headers:
      - X-Role: required role string (e.g. 'tahsildar', 'officer', 'admin', 'surveyor')
      - X-Actor: optional display name for audit trails (e.g. 'Tahsildar Officer')
    Raises 401 Unauthorized if X-Role header is missing.
    Raises 403 Forbidden if role is not authorized.
    """
    def role_checker(x_role: str | None = Header(default=None), x_actor: str | None = Header(default=None)):
        if not x_role or not x_role.strip():
            raise HTTPException(
                status_code=401,
                detail="Unauthorized: Missing required X-Role header.",
            )
        role = x_role.strip().lower()
        allowed_lower = [r.lower() for r in allowed_roles]
        if role not in allowed_lower:
            raise HTTPException(
                status_code=403,
                detail=f"Forbidden: role '{role}' is not authorized for this endpoint. Required role(s): {', '.join(allowed_roles)}",
            )
        actor_name = x_actor.strip() if (x_actor and x_actor.strip()) else role
        return {"role": role, "actor": actor_name}
    return role_checker


import traceback
import logging
logger = logging.getLogger("api-gateway.records")

@router.post("/upload")
async def upload_record(
    file: UploadFile = File(...),
    actor: str = "Officer (demo)",
    language: str = Form("auto"),
    auth: dict = Depends(require_role(["tahsildar", "surveyor", "officer", "admin"])),
    db: Session = Depends(get_db),
):
    try:
        orig_name = file.filename or "document.png"
        ext = os.path.splitext(orig_name)[1].lower()
        if not ext:
            ext = ".png"

        content_type = (file.content_type or "").lower().strip()
        if ext not in ALLOWED_EXTENSIONS and content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format (extension '{ext}', MIME type '{file.content_type}'). Allowed formats: PNG, JPG, WEBP, PDF.",
            )

        content = await file.read()
        if len(content) > MAX_UPLOAD_SIZE_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"File size ({round(len(content)/(1024*1024), 2)} MB) exceeds maximum allowed limit of {MAX_UPLOAD_SIZE_MB} MB.",
            )

        image_b64 = base64.b64encode(content).decode("utf-8")

        # Resolve language hint
        lang_hint = language
        if not lang_hint or lang_hint == "auto":
            fname = (file.filename or "").lower()
            if "_kn_" in fname or "kannada" in fname:
                lang_hint = "kn"
            elif "_mr_" in fname or "marathi" in fname:
                lang_hint = "mr"
            elif "_ta_" in fname or "tamil" in fname:
                lang_hint = "ta"
            elif "_te_" in fname or "telugu" in fname:
                lang_hint = "te"
            elif "_bn_" in fname or "bengali" in fname:
                lang_hint = "bn"
            elif "_hi_" in fname or "hindi" in fname:
                lang_hint = "hi"
            elif "_en_" in fname or "english" in fname:
                lang_hint = "en"
            else:
                lang_hint = "auto"

        record = Record(original_filename=orig_name, status="processing")
        db.add(record)
        db.commit()
        db.refresh(record)

        # Write bytes to persistent local disk storage: storage/{record_id}.{ext}
        actual_saved_fname = f"{record.id}{ext}"
        saved_file_path = STORAGE_PATH / actual_saved_fname
        try:
            with open(saved_file_path, "wb") as f_out:
                f_out.write(content)
            record.file_path = f"storage/{actual_saved_fname}"
            db.commit()
        except Exception as store_err:
            logger.error("Failed to write document file to storage: %s", store_err)
            record.file_path = None
            db.commit()

        _log(db, record.id, "uploaded", actor=actor, details={"filename": file.filename, "language": lang_hint, "file_path": record.file_path})

        # 1. OCR Step
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                ocr_resp = await client.post(
                    f"{OCR_SERVICE_URL}/ocr/extract",
                    json={"image_base64": image_b64, "language_hint": lang_hint, "document_id": str(record.id)},
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
        record.language = ocr_data.get("language") or lang_hint
        db.commit()
        _log(db, record.id, "ocr_completed", actor="OCR Engine", details={"confidence": ocr_data["confidence"], "doc_type": record.document_type, "language": record.language})

        # Step 2: Honest Fallback Path for Legacy Tabular Register
        if record.document_type == "legacy_tabular_register":
            fallback_message = "Legacy tabular format detected — automated field extraction not yet supported, routed for manual transcription."
            
            # Set standard schema fields with None / null confidence
            schema_field_names = [
                "survey_number", "khasra_number", "khata_number", "owner_name",
                "plot_area", "village", "tehsil", "district", "land_classification",
                "mutation_number", "registration_info", "ownership_type"
            ]
            for fn in schema_field_names:
                db.add(
                    RecordField(
                        record_id=record.id,
                        field_name=fn,
                        field_value=None,
                        confidence=None,
                    )
                )

            # Record triage violation explaining why automated extraction was skipped
            db.add(
                ValidationResult(
                    record_id=record.id,
                    field_name="layout_structure",
                    rule="legacy_tabular_format",
                    passed=False,
                    message=fallback_message,
                )
            )

            record.status = "pending_review"
            record.risk_level = "MEDIUM"
            record.reviewer_notes = fallback_message
            record.spatial_consistency = "NOT_EVALUATED"
            db.commit()

            _log(
                db,
                record.id,
                "routed_manual_transcription",
                actor="System Classifier",
                details={
                    "document_type": "legacy_tabular_register",
                    "reason": fallback_message,
                    "raw_ocr_length": len(record.raw_ocr_text or ""),
                }
            )

            return {
                "record_id": str(record.id),
                "status": record.status,
                "risk_level": record.risk_level,
                "spatial_consistency": record.spatial_consistency,
            }

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
            conf = extraction_data.get("confidence_per_field", {}).get(field_name)
            conf_val = round(conf, 4) if (conf is not None and isinstance(conf, (int, float))) else (0.0 if not value else None)
            db.add(
                RecordField(
                    record_id=record.id,
                    field_name=field_name,
                    field_value=value,
                    confidence=conf_val,
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
                        geom_val = gis_data.get("geometry")
                        record.gis_geojson = geom_val
                        record.geom = geom_val

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

                        db.commit()
                        _log(db, record.id, "gis_lookup_succeeded", actor="GIS Service", details={"parcel_id": record.parcel_id, "area_gis_acres": record.area_gis_acres, "spatial_consistency": record.spatial_consistency})
                    else:
                        record.spatial_consistency = "NOT_EVALUATED"
                        db.commit()
                        _log(db, record.id, "gis_lookup_failed", actor="GIS Service", details={"survey_number": survey_no, "status_code": gis_resp.status_code})
                except Exception as e:
                    record.spatial_consistency = "NOT_EVALUATED"
                    db.commit()
                    _log(db, record.id, "gis_lookup_failed", actor="GIS Service", details={"survey_number": survey_no, "error": str(e)})

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


@router.patch("/{record_id}/fields")
@router.patch("/{record_id}")
def correct_record(
    record_id: uuid.UUID,
    corrections: dict,
    auth: dict = Depends(require_role(["tahsildar", "officer", "admin"])),
    db: Session = Depends(get_db),
):
    record = db.query(Record).filter(Record.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    actor = auth.get("actor") or corrections.get("actor", "Revenue Officer")
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


@router.post("/{record_id}/review")
def review_record(
    record_id: uuid.UUID,
    review_data: dict,
    auth: dict = Depends(require_role(["tahsildar", "officer", "admin"])),
    db: Session = Depends(get_db),
):
    """
    Submits an official revenue validation or mutation review decision.
    Guarded by RBAC: Requires 'tahsildar', 'officer', or 'admin' role.
    """
    record = db.query(Record).filter(Record.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    actor = auth.get("actor") or review_data.get("actor", "Tahsildar")
    notes = review_data.get("reviewer_notes", "")
    decision = review_data.get("decision")  # "APPROVED" | "REJECTED"

    if notes:
        record.reviewer_notes = notes
    record.reviewed_by = actor
    record.reviewed_at = func.now()

    if decision == "APPROVED":
        record.status = "validated"
        record.risk_level = "LOW"
    elif decision == "REJECTED":
        record.status = "rejected"
        record.risk_level = "HIGH"

    db.commit()
    _log(db, record.id, "human_reviewed", actor=actor, details={"notes": notes, "decision": decision})
    return _serialize(record)


@router.get("/{record_id}/document")
@router.get("/{record_id}/download")
def download_record(record_id: str, db: Session = Depends(get_db)):
    """
    Downloads original uploaded land record document from persistent storage.
    Returns 404 if record or storage file does not exist.
    """
    try:
        rec_uuid = uuid.UUID(record_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid record UUID format")

    record = db.query(Record).filter(Record.id == rec_uuid).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    target_file = None
    if record.file_path:
        candidate = Path(record.file_path)
        if not candidate.is_absolute():
            candidate = REPO_ROOT / candidate
        if candidate.exists():
            target_file = candidate

    if not target_file:
        # Fallback: check storage directory for any file matching record_id.*
        matches = list(STORAGE_PATH.glob(f"{record_id}.*"))
        if matches:
            target_file = matches[0]

    if not target_file or not target_file.exists():
        raise HTTPException(status_code=404, detail="Original document file not found in storage")

    ext = target_file.suffix.lower()
    media_types = {
        ".pdf": "application/pdf",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".tiff": "image/tiff",
        ".tif": "image/tiff",
    }
    media_type = media_types.get(ext, "application/octet-stream")

    return FileResponse(
        path=str(target_file),
        filename=record.original_filename or target_file.name,
        media_type=media_type,
    )


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
    doc_url = f"/records/{record.id}/document" if record.file_path else None
    return {
        "record_id": str(record.id),
        "original_filename": record.original_filename,
        "file_path": record.file_path,
        "document_url": doc_url,
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
            "geometry": record.gis_geojson or record.geom,
        } if (record.parcel_id or record.gis_geojson or record.geom) else None,
        "review": {
            "reviewer_notes": record.reviewer_notes,
            "reviewed_by": record.reviewed_by,
            "reviewed_at": record.reviewed_at.isoformat() if record.reviewed_at else None,
        },
    }


def _log(db: Session, record_id: uuid.UUID, action: str, actor: str = "system", details: dict = None):
    db.add(AuditLog(record_id=record_id, action=action, actor=actor, details=details or {}))
    db.commit()

