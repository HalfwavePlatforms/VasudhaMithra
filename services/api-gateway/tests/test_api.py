import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_get_nonexistent_record_returns_404():
    response = client.get("/records/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404


def test_list_records_returns_paginated_shape():
    response = client.get("/records?page=1&limit=5")
    assert response.status_code == 200
    body = response.json()
    assert "total" in body and "records" in body


def test_auth_access_control_and_bearer_flow():
    # 1. Calling protected endpoint with NO Authorization and NO X-Role returns 401
    unauth_resp = client.get("/dashboard/audit-trail")
    assert unauth_resp.status_code == 401
    assert "Unauthorized" in unauth_resp.json().get("detail", "")

    # 2. Calling with spoofed X-Role header still works (demo compatibility shim)
    shim_resp = client.get("/dashboard/audit-trail", headers={"X-Role": "admin"})
    assert shim_resp.status_code == 200
    assert "audit_logs" in shim_resp.json()

    # 3. Calling with invalid or malformed Bearer token returns 401
    invalid_bearer = client.get("/dashboard/audit-trail", headers={"Authorization": "Bearer invalid_token_12345"})
    assert invalid_bearer.status_code == 401

    # 4. Full flow: send-otp (mock/demo_otp) -> verify-otp -> use returned token as Bearer auth
    os.environ["DEBUG_MODE"] = "true"
    send_resp = client.post(
        "/auth/send-otp",
        json={"email": "officer@revenue.gov.in", "phone": "9876543210", "role": "revenue"},
    )
    assert send_resp.status_code == 200
    otp = send_resp.json().get("demo_otp") or send_resp.json().get("backup_otp")
    assert otp is not None


    verify_resp = client.post(
        "/auth/verify-otp",
        json={
            "email": "officer@revenue.gov.in",
            "phone": "9876543210",
            "otp": otp,
            "role": "revenue",
        },
    )
    assert verify_resp.status_code == 200
    token = verify_resp.json()["token"]
    assert token.startswith("vasudha_bearer_")
    assert verify_resp.json()["user"]["xRole"] == "officer"

    # 5. Protected endpoint accepts the Bearer token and resolves the role correctly
    protected_resp = client.get(
        "/dashboard/audit-trail",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert protected_resp.status_code == 200
    assert "audit_logs" in protected_resp.json()

    # 6. Bearer token precedence over mismatched spoofed X-Role header
    # Token has xRole 'officer' (which is in allowed roles). If someone passes X-Role: 'forbidden_intruder',
    # Bearer token session takes precedence and allows request.
    precedence_resp = client.get(
        "/dashboard/audit-trail",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Role": "forbidden_intruder",
        },
    )
    assert precedence_resp.status_code == 200


def test_debug_mode_gates_demo_otp():
    # 1. With DEBUG_MODE unset or false, /auth/send-otp response contains no demo_otp or backup_otp
    if "DEBUG_MODE" in os.environ:
        del os.environ["DEBUG_MODE"]

    resp_prod = client.post(
        "/auth/send-otp",
        json={"email": "officer@revenue.gov.in", "phone": "9876543210", "role": "revenue"},
    )
    assert resp_prod.status_code == 200
    data_prod = resp_prod.json()
    assert "demo_otp" not in data_prod
    assert "backup_otp" not in data_prod

    # Explicitly false
    os.environ["DEBUG_MODE"] = "false"
    resp_false = client.post(
        "/auth/send-otp",
        json={"email": "officer@revenue.gov.in", "phone": "9876543210", "role": "revenue"},
    )
    assert resp_false.status_code == 200
    data_false = resp_false.json()
    assert "demo_otp" not in data_false
    assert "backup_otp" not in data_false

    # 2. With DEBUG_MODE=true, response contains demo_otp and backup_otp
    os.environ["DEBUG_MODE"] = "true"
    resp_dev = client.post(
        "/auth/send-otp",
        json={"email": "officer@revenue.gov.in", "phone": "9876543210", "role": "revenue"},
    )
    assert resp_dev.status_code == 200
    data_dev = resp_dev.json()
    assert "demo_otp" in data_dev
    assert "backup_otp" in data_dev
    assert len(data_dev["demo_otp"]) == 6


def test_audit_hash_chain_tamper_detection():
    from database import SessionLocal
    from models.db_models import Record, AuditLog
    from routes.records import _log
    import uuid

    db = SessionLocal()
    rec_id = uuid.uuid4()
    record = Record(
        id=rec_id,
        original_filename="audit_test_deed.pdf",
        file_path="/storage/test.pdf",
        status="pending_review",
    )
    db.add(record)
    db.commit()

    try:
        # 1. Log 3 events using _log()
        e1 = _log(db, rec_id, "uploaded", actor="citizen", details={"file": "audit_test_deed.pdf"})
        e2 = _log(db, rec_id, "ocr_completed", actor="OCR Engine", details={"confidence": 0.96})
        e3 = _log(db, rec_id, "human_reviewed", actor="Revenue Officer", details={"decision": "APPROVED"})

        assert e1.prev_hash == "GENESIS"
        assert e2.prev_hash == e1.curr_hash
        assert e3.prev_hash == e2.curr_hash

        # 2. Call /records/{record_id}/audit/verify -> assert valid == True
        verify_resp = client.get(f"/records/{rec_id}/audit/verify")
        assert verify_resp.status_code == 200
        verify_data = verify_resp.json()
        assert verify_data["valid"] is True
        assert verify_data["verified_entries"] == 3
        assert verify_data["broken_at"] is None

        # 3. Tamper directly with the database: modify event #2's details without updating curr_hash
        e2_row = db.query(AuditLog).filter(AuditLog.id == e2.id).first()
        e2_row.details = {"confidence": 0.50, "tampered": True}
        db.commit()

        # 4. Call /records/{record_id}/audit/verify -> assert valid == False and broken_at == str(e2.id)
        tampered_resp = client.get(f"/records/{rec_id}/audit/verify")
        assert tampered_resp.status_code == 200
        tampered_data = tampered_resp.json()
        assert tampered_data["valid"] is False
        assert tampered_data["broken_at"] == str(e2.id)
        assert tampered_data["verified_entries"] == 1

    finally:
        # Cleanup test data
        db.query(AuditLog).filter(AuditLog.record_id == rec_id).delete()
        db.query(Record).filter(Record.id == rec_id).delete()
        db.commit()
        db.close()


