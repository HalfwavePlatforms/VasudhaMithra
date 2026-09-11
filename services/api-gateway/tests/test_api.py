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


def test_audit_hash_chain_legacy_continuity():
    from database import SessionLocal
    from models.db_models import Record, AuditLog
    from routes.records import _log
    from datetime import datetime, timezone, timedelta
    import uuid

    db = SessionLocal()
    rec_id = uuid.uuid4()
    record = Record(
        id=rec_id,
        original_filename="mixed_audit_test.pdf",
        file_path="/storage/mixed.pdf",
        status="pending_review",
    )
    db.add(record)
    db.commit()

    try:
        now = datetime.now(timezone.utc)
        # 1. Entry 1: manually insert a row with curr_hash set but hash_input_ts=None (simulating a row from between the two migrations)
        e1 = AuditLog(
            record_id=rec_id,
            action="uploaded",
            actor="citizen",
            details={"file": "mixed_audit_test.pdf"},
            created_at=now - timedelta(minutes=10),
            prev_hash="GENESIS",
            curr_hash="legacy_hash_abc123",
            hash_input_ts=None,
        )
        db.add(e1)

        # 2. Entry 2: a second manually inserted row with curr_hash=None entirely (true legacy, pre-hash-chain)
        e2 = AuditLog(
            record_id=rec_id,
            action="legacy_pre_hash_event",
            actor="system",
            details={"note": "pre-hash-chain entry"},
            created_at=now - timedelta(minutes=5),
            prev_hash=None,
            curr_hash=None,
            hash_input_ts=None,
        )
        db.add(e2)
        db.commit()

        # 3. Entry 3: normal _log() call producing a full hash_input_ts entry with prev_hash correctly pointing to entry (1)'s curr_hash
        e3 = _log(db, rec_id, "human_reviewed", actor="Revenue Officer", details={"decision": "APPROVED"})
        assert e3.prev_hash == "legacy_hash_abc123"
        assert e3.hash_input_ts is not None

        # 4. Call /audit/verify and assert valid=True
        verify_resp = client.get(f"/records/{rec_id}/audit/verify")
        assert verify_resp.status_code == 200
        verify_data = verify_resp.json()
        assert verify_data["valid"] is True
        assert verify_data["verified_entries"] == 1
        assert verify_data["broken_at"] is None
        assert "legacy entries present" in verify_data.get("note", "")

    finally:
        db.query(AuditLog).filter(AuditLog.record_id == rec_id).delete()
        db.query(Record).filter(Record.id == rec_id).delete()
        db.commit()
        db.close()


def test_correction_feedback_learning_loop():
    from database import SessionLocal
    from models.db_models import Record, RecordField, CorrectionLog, AuditLog
    import uuid
    import sys
    from pathlib import Path

    repo_root = Path(__file__).resolve().parent.parent.parent
    extraction_src = repo_root / "extraction-engine" / "src"
    if str(extraction_src) not in sys.path:
        sys.path.insert(0, str(extraction_src))
    from field_extractor import extract_fields, get_correction_recalibration, set_correction_patterns_cache

    set_correction_patterns_cache(None)

    db = SessionLocal()
    created_rec_ids = []

    try:
        # 1. Clean up any pre-existing test data for this test tuple
        db.query(CorrectionLog).filter(
            CorrectionLog.field_name == "survey_number",
            CorrectionLog.document_type == "numbered_box_rtc",
            CorrectionLog.language == "kn",
        ).delete()
        db.commit()

        # 2. Before any corrections: check that recalibration does not kick in
        should_recal_before, penalty_before = get_correction_recalibration("survey_number", "numbered_box_rtc", "kn")
        assert not should_recal_before
        assert penalty_before == 0.0

        # 3. Seed 5 documents of (numbered_box_rtc, kn) and submit human corrections for survey_number on all 5
        for i in range(5):
            rec_id = uuid.uuid4()
            created_rec_ids.append(rec_id)
            rec = Record(
                id=rec_id,
                original_filename=f"kannada_rtc_{i}.png",
                file_path=f"/storage/kannada_rtc_{i}.png",
                document_type="numbered_box_rtc",
                language="kn",
                status="pending_review",
            )
            db.add(rec)
            db.commit()

            rf = RecordField(
                record_id=rec_id,
                field_name="survey_number",
                field_value=f"10{i}/A",
                confidence=0.88,
                was_corrected=False,
            )
            db.add(rf)
            db.commit()

            # Officer corrects survey_number (mocking GIS lookup timeout during offline test)
            from unittest.mock import patch, MagicMock
            mock_resp = MagicMock()
            mock_resp.status_code = 404
            mock_c = MagicMock()
            mock_c.get.return_value = mock_resp
            mock_c.__enter__.return_value = mock_c
            mock_c.__exit__.return_value = False
            with patch("routes.records.httpx.Client", return_value=mock_c):
                corr_resp = client.patch(
                    f"/records/{rec_id}/fields",
                    headers={"X-Role": "tahsildar"},
                    json={
                        "actor": "Tahsildar Mysore",
                        "fields": {"survey_number": f"10{i}/B-CORRECTED"},
                        "reviewer_notes": f"Corrected OCR misread on sample {i}",
                    },
                )
            assert corr_resp.status_code == 200

        # 4. Confirm 5 CorrectionLog rows were created
        corr_count = (
            db.query(CorrectionLog)
            .filter(
                CorrectionLog.field_name == "survey_number",
                CorrectionLog.document_type == "numbered_box_rtc",
                CorrectionLog.language == "kn",
            )
            .count()
        )
        assert corr_count == 5

        # 5. Call GET /records/analytics/correction-patterns -> verify aggregated pattern
        patterns_resp = client.get("/records/analytics/correction-patterns")
        assert patterns_resp.status_code == 200
        patterns_data = patterns_resp.json()
        assert patterns_data["total_corrections"] >= 5

        kn_survey_pattern = next(
            (p for p in patterns_data["patterns"]
             if p["field_name"] == "survey_number"
             and p["document_type"] == "numbered_box_rtc"
             and p["language"] == "kn"),
            None,
        )
        assert kn_survey_pattern is not None
        assert kn_survey_pattern["correction_count"] == 5
        assert kn_survey_pattern["recalibration_recommended"] is True
        assert "survey_number in numbered_box_rtc/kn documents" in kn_survey_pattern["summary"]

        # 6. Test that on a 6th similar document, recalibration kicks in and measurably lowers confidence
        should_recal_after, penalty_after = get_correction_recalibration("survey_number", "numbered_box_rtc", "kn")
        assert should_recal_after is True
        assert penalty_after == 0.25

        # Run extract_fields with raw text containing survey number
        sample_text = "ಕರ್ನಾಟಕ ಸರ್ಕಾರ ಸರ್ವೆ ನಂಬರ್ 142/3 ಮಾಲೀಕರು ರಾಮಪ್ಪ"
        sample_boxes = [
            {"text": "ಸರ್ವೆ ನಂಬರ್ 142/3", "confidence": 0.85, "box": [10, 10, 100, 30]},
            {"text": "ರಾಮಪ್ಪ", "confidence": 0.90, "box": [10, 40, 100, 60]},
        ]
        extraction = extract_fields(
            raw_text=sample_text,
            bounding_boxes=sample_boxes,
            document_type="numbered_box_rtc",
            language="kn",
        )

        survey_conf = extraction["confidence_per_field"].get("survey_number")
        assert survey_conf is not None
        # Confidence was lowered from base (~0.85) to ~0.60, dropping below review threshold 0.75
        assert survey_conf < 0.75
        assert "survey_number" in extraction["needs_review"]
        assert extraction["structured_record"]["survey_number"]["recalibrated"] is True

    finally:
        # Cleanup test data
        for rid in created_rec_ids:
            db.query(CorrectionLog).filter(CorrectionLog.record_id == rid).delete()
            db.query(AuditLog).filter(AuditLog.record_id == rid).delete()
            db.query(RecordField).filter(RecordField.record_id == rid).delete()
            db.query(Record).filter(Record.id == rid).delete()
        db.commit()
        db.close()


def test_lrms_sync_verified_record():
    from database import SessionLocal
    from models.db_models import Record, RecordField, AuditLog
    import uuid

    db = SessionLocal()
    rec_id = uuid.uuid4()

    try:
        # 1. Create a record in pending_review status
        rec = Record(
            id=rec_id,
            original_filename="survey_doc_ka.png",
            file_path="/storage/survey_doc_ka.png",
            document_type="Record of Rights / RTC (Pahani)",
            language="kn",
            status="pending_review",
        )
        db.add(rec)
        db.commit()

        rf1 = RecordField(record_id=rec_id, field_name="survey_number", field_value="142/3", confidence=0.92)
        rf2 = RecordField(record_id=rec_id, field_name="owner_name", field_value="Ramegowda", confidence=0.88)
        db.add_all([rf1, rf2])
        db.commit()

        # 2. Attempt sync while unverified -> MUST fail with 400
        sync_fail_resp = client.post(f"/records/{rec_id}/sync-lrms", headers={"X-Actor": "Tahsildar Ramanagara"})
        assert sync_fail_resp.status_code == 400
        assert "Only verified records can be synced" in sync_fail_resp.json()["detail"]

        # Check sync status -> should be unsynced
        status_resp = client.get(f"/records/{rec_id}/lrms-status")
        assert status_resp.status_code == 200
        assert status_resp.json()["synced"] is False

        # 3. Mark record as validated / verified
        rec.status = "validated"
        db.commit()

        # 4. Synchronize verified record with LRMS
        sync_resp = client.post(f"/records/{rec_id}/sync-lrms", headers={"X-Actor": "Tahsildar Ramanagara"})
        assert sync_resp.status_code == 200
        sync_data = sync_resp.json()
        assert sync_data["status"] == "synced"
        assert sync_data["external_ref"].startswith("DILRMP-")
        assert "synced_at" in sync_data
        assert sync_data["payload_summary"]["survey_number"] == "142/3"

        # 5. Query LRMS status -> should now report synced with reference
        status_resp = client.get(f"/records/{rec_id}/lrms-status")
        assert status_resp.status_code == 200
        status_data = status_resp.json()
        assert status_data["synced"] is True
        assert status_data["external_ref"] == sync_data["external_ref"]

        # 6. Verify audit hash chain integrity -> must include lrms_sync and pass tamper verification
        audit_verify_resp = client.get(f"/records/{rec_id}/audit/verify")
        assert audit_verify_resp.status_code == 200
        audit_verify_data = audit_verify_resp.json()
        assert audit_verify_data["valid"] is True
        assert audit_verify_data["verified_entries"] >= 1

        latest_log = (
            db.query(AuditLog)
            .filter(AuditLog.record_id == rec_id, AuditLog.action == "lrms_sync")
            .first()
        )
        assert latest_log is not None
        assert latest_log.actor == "Tahsildar Ramanagara"
        assert latest_log.details["external_ref"] == sync_data["external_ref"]
        assert latest_log.prev_hash is not None
        assert latest_log.curr_hash is not None

    finally:
        db.query(AuditLog).filter(AuditLog.record_id == rec_id).delete()
        db.query(RecordField).filter(RecordField.record_id == rec_id).delete()
        db.query(Record).filter(Record.id == rec_id).delete()
        db.commit()
        db.close()


def test_gis_spatial_auto_heal_and_consistency():
    from database import SessionLocal
    from models.db_models import Record, RecordField
    from unittest.mock import patch, MagicMock
    import uuid

    db = SessionLocal()
    rec_id = uuid.uuid4()
    try:
        rec = Record(
            id=rec_id,
            original_filename="rtc_kannada_sample.png",
            language="kn",
            document_type="Record of Rights / RTC (Pahani)",
            status="pending_review",
            spatial_consistency="NOT_EVALUATED",
            gis_geojson=None,
        )
        db.add(rec)
        db.commit()

        rf1 = RecordField(record_id=rec_id, field_name="survey_number", field_value="452", confidence=0.95)
        rf2 = RecordField(record_id=rec_id, field_name="village", field_value="ಅದಲಗೆರೆ", confidence=0.92)
        rf3 = RecordField(record_id=rec_id, field_name="tehsil", field_value="ಗುಬ್ಬಿ", confidence=0.91)
        rf4 = RecordField(record_id=rec_id, field_name="district", field_value="ತುಮಕೂರು", confidence=0.94)
        rf5 = RecordField(record_id=rec_id, field_name="plot_area", field_value="1.15", confidence=0.96)
        db.add_all([rf1, rf2, rf3, rf4, rf5])
        db.commit()

        mock_gis_resp = MagicMock()
        mock_gis_resp.status_code = 200
        mock_gis_resp.json.return_value = {
            "status": "FOUND",
            "parcel_id": "PARCEL-452-CAD",
            "survey_number": "452",
            "area_gis": 1.15,
            "source": "cadastral_spatial_engine",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[76.95, 13.32], [76.96, 13.32], [76.96, 13.33], [76.95, 13.33], [76.95, 13.32]]]
            }
        }
        mock_client_instance = MagicMock()
        mock_client_instance.get.return_value = mock_gis_resp
        mock_client_instance.__enter__.return_value = mock_client_instance
        mock_client_instance.__exit__.return_value = False

        with patch("routes.records.httpx.Client", return_value=mock_client_instance):
            # 1. GET /records/{id} should auto-heal and return populated GIS
            resp = client.get(f"/records/{rec_id}")
            assert resp.status_code == 200
            data = resp.json()
            assert data["gis"] is not None
            assert data["gis"]["parcel_id"] == "PARCEL-452-CAD"
            assert data["gis"]["area_gis_acres"] == 1.15
            assert data["gis"]["spatial_consistency"] == "MATCH"
            assert data["gis"]["geometry"] is not None
            assert data["gis"]["geometry"]["type"] == "Polygon"

    finally:
        db.query(RecordField).filter(RecordField.record_id == rec_id).delete()
        db.query(Record).filter(Record.id == rec_id).delete()
        db.commit()
        db.close()


def test_higher_official_vasudhamithra_admin_login():
    os.environ["DEBUG_MODE"] = "true"

    # 1. Random non-gov email in official role is rejected
    rej_resp = client.post(
        "/auth/send-otp",
        json={"email": "unauthorized_user@gmail.com", "phone": "9876543210", "role": "revenue"},
    )
    assert rej_resp.status_code == 400
    assert "Official email must end with .gov.in" in rej_resp.json()["detail"]

    # 2. Whitelisted higher official email (vasudhamithra@gmail.com) is accepted under admin role
    send_resp = client.post(
        "/auth/send-otp",
        json={"email": "vasudhamithra@gmail.com", "phone": "9876543210", "role": "admin"},
    )
    assert send_resp.status_code == 200
    otp = send_resp.json().get("demo_otp") or send_resp.json().get("backup_otp")
    assert otp is not None

    # 3. Verify OTP yields admin xRole and Chief Registrar actor
    verify_resp = client.post(
        "/auth/verify-otp",
        json={
            "email": "vasudhamithra@gmail.com",
            "phone": "9876543210",
            "otp": otp,
            "role": "admin",
        },
    )
    assert verify_resp.status_code == 200
    data = verify_resp.json()
    assert data["user"]["xRole"] == "admin"
    assert data["user"]["roleKey"] == "admin"
    assert "Chief Registrar" in data["user"]["actor"]
    admin_token = data["token"]

    # 4. Whitelisted email works even if submitted under 'revenue' tab
    send_resp_rev = client.post(
        "/auth/send-otp",
        json={"email": "VasudhaMithra@gmail.com", "phone": "9876543210", "role": "revenue"},
    )
    assert send_resp_rev.status_code == 200
    otp_rev = send_resp_rev.json().get("demo_otp") or send_resp_rev.json().get("backup_otp")
    verify_resp_rev = client.post(
        "/auth/verify-otp",
        json={
            "email": "VasudhaMithra@gmail.com",
            "phone": "9876543210",
            "otp": otp_rev,
            "role": "revenue",
        },
    )
    assert verify_resp_rev.status_code == 200
    assert verify_resp_rev.json()["user"]["xRole"] == "admin"

    # 5. Admin token has superuser access to protected endpoints
    audit_resp = client.get(
        "/dashboard/audit-trail",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert audit_resp.status_code == 200
    assert "audit_logs" in audit_resp.json()
