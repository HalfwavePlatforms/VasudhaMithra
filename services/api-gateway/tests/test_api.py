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

    # 4. Full flow: send-otp -> verify-otp -> use returned token as Bearer auth
    send_resp = client.post(
        "/auth/send-otp",
        json={"email": "officer@revenue.gov.in", "phone": "9876543210", "role": "revenue"},
    )
    assert send_resp.status_code == 200
    otp = send_resp.json().get("demo_otp") or send_resp.json().get("backup_otp")

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

