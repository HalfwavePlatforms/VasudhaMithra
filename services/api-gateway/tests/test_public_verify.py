import os
import sys
import uuid
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from main import app
from database import SessionLocal
from models.db_models import Record, RecordField, AuditLog
from services.verification_signer import generate_verification_token, verify_record_token
from routes.records import _log, _ensure_verification_token

client = TestClient(app)


@pytest.fixture
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_hmac_signer_deterministic_and_constant_time():
    rec_id = uuid.uuid4()
    token = generate_verification_token(rec_id)
    assert isinstance(token, str)
    assert len(token) == 20

    # Same record ID produces same token
    assert generate_verification_token(rec_id) == token

    # Verification passes for correct token
    assert verify_record_token(rec_id, token) is True

    # Verification fails for altered token
    assert verify_record_token(rec_id, token[:-1] + ("0" if token[-1] != "0" else "1")) is False
    assert verify_record_token(rec_id, "invalid_token_xyz") is False
    assert verify_record_token(rec_id, "") is False


def test_public_verify_flow_and_data_exposure(db_session):
    # 1. Create a validated record with audit log and fields
    rec = Record(
        original_filename="survey_77_deed.pdf",
        status="validated",
        document_type="Agricultural Land Deed",
        state="Karnataka",
        raw_ocr_text="CONFIDENTIAL INTERNAL OCR RAW DUMP 12345",
        ocr_confidence=0.985,
        reviewer_notes="CONFIDENTIAL: Verified mutation via sub-registrar registry",
    )
    db_session.add(rec)
    db_session.commit()
    db_session.refresh(rec)

    # Attach fields (public facts + internal confidences)
    db_session.add(RecordField(record_id=rec.id, field_name="survey_number", field_value="77/2A", confidence=0.99))
    db_session.add(RecordField(record_id=rec.id, field_name="owner_name", field_value="Ramesh Gowda", confidence=0.95))
    db_session.add(RecordField(record_id=rec.id, field_name="village", field_value="Hoskote", confidence=0.92))
    db_session.add(RecordField(record_id=rec.id, field_name="district", field_value="Bengaluru Rural", confidence=0.97))
    db_session.commit()

    # Generate audit trail logs with real hash chain
    _log(db_session, rec.id, "uploaded", actor="citizen", details={"filename": "survey_77_deed.pdf"})
    _log(db_session, rec.id, "extracted", actor="system", details={"engine": "rule_based"})
    _log(db_session, rec.id, "validated", actor="Revenue Officer", details={"status": "validated"})

    # Ensure verification token is generated
    _ensure_verification_token(rec)
    db_session.commit()
    db_session.refresh(rec)

    valid_token = rec.verification_token
    assert valid_token is not None

    # 2. Call /public/verify without token -> 422 or 403
    resp_no_token = client.get(f"/public/verify/{rec.id}")
    assert resp_no_token.status_code in (403, 422)

    # 3. Call with invalid token -> 403
    resp_bad_token = client.get(f"/public/verify/{rec.id}?token=badtoken123")
    assert resp_bad_token.status_code == 403
    assert "Invalid or unauthorized" in resp_bad_token.json()["detail"]

    # 4. Call with valid token -> 200
    resp_valid = client.get(f"/public/verify/{rec.id}?token={valid_token}")
    assert resp_valid.status_code == 200
    data = resp_valid.json()

    # Confirm required public fields are present
    assert data["record_id"] == str(rec.id)
    assert data["survey_number"] == "77/2A"
    assert data["owner_name"] == "Ramesh Gowda"
    assert data["village"] == "Hoskote"
    assert data["district"] == "Bengaluru Rural"
    assert data["state"] == "Karnataka"
    assert data["validation_status"] == "validated"
    assert data["audit_chain_valid"] is True
    assert data["audit_entries_count"] >= 3

    # Confirm sensitive internal fields are DELIBERATELY EXCLUDED
    for forbidden in ["raw_ocr_text", "ocr_confidence", "reviewer_notes", "confidence", "confidence_per_field", "file_path"]:
        assert forbidden not in data, f"Sensitive field {forbidden} was leaked in public response!"

    # 5. Tamper test: Alter one audit log entry's action and confirm chain check fails
    entry = db_session.query(AuditLog).filter(AuditLog.record_id == rec.id).first()
    entry.action = "tampered_action"
    db_session.commit()

    tamper_resp = client.get(f"/public/verify/{rec.id}?token={valid_token}")
    assert tamper_resp.status_code == 200
    tamper_data = tamper_resp.json()
    assert tamper_data["audit_chain_valid"] is False
    assert "failed" in tamper_data["integrity_message"].lower()

    # Clean up test record
    db_session.delete(rec)
    db_session.commit()


def test_public_verify_rate_limiting():
    # Make requests up to rate limit threshold and verify 429
    test_id = uuid.uuid4()
    token = generate_verification_token(test_id)

    hit_429 = False
    for i in range(35):
        r = client.get(f"/public/verify/{test_id}?token={token}")
        if r.status_code == 429:
            hit_429 = True
            assert "Too many verification requests" in r.json()["detail"]
            break

    assert hit_429 is True, "Rate limiter did not throttle requests after threshold"
