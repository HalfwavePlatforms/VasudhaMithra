import asyncio
import base64
import hashlib
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
import httpx
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Header
from fastapi.responses import FileResponse, Response

from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models.db_models import Record, RecordField, ValidationResult, AuditLog, CorrectionLog
from services.verification_signer import generate_verification_token
from services.certificate_generator import (
    build_certificate_pdf,
    build_regional_certificate_pdf,
)
from services.lrms_integration import lrms_adapter


def _ensure_verification_token(record: Record):
    if not record.verification_token:
        token = generate_verification_token(record.id)
        record.verification_token = token
        record.verification_url = f"/verify/{record.id}?token={token}"


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
    Role-based access control check supporting Bearer tokens and fallback headers.
    Headers:
      - Authorization: Bearer <token> (primary authentication path via get_current_session)
      - X-Role: raw role string (demo-scope compatibility shim, not intended as the primary auth path)
      - X-Actor: optional display name for audit trails
    Precedence:
      If Authorization Bearer token is present, its resolved session xRole takes precedence
      over any raw X-Role header (prevents spoofed headers from overriding a logged-in session).
    Raises 401 Unauthorized if neither Bearer token nor X-Role header is present,
    or if the Bearer token is invalid/expired.
    Raises 403 Forbidden if role is not authorized.
    """
    def role_checker(
        authorization: str | None = Header(default=None),
        x_role: str | None = Header(default=None),
        x_actor: str | None = Header(default=None),
    ):
        role: str | None = None
        actor_name: str | None = None

        if authorization and authorization.strip():
            # Import dynamically or from routes.auth
            from routes.auth import get_current_session
            session = get_current_session(authorization=authorization)
            role = session.get("xRole")
            actor_name = session.get("actor")
        elif x_role and x_role.strip():
            # Demo-scope compatibility shim: keep existing test scripts and e2e runners functional
            role = x_role.strip().lower()
            actor_name = x_actor.strip() if (x_actor and x_actor.strip()) else role
        else:
            raise HTTPException(
                status_code=401,
                detail="Unauthorized: Missing Authorization Bearer token or X-Role header.",
            )

        if not role:
            raise HTTPException(
                status_code=401,
                detail="Unauthorized: Could not determine user role from authentication credentials.",
            )

        role_lower = role.strip().lower()
        allowed_lower = [r.lower() for r in allowed_roles]
        if role_lower not in allowed_lower:
            raise HTTPException(
                status_code=403,
                detail=f"Forbidden: role '{role_lower}' is not authorized for this endpoint. Required role(s): {', '.join(allowed_roles)}",
            )

        return {"role": role_lower, "actor": actor_name or role_lower}
    return role_checker



import traceback
import logging
logger = logging.getLogger("api-gateway.records")


def _detect_record_state(language: Optional[str] = None, raw_text: Optional[str] = "", fields: Optional[dict] = None) -> str:
    """
    Infers the Indian state of a land record using language code, raw OCR content,
    and extracted administrative fields (village, taluk, district).
    """
    text = (raw_text or "").lower()
    fields = fields or {}
    field_text = " ".join(str(v).lower() for v in fields.values())
    combined = f"{text} {field_text}".lower()

    if language == "kn" or any(w in combined for w in ["karnataka", "bhoomi", "tumakuru", "tumkur", "gubbi", "bengaluru", "bangalore", "mysuru", "mysore", "ಮೈಸೂರು", "ತುಮಕೂರು", "ಗುಬ್ಬಿ", "ಬೆಂಗಳೂರು", "ಅದಲಗೆರೆ", "ಕಂದಾಯ", "ಪಹಣಿ", "ಗ್ರಾಮ"]):
        return "Karnataka"
    if language == "mr" or any(w in combined for w in ["maharashtra", "mahabhulekh", "pune", "haveli", "nagpur", "satara", "सातबारा", "महाराष्ट्र", "पुणे"]):
        return "Maharashtra"
    if language == "te" or any(w in combined for w in ["telangana", "dharani", "warangal", "medak", "hyderabad", "తెలంగాణ", "వరంగల్", "ధరణి"]):
        return "Telangana"
    if language == "ta" or any(w in combined for w in ["tamil nadu", "patta", "chitta", "chennai", "தமிழ்நாடு"]):
        return "Tamil Nadu"
    if language == "bn" or any(w in combined for w in ["west bengal", "banglarbhumi", "kolkata", "পশ্চিমবঙ্গ"]):
        return "West Bengal"
    if language == "hi" or any(w in combined for w in ["madhya pradesh", "bhopal", "harda", "इंदौर", "भोपाल", "खसरा"]):
        return "Madhya Pradesh"
    return "Karnataka" if language == "kn" else ("Maharashtra" if language == "mr" else "Madhya Pradesh")


def _parse_area_to_acres(val: any) -> Optional[float]:
    """
    Parses various Indic and imperial deed area formats (acres, guntas, decimals) into standard acres.
    """
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val) if val > 0 else None
    s = str(val).strip().lower()
    if not s or s in ("none", "null", "n/a"):
        return None
    import re
    # Check for acre-gunta patterns e.g. "1-06", "1.15", "1 acre 6 guntas", "1-15"
    m_gunta = re.search(r"(\d+)\s*(?:[-–]\s*|acres?\s*(?:and\s*)?)(\d+)\s*(?:guntas?|gts?|గుంటలు|ಗುಂಟೆ)?", s)
    if m_gunta and "-" in s:
        try:
            ac = float(m_gunta.group(1))
            gt = float(m_gunta.group(2))
            return round(ac + (gt * 0.025), 3)
        except Exception:
            pass
    m = re.search(r"(\d+(?:\.\d+)?)", s)
    if m:
        try:
            return float(m.group(1))
        except Exception:
            pass
    return None


def _evaluate_and_attach_gis(db: Session, record: Record, fields: Optional[dict] = None) -> bool:
    """
    Evaluates cadastral GIS spatial consistency for a record by querying GIS service.
    Attaches geometry GeoJSON, GIS area, and sets spatial_consistency to MATCH or DISCREPANCY.
    """
    if fields is None:
        fields = {rf.field_name: (rf.corrected_value or rf.field_value) for rf in record.fields}

    survey_no = fields.get("survey_number") or fields.get("khasra_number")
    khasra_no = fields.get("khasra_number")
    if not survey_no and not khasra_no:
        return False

    detected_state = _detect_record_state(record.language, record.raw_ocr_text, fields)
    if not record.state or record.state in ("Madhya Pradesh", "India") and detected_state != "Madhya Pradesh":
        record.state = detected_state

    doc_acres = record.area_doc_acres
    if not doc_acres or doc_acres <= 0:
        doc_acres = _parse_area_to_acres(fields.get("plot_area"))
        if doc_acres:
            record.area_doc_acres = doc_acres

    sn_str = str(survey_no).strip() if survey_no else ""
    kh_str = str(khasra_no).strip() if khasra_no else ""

    lookup_keys = [sn_str]
    if kh_str and kh_str != sn_str:
        lookup_keys.insert(0, f"{sn_str}/{kh_str}")
        lookup_keys.append(kh_str)

    gis_params = {
        "village": fields.get("village") or "",
        "tehsil": fields.get("tehsil") or "",
        "district": fields.get("district") or "",
        "state": record.state or "Karnataka",
        "area_acres": doc_acres,
    }

    gis_data = None
    try:
        with httpx.Client(timeout=8.0) as client:
            for lk in lookup_keys:
                if not lk:
                    continue
                try:
                    gis_resp = client.get(f"{GIS_SERVICE_URL}/gis/parcel/{lk}", params=gis_params)
                    if gis_resp.status_code == 200:
                        gis_data = gis_resp.json()
                        break
                except Exception as e:
                    logger.debug(f"GIS query error on key '{lk}': {e}")
    except Exception as outer_e:
        logger.warning(f"GIS service call failed for record {record.id}: {outer_e}")

    if gis_data:
        record.parcel_id = gis_data.get("parcel_id")
        record.area_gis_acres = gis_data.get("area_gis")
        geom_val = gis_data.get("geometry")
        record.gis_geojson = geom_val
        record.geom = geom_val

        meta = gis_data.get("metadata") or {}
        lgd_code = meta.get("village_lgd_code")
        if lgd_code:
            record.village_lgd_code = str(lgd_code)

        if doc_acres and record.area_gis_acres:
            delta_pct = abs(doc_acres - record.area_gis_acres) / record.area_gis_acres * 100.0
            record.spatial_delta_pct = round(delta_pct, 2)
            record.spatial_consistency = "MATCH" if delta_pct <= 5.0 else "DISCREPANCY"
        else:
            record.spatial_delta_pct = 0.0
            record.spatial_consistency = "MATCH"

        db.commit()
        return True
    else:
        # If GIS lookup didn't succeed, attempt direct LGD resolution for village
        if not record.village_lgd_code and fields.get("village"):
            try:
                with httpx.Client(timeout=4.0) as client:
                    lgd_resp = client.get(
                        f"{GIS_SERVICE_URL}/gis/resolve-lgd",
                        params={
                            "village": fields.get("village") or "",
                            "tehsil": fields.get("tehsil") or "",
                            "district": fields.get("district") or "",
                            "state": record.state or "",
                        },
                    )
                    if lgd_resp.status_code == 200:
                        match_info = lgd_resp.json().get("match")
                        if match_info and match_info.get("village_lgd_code"):
                            record.village_lgd_code = str(match_info["village_lgd_code"])
            except Exception as e:
                logger.debug(f"Direct LGD resolution error: {e}")

        if not record.spatial_consistency or record.spatial_consistency == "NOT_EVALUATED":
            record.spatial_consistency = "NOT_EVALUATED"
            db.commit()
        return False


@router.post("/upload")
async def upload_record(
    file: UploadFile = File(...),
    actor: str = "Officer (demo)",
    language: str = Form("auto"),
    auth: dict = Depends(require_role(["tahsildar", "surveyor", "officer", "admin", "citizen"])),
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
            if any(k in fname for k in ["karnataka", "bhoomi", "rtc", "pahani", "kannada", "_kn_"]):
                lang_hint = "kn"
            elif any(k in fname for k in ["maharashtra", "satbara", "7_12", "7-12", "712", "mahabhulekh", "marathi", "_mr_"]):
                lang_hint = "mr"
            elif any(k in fname for k in ["telangana", "dharani", "adangal", "telugu", "_te_"]):
                lang_hint = "te"
            elif any(k in fname for k in ["tamil", "patta", "chitta", "tamilnadu", "_ta_"]):
                lang_hint = "ta"
            elif any(k in fname for k in ["bengal", "banglarbhumi", "bengali", "_bn_"]):
                lang_hint = "bn"
            elif any(k in fname for k in ["khasra", "khatauni", "bhopal", "madhya", "hindi", "_hi_"]):
                lang_hint = "hi"
            elif any(k in fname for k in ["english", "deed", "_en_"]):
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
        async with httpx.AsyncClient(timeout=180.0) as client:
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
                err_detail = str(e).strip()
                if hasattr(e, "response") and e.response is not None:
                    try:
                        err_json = e.response.json()
                        err_detail = err_json.get("detail", err_detail)
                    except Exception:
                        err_detail = e.response.text or err_detail
                if not err_detail:
                    if isinstance(e, httpx.TimeoutException):
                        err_detail = "OCR service request timed out (image may be high-resolution or multi-page)"
                    elif isinstance(e, httpx.NetworkError):
                        err_detail = f"OCR service network connection failed: {type(e).__name__}"
                    else:
                        err_detail = f"OCR service failed with {type(e).__name__}"
                logger.error(f"OCR service failed for record {record.id}: {err_detail}", exc_info=True)
                raise HTTPException(status_code=502, detail=f"OCR service failed: {err_detail}")

        record.raw_ocr_text = ocr_data["raw_text"]
        record.ocr_confidence = ocr_data["confidence"]
        record.document_type = ocr_data.get("document_type", "Standard Land Record")
        record.language = ocr_data.get("language") or lang_hint
        classification_conf = ocr_data.get("classification_confidence", 0.9 if record.document_type != "Standard Land Record" else 0.4)
        db.commit()
        _log(db, record.id, "ocr_completed", actor="OCR Engine", details={"confidence": ocr_data["confidence"], "doc_type": record.document_type, "language": record.language})

        # 2. Information Extraction Step (with automatic retry if service is busy or reloading)
        extraction_data = None
        last_exc = None
        for attempt in range(2):
            try:
                async with httpx.AsyncClient(timeout=45.0) as client:
                    extract_resp = await client.post(
                        f"{EXTRACTION_SERVICE_URL}/extraction/parse",
                        json={
                            "raw_text": ocr_data["raw_text"],
                            "bounding_boxes": ocr_data.get("bounding_boxes", []),
                            "document_type": record.document_type,
                            "language": record.language,
                            "classification_confidence": classification_conf,
                        },
                    )
                    extract_resp.raise_for_status()
                    extraction_data = extract_resp.json()
                    break
            except Exception as e:
                last_exc = e
                if attempt == 0:
                    await asyncio.sleep(1.0)
                    continue

        if extraction_data is None:
            record.status = "rejected"
            db.commit()
            err_detail = ""
            if hasattr(last_exc, "response") and last_exc.response is not None:
                try:
                    err_json = last_exc.response.json()
                    err_detail = str(err_json.get("detail", ""))
                except Exception:
                    err_detail = last_exc.response.text or ""
            if not err_detail:
                err_detail = str(last_exc) if str(last_exc).strip() else "Extraction engine connection timeout"
            logger.error(f"Extraction service failed for record {record.id}: {err_detail}")
            raise HTTPException(status_code=502, detail=f"Extraction service failed: {err_detail}")

        # Step 2b: Honest Fallback Path for Legacy Tabular Register (when LLM is disabled or did not extract fields)
        if record.document_type == "legacy_tabular_register" and not extraction_data.get("has_ai_assisted"):
            fallback_message = extraction_data.get("triage_reason") or "Legacy tabular format detected — automated field extraction not yet supported, routed for manual transcription."

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
                        extraction_source="rule_based",
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

        # Step 2c: Save Extracted Fields with Provenance Tracking
        has_ai_field = False
        for field_name, value in extraction_data["fields"].items():
            conf = extraction_data.get("confidence_per_field", {}).get(field_name)
            src = extraction_data.get("extraction_sources", {}).get(field_name, "rule_based")
            if src == "ai_assisted":
                has_ai_field = True
                conf_val = None  # Step 4: Do not attach numeric confidence to ai_assisted fields
            else:
                conf_val = round(conf, 4) if (conf is not None and isinstance(conf, (int, float))) else (0.0 if not value else None)

            db.add(
                RecordField(
                    record_id=record.id,
                    field_name=field_name,
                    field_value=value,
                    confidence=conf_val,
                    extraction_source=src,
                )
            )

        # 3. Rule-based Validation + Duplicate Checking
        violations = _validate_and_check_duplicates(db, record.id, extraction_data["fields"])

        # 4. WINNING FEATURE: Document <-> Data <-> GIS Spatial Consistency Engine
        record.state = _detect_record_state(record.language, record.raw_ocr_text, extraction_data["fields"])
        doc_acres = extraction_data.get("area_acres") or _parse_area_to_acres(extraction_data["fields"].get("plot_area"))
        record.area_doc_acres = doc_acres

        survey_no = extraction_data["fields"].get("survey_number") or extraction_data["fields"].get("khasra_number")
        gis_ok = _evaluate_and_attach_gis(db, record, extraction_data["fields"])
        if gis_ok:
            if record.spatial_consistency == "DISCREPANCY":
                violations.append({
                    "field": "plot_area",
                    "rule": "spatial_consistency",
                    "severity": "HIGH",
                    "message": f"Spatial Discrepancy: Deed extent ({record.area_doc_acres} ac) differs by {round(record.spatial_delta_pct or 0, 1)}% from Cadastral GIS parcel ({record.area_gis_acres} ac).",
                })
            _log(db, record.id, "gis_lookup_succeeded", actor="GIS Service", details={"parcel_id": record.parcel_id, "area_gis_acres": record.area_gis_acres, "spatial_consistency": record.spatial_consistency})
        elif survey_no:
            _log(db, record.id, "gis_lookup_failed", actor="GIS Service", details={"survey_number": survey_no})

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

        # Force pending_review if any field is ai_assisted or if there are review flags/violations
        has_issues = bool(has_ai_field or extraction_data.get("needs_review") or violations or record.spatial_consistency == "DISCREPANCY")
        record.status = "pending_review" if has_issues else "validated"
        if record.status == "validated":
            _ensure_verification_token(record)
        if has_ai_field and not record.reviewer_notes:
            record.reviewer_notes = "AI-assisted field extraction — pending human verification."
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




@router.get("/analytics/correction-patterns")
def get_correction_patterns(db: Session = Depends(get_db)):
    results = (
        db.query(
            CorrectionLog.field_name,
            CorrectionLog.document_type,
            CorrectionLog.language,
            func.count(CorrectionLog.id).label("correction_count"),
        )
        .group_by(CorrectionLog.field_name, CorrectionLog.document_type, CorrectionLog.language)
        .order_by(func.count(CorrectionLog.id).desc())
        .all()
    )

    patterns = []
    for row in results:
        field_name = row.field_name
        doc_type = row.document_type or "unknown"
        lang = row.language or "unknown"
        count = int(row.correction_count)

        total_query = db.query(Record)
        if row.document_type:
            total_query = total_query.filter(Record.document_type == row.document_type)
        if row.language:
            total_query = total_query.filter(Record.language == row.language)
        total_docs = total_query.count()

        if total_docs > 0:
            rate = round(min(1.0, count / total_docs), 3)
        else:
            rate = 1.0 if count > 0 else 0.0

        pct_str = f"{round(rate * 100, 1)}%"
        patterns.append({
            "field_name": field_name,
            "document_type": row.document_type,
            "language": row.language,
            "correction_count": count,
            "total_documents": total_docs,
            "correction_rate": rate,
            "summary": f"{field_name} in {doc_type}/{lang} documents is corrected {pct_str} of the time ({count} corrections)",
            "recalibration_recommended": rate >= 0.30 or count >= 5,
        })

    return {
        "total_corrections": sum(p["correction_count"] for p in patterns),
        "patterns": patterns,
    }


@router.get("/{record_id}")
def get_record(record_id: uuid.UUID, db: Session = Depends(get_db)):
    record = db.query(Record).filter(Record.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    # Auto-heal GIS: If GIS geometry is missing or not evaluated, evaluate now
    if not record.gis_geojson or record.spatial_consistency in (None, "NOT_EVALUATED"):
        _evaluate_and_attach_gis(db, record)
        db.refresh(record)

    return _serialize(record)


def verify_audit_trail_internal(record_id: uuid.UUID, db: Session) -> dict:
    record = db.query(Record).filter(Record.id == record_id).first()
    if not record:
        return {"valid": False, "verified_entries": 0, "broken_at": None, "reason": "Record not found"}

    entries = (
        db.query(AuditLog)
        .filter(AuditLog.record_id == record_id)
        .order_by(AuditLog.created_at.asc(), AuditLog.id.asc())
        .all()
    )

    verified_count = 0
    legacy_count = 0
    expected_prev = "GENESIS"

    for entry in entries:
        if not entry.curr_hash or not entry.hash_input_ts:
            legacy_count += 1
            if entry.curr_hash:
                expected_prev = entry.curr_hash
            continue

        if entry.prev_hash != expected_prev:
            return {
                "valid": False,
                "verified_entries": verified_count,
                "broken_at": str(entry.id),
                "reason": f"Chain break: expected prev_hash '{expected_prev}', got '{entry.prev_hash}'",
            }

        recomputed_hash = compute_audit_hash(
            prev_hash=entry.prev_hash,
            record_id=entry.record_id,
            action=entry.action,
            actor=entry.actor,
            details=entry.details,
            ts_str=entry.hash_input_ts,
        )

        if entry.curr_hash != recomputed_hash:
            return {
                "valid": False,
                "verified_entries": verified_count,
                "broken_at": str(entry.id),
                "reason": "Tamper detected: stored hash does not match computed hash",
            }

        expected_prev = entry.curr_hash
        verified_count += 1

    result = {
        "valid": True,
        "verified_entries": verified_count,
        "broken_at": None,
    }
    if legacy_count > 0:
        result["note"] = f"legacy entries present ({legacy_count}), hash chain verified for {verified_count} entries"
    return result


@router.get("/{record_id}/audit/verify")
def verify_audit_trail(record_id: uuid.UUID, db: Session = Depends(get_db)):
    record = db.query(Record).filter(Record.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return verify_audit_trail_internal(record_id, db)


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
        new_val_str = str(new_value) if new_value is not None else None
        rf = db.query(RecordField).filter(RecordField.record_id == record_id, RecordField.field_name == field_name).first()
        if rf:
            orig_val = rf.corrected_value if rf.was_corrected else rf.field_value
            orig_conf = rf.confidence
            if orig_val != new_val_str or not rf.was_corrected:
                rf.was_corrected = True
                rf.corrected_value = new_val_str
                corr_log = CorrectionLog(
                    record_id=record_id,
                    field_name=field_name,
                    document_type=record.document_type,
                    language=record.language,
                    original_value=orig_val,
                    original_confidence=orig_conf,
                    corrected_value=new_val_str,
                    corrected_by=actor,
                )
                db.add(corr_log)
        else:
            db.add(RecordField(record_id=record_id, field_name=field_name, field_value=new_val_str, was_corrected=True, corrected_value=new_val_str, confidence=1.0))
            corr_log = CorrectionLog(
                record_id=record_id,
                field_name=field_name,
                document_type=record.document_type,
                language=record.language,
                original_value=None,
                original_confidence=None,
                corrected_value=new_val_str,
                corrected_by=actor,
            )
            db.add(corr_log)

    if notes:
        record.reviewer_notes = notes
    record.reviewed_by = actor
    record.reviewed_at = func.now()

    db.commit()
    _log(db, record.id, "human_reviewed", actor=actor, details={"fields_corrected": list(fields.keys()), "notes": notes, "decision": decision})

    # Re-validate after correction
    current_fields = {rf.field_name: (rf.corrected_value or rf.field_value) for rf in record.fields}
    violations = _validate_and_check_duplicates(db, record.id, current_fields)

    # Re-check GIS spatial consistency on correction
    _evaluate_and_attach_gis(db, record, current_fields)
    if record.spatial_consistency == "DISCREPANCY" and record.area_doc_acres and record.area_gis_acres:
        violations.append({
            "field": "plot_area",
            "rule": "spatial_consistency",
            "severity": "HIGH",
            "message": f"Spatial Discrepancy: Deed extent ({record.area_doc_acres} ac) differs by {round(record.spatial_delta_pct or 0, 1)}% from Cadastral GIS parcel ({record.area_gis_acres} ac).",
        })

    db.query(ValidationResult).filter(ValidationResult.record_id == record_id).delete()
    for v in violations:
        db.add(ValidationResult(record_id=record.id, field_name=v["field"], rule=v["rule"], passed=False, message=v["message"]))


    if decision == "APPROVED":
        record.status = "validated"
        record.risk_level = "LOW"
        _ensure_verification_token(record)
    elif decision == "REJECTED":
        record.status = "rejected"
        record.risk_level = "HIGH"
    else:
        record.status = "validated" if not violations else "pending_review"
        record.risk_level = "LOW" if not violations else "MEDIUM"
        if record.status == "validated":
            _ensure_verification_token(record)

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
        _ensure_verification_token(record)
    elif decision == "REJECTED":
        record.status = "rejected"
        record.risk_level = "HIGH"

    db.commit()
    _log(db, record.id, "human_reviewed", actor=actor, details={"notes": notes, "decision": decision})
    return _serialize(record)


@router.post("/{record_id}/sync-lrms")
def sync_lrms(
    record_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor: str = Header(default="tahsildar", alias="X-Actor"),
):
    """
    Syncs a verified/validated land record to upstream LRMS / DILRMP databases.
    Enforces that only records with status 'verified' or 'validated' can be synchronized.
    Emits a tamper-evident audit hash-chain log entry upon successful synchronization.
    """
    record = db.query(Record).filter(Record.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    if record.status not in ("verified", "validated"):
        raise HTTPException(
            status_code=400,
            detail=f"Only verified records can be synced to LRMS/DILRMP (current status: '{record.status}')",
        )

    record_fields = {f.field_name: (f.corrected_value if f.was_corrected else f.field_value) for f in record.fields}
    record_data = {
        "document_type": record.document_type,
        "language": record.language,
        "fields": record_fields,
        "parcel_id": record.parcel_id,
        "status": record.status,
    }

    sync_result = lrms_adapter.push_verified_record(record_id, record_data)

    # Log to tamper-evident hash-chained audit trail (Task 1)
    _log(
        db=db,
        record_id=record.id,
        action="lrms_sync",
        actor=actor,
        details={
            "external_ref": sync_result["external_ref"],
            "synced_at": sync_result["synced_at"],
            "system": sync_result.get("system", "DILRMP-NIC-NationalRegistry"),
            "adapter": "LRMSAdapter (Mock/DILRMP Contract)",
        },
    )

    return sync_result


@router.get("/{record_id}/lrms-status")
def get_lrms_status(record_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    Queries sync status from upstream LRMS / DILRMP adapter.
    """
    record = db.query(Record).filter(Record.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    return lrms_adapter.check_sync_status(record_id)


@router.post("/{record_id}/generate-qr")
def generate_record_qr(
    record_id: uuid.UUID,
    auth: dict = Depends(require_role(["tahsildar", "officer", "admin", "surveyor"])),
    db: Session = Depends(get_db),
):
    """
    Generates or retrieves the signed verification QR token and URL for a land record.
    Logs QR code generation to the tamper-evident audit trail.
    """
    record = db.query(Record).filter(Record.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    _ensure_verification_token(record)
    db.commit()
    db.refresh(record)

    actor = auth.get("actor", "Revenue Officer")
    _log(
        db=db,
        record_id=record.id,
        action="qr_verification_generated",
        actor=actor,
        details={
            "token": record.verification_token,
            "verification_url": record.verification_url,
            "status": record.status,
        },
    )

    return {
        "success": True,
        "record_id": str(record.id),
        "status": record.status,
        "verification_token": record.verification_token,
        "verification_url": record.verification_url,
    }


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


@router.get("/{record_id}/certificate")
def get_record_certificate(
    record_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """
    Generates and downloads the official Digital Land Record Certificate PDF for a validated record.
    Enforces validation prerequisite: records with status != 'validated' return 400 Bad Request.
    Combines extracted fields, real cryptographic audit hash-chain verification,
    cadastral GIS geometry plot, and HMAC signed QR verification code.
    """
    record = db.query(Record).filter(Record.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Land record not found")

    # STEP 2 Requirement: Only allow generation for status="validated" records
    if record.status != "validated":
        raise HTTPException(
            status_code=400,
            detail=f"Certificate generation is only permitted for validated land records. Current record status is '{record.status}'.",
        )

    # Re-evaluate / attach GIS geometry if not already on record
    if not record.gis_geojson or record.spatial_consistency in (None, "NOT_EVALUATED"):
        _evaluate_and_attach_gis(db, record)
        db.refresh(record)

    # Ensure verification token & URL exist
    _ensure_verification_token(record)
    db.commit()
    db.refresh(record)

    # Call real internal audit trail verifier for honesty check
    audit_status = verify_audit_trail_internal(record.id, db)

    # Construct public QR URL
    frontend_base = os.getenv("FRONTEND_URL", "http://localhost:3000")
    qr_url = f"{frontend_base}{record.verification_url}"

    # Serialize record data
    record_serialized = _serialize(record)

    # Build the official PDF
    pdf_bytes = build_certificate_pdf(
        record_data=record_serialized,
        audit_status=audit_status,
        gis_geometry=record.gis_geojson or record.geom,
        qr_url=qr_url,
    )

    survey_no = (
        record_serialized.get("fields", {}).get("survey_number")
        or record_serialized.get("fields", {}).get("khasra_number")
        or str(record.id)[:8]
    ).replace("/", "_").replace(" ", "_")
    filename = f"VasudhaMithra_Certificate_{survey_no}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Certificate-Status": "validated",
            "X-Audit-Valid": str(audit_status.get("valid", False)).lower(),
        },
    )


@router.get("/{record_id}/certificate/regional")
def get_record_regional_certificate(
    record_id: uuid.UUID,
    state: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Generates and downloads the state-matched bilingual Regional Land Record Certificate PDF
    for a validated record.
    Enforces validation prerequisite: records with status != 'validated' return 400 Bad Request.
    Combines extracted fields, state-specific Indic typography, cadastral GIS vector geometry,
    cryptographic audit hash-chain integrity verification, and HMAC signed QR verification code.

    Mandatory Safety Notice: Prominently identifies as a VasudhaMithra Digitization Platform
    Verification Certificate, not an official government-issued document.
    """
    record = db.query(Record).filter(Record.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Land record not found")

    # STEP 2 Requirement: Only allow generation for status="validated" records
    if record.status != "validated":
        raise HTTPException(
            status_code=400,
            detail=f"Regional certificate generation is only permitted for validated land records. Current record status is '{record.status}'.",
        )

    # Re-evaluate / attach GIS geometry if not already on record
    if not record.gis_geojson or record.spatial_consistency in (None, "NOT_EVALUATED"):
        _evaluate_and_attach_gis(db, record)
        db.refresh(record)

    # Ensure verification token & URL exist
    _ensure_verification_token(record)
    db.commit()
    db.refresh(record)

    # Call real internal audit trail verifier for honesty check
    audit_status = verify_audit_trail_internal(record.id, db)

    # Construct public QR URL
    frontend_base = os.getenv("FRONTEND_URL", "http://localhost:3000")
    qr_url = f"{frontend_base}{record.verification_url}"

    # Serialize record data
    record_serialized = _serialize(record)
    fields_dict = record_serialized.get("fields", {})

    from services.regional_certificate_config import resolve_record_template
    resolved_state, _ = resolve_record_template(
        language=record.language,
        state=state or record.state or fields_dict.get("state"),
        fields=fields_dict,
    )
    target_state = state or resolved_state

    # Build the state-matched bilingual regional PDF
    pdf_bytes = build_regional_certificate_pdf(
        record_data=record_serialized,
        audit_status=audit_status,
        gis_geometry=record.gis_geojson or record.geom,
        qr_url=qr_url,
        state=target_state,
        language=record.language,
    )

    survey_no = (
        record_serialized.get("fields", {}).get("survey_number")
        or record_serialized.get("fields", {}).get("khasra_number")
        or str(record.id)[:8]
    ).replace("/", "_").replace(" ", "_")
    state_slug = target_state.strip().replace(" ", "_")
    filename = f"VasudhaMithra_Record_{survey_no}_Regional_{state_slug}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Certificate-Status": "validated",
            "X-Audit-Valid": str(audit_status.get("valid", False)).lower(),
            "X-Certificate-Type": "regional-bilingual",
            "X-Regional-State": target_state,
        },
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
        "extraction_sources": {f.field_name: (getattr(f, "extraction_source", "rule_based") or "rule_based") for f in record.fields},
        "corrections": {f.field_name: f.corrected_value for f in record.fields if f.was_corrected},
        "violations": [
            {"field": v.field_name, "rule": v.rule, "message": v.message} for v in record.validations
        ],
        "gis": {
            "parcel_id": record.parcel_id,
            "state": record.state,
            "area_doc_acres": record.area_doc_acres,
            "area_gis_acres": record.area_gis_acres,
            "spatial_consistency": record.spatial_consistency or "NOT_EVALUATED",
            "spatial_delta_pct": record.spatial_delta_pct,
            "geometry": record.gis_geojson or record.geom,
            "village_lgd_code": record.village_lgd_code,
        } if (record.parcel_id or record.gis_geojson or record.geom) else None,
        "review": {
            "reviewer_notes": record.reviewer_notes,
            "reviewed_by": record.reviewed_by,
            "reviewed_at": record.reviewed_at.isoformat() if record.reviewed_at else None,
        },
        "verification_token": record.verification_token,
        "verification_url": record.verification_url,
        "village_lgd_code": record.village_lgd_code,
    }


def compute_audit_hash(
    prev_hash: str | None,
    record_id: any,
    action: str,
    actor: str | None,
    details: dict | None,
    ts_str: str,
) -> str:
    actor_str = actor or ""
    details_str = json.dumps(details or {}, sort_keys=True)
    payload = f"{prev_hash or ''}{str(record_id)}{action or ''}{actor_str}{details_str}{str(ts_str)}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _log(db: Session, record_id: uuid.UUID, action: str, actor: str = "system", details: dict = None):
    latest = (
        db.query(AuditLog)
        .filter(AuditLog.record_id == record_id, AuditLog.curr_hash.isnot(None))
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .first()
    )
    if latest and latest.curr_hash:
        prev_hash = latest.curr_hash
    else:
        prev_hash = "GENESIS"

    now = datetime.now(timezone.utc)
    ts_str = now.isoformat()
    curr_hash = compute_audit_hash(
        prev_hash=prev_hash,
        record_id=record_id,
        action=action,
        actor=actor,
        details=details,
        ts_str=ts_str,
    )
    entry = AuditLog(
        record_id=record_id,
        action=action,
        actor=actor,
        details=details or {},
        created_at=now,
        prev_hash=prev_hash,
        curr_hash=curr_hash,
        hash_input_ts=ts_str,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry

