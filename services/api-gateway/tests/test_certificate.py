import os
import sys
import uuid
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from main import app
from database import SessionLocal
from models.db_models import Record, RecordField, AuditLog
from services.certificate_generator import (
    render_parcel_map_image,
    generate_qr_image,
    build_certificate_pdf,
)
from routes.records import _log, _ensure_verification_token

client = TestClient(app)


@pytest.fixture
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_map_renderer_and_qr_generator():
    # 1. Test valid polygon rendering
    valid_polygon = {
        "type": "Polygon",
        "coordinates": [
            [
                [77.5946, 12.9716],
                [77.5956, 12.9716],
                [77.5956, 12.9726],
                [77.5946, 12.9726],
                [77.5946, 12.9716],
            ]
        ],
    }
    img_bytes = render_parcel_map_image(valid_polygon, "101/A", 2.5)
    assert img_bytes is not None
    assert img_bytes.startswith(b"\x89PNG"), "Rendered map must be a valid PNG image"

    # 2. Test invalid/empty polygon handling (graceful None return, no crash)
    assert render_parcel_map_image(None, "101/A") is None
    assert render_parcel_map_image({}, "101/A") is None
    assert render_parcel_map_image({"type": "Point", "coordinates": [0, 0]}, "101/A") is None

    # 3. Test QR code generation
    qr_bytes = generate_qr_image("http://localhost:3000/verify/test?token=abc")
    assert qr_bytes is not None
    assert qr_bytes.startswith(b"\x89PNG"), "Rendered QR must be a valid PNG image"


def test_certificate_rejected_if_not_validated(db_session):
    # Create record in pending_review state
    rec = Record(
        original_filename="pending_doc.pdf",
        status="pending_review",
        document_type="Land Deed",
        state="Karnataka",
    )
    db_session.add(rec)
    db_session.commit()
    db_session.refresh(rec)

    # Calling certificate on pending_review must return 400
    res = client.get(f"/records/{rec.id}/certificate")
    assert res.status_code == 400
    assert "only permitted for validated land records" in res.json()["detail"]

    # Changing to rejected still returns 400
    rec.status = "rejected"
    db_session.commit()

    res_rej = client.get(f"/records/{rec.id}/certificate")
    assert res_rej.status_code == 400

    db_session.delete(rec)
    db_session.commit()


def test_certificate_generation_end_to_end(db_session):
    # 1. Create a validated record with real fields, GIS polygon, and audit log
    rec = Record(
        original_filename="official_rtc_pahani.pdf",
        status="validated",
        document_type="Record of Rights (RTC)",
        state="Karnataka",
        parcel_id="KA-BLR-152",
        area_doc_acres=3.25,
        area_gis_acres=3.25,
        spatial_consistency="MATCH",
        gis_geojson={
            "type": "Polygon",
            "coordinates": [
                [
                    [77.5800, 13.0000],
                    [77.5850, 13.0000],
                    [77.5850, 13.0050],
                    [77.5800, 13.0050],
                    [77.5800, 13.0000],
                ]
            ],
        },
    )
    db_session.add(rec)
    db_session.commit()
    db_session.refresh(rec)

    # Fields
    db_session.add(RecordField(record_id=rec.id, field_name="survey_number", field_value="152/1", confidence=0.98))
    db_session.add(RecordField(record_id=rec.id, field_name="khasra_number", field_value="152", confidence=0.97))
    db_session.add(RecordField(record_id=rec.id, field_name="khata_number", field_value="KT-890", confidence=0.95))
    db_session.add(RecordField(record_id=rec.id, field_name="owner_name", field_value="Smt. Lakshmi Devi", confidence=0.99))
    db_session.add(RecordField(record_id=rec.id, field_name="plot_area", field_value="3.25 Acres", confidence=0.94))
    db_session.add(RecordField(record_id=rec.id, field_name="village", field_value="Yelahanka", confidence=0.96))
    db_session.add(RecordField(record_id=rec.id, field_name="tehsil", field_value="Bengaluru North", confidence=0.96))
    db_session.add(RecordField(record_id=rec.id, field_name="district", field_value="Bengaluru Urban", confidence=0.98))
    db_session.add(RecordField(record_id=rec.id, field_name="land_classification", field_value="Wet Agricultural (Tari)", confidence=0.92))
    db_session.commit()

    # Tamper-evident audit chain
    _log(db_session, rec.id, "uploaded", actor="Citizen", details={"filename": "official_rtc_pahani.pdf"})
    _log(db_session, rec.id, "extracted", actor="Extraction Engine", details={"rule": "karnataka_rtc"})
    _log(db_session, rec.id, "gis_aligned", actor="GIS Engine", details={"parcel_id": "KA-BLR-152", "delta_pct": 0.0})
    _log(db_session, rec.id, "validated", actor="Tahsildar", details={"status": "validated"})

    _ensure_verification_token(rec)
    db_session.commit()

    # 2. Call certificate endpoint
    res = client.get(f"/records/{rec.id}/certificate")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert "VasudhaMithra_Certificate_152_1.pdf" in res.headers["content-disposition"]
    assert res.headers.get("x-audit-valid") == "true"
    assert res.content.startswith(b"%PDF-"), "Generated certificate must be a valid PDF binary"
    assert len(res.content) > 10000, "PDF size must be substantial and contain elements"

    # 3. Tamper test: tamper audit log and check honesty check
    first_log = db_session.query(AuditLog).filter(AuditLog.record_id == rec.id).first()
    first_log.details = {"tampered": True}
    db_session.commit()

    tamper_res = client.get(f"/records/{rec.id}/certificate")
    assert tamper_res.status_code == 200
    assert tamper_res.headers.get("x-audit-valid") == "false", "Tampered audit chain must report x-audit-valid: false"

    # Clean up
    db_session.delete(rec)
    db_session.commit()
