import os
import sys
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import uuid
from datetime import datetime, timezone

from main import app
from database import SessionLocal
from models.db_models import Record, RecordField, ValidationResult

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_analytics_records():
    db = SessionLocal()
    try:
        count = db.query(Record).count()
        if count == 0:
            rec1 = Record(
                id=uuid.uuid4(),
                original_filename="sample_rtc_mandya.pdf",
                status="validated",
                language="kn",
                document_type="Record of Rights",
                uploaded_at=datetime.now(timezone.utc),
            )
            rec2 = Record(
                id=uuid.uuid4(),
                original_filename="sample_khasra_bhopal.pdf",
                status="pending_review",
                language="hi",
                document_type="Khasra",
                uploaded_at=datetime.now(timezone.utc),
            )
            db.add_all([rec1, rec2])
            db.flush()

            fields = [
                RecordField(id=uuid.uuid4(), record_id=rec1.id, field_name="survey_number", field_value="101/A", confidence=0.95, extraction_source="rule_based"),
                RecordField(id=uuid.uuid4(), record_id=rec1.id, field_name="owner_name", field_value="Kumar Swamy", confidence=0.91, extraction_source="rule_based"),
                RecordField(id=uuid.uuid4(), record_id=rec1.id, field_name="district", field_value="Mandya", confidence=0.98, extraction_source="rule_based"),
                RecordField(id=uuid.uuid4(), record_id=rec1.id, field_name="plot_area", field_value="2.5 Acres", confidence=0.89, extraction_source="rule_based"),

                RecordField(id=uuid.uuid4(), record_id=rec2.id, field_name="survey_number", field_value="42/1", confidence=0.75, extraction_source="rule_based"),
                RecordField(id=uuid.uuid4(), record_id=rec2.id, field_name="owner_name", field_value="Rajesh Sharma", confidence=0.82, extraction_source="rule_based"),
                RecordField(id=uuid.uuid4(), record_id=rec2.id, field_name="district", field_value="Bhopal", confidence=0.90, extraction_source="rule_based"),
            ]
            db.add_all(fields)

            val = ValidationResult(
                id=uuid.uuid4(),
                record_id=rec2.id,
                rule="AREA_DISCREPANCY",
                passed=False,
                details="Document area exceeds GIS area by 6.2%",
            )
            db.add(val)
            db.commit()
    finally:
        db.close()


def test_throughput_real_data_and_range():
    """
    Step 1: GET /dashboard/analytics/throughput
    Verifies daily date buckets, real counts of created/validated records,
    and honest reporting of data_range_days without fabricating trends.
    """
    resp = client.get("/dashboard/analytics/throughput?days=90")
    assert resp.status_code == 200
    data = resp.json()

    assert "data_range_days" in data
    assert "timeline" in data
    assert isinstance(data["timeline"], list)
    assert data["total_records"] > 0
    assert data["total_validated"] >= 0
    assert "honest_note" in data

    # Verify timeline day buckets structure
    if data["timeline"]:
        day1 = data["timeline"][0]
        assert "date" in day1
        assert "created" in day1
        assert "validated" in day1
        assert "pending" in day1
        assert "rejected" in day1
        # Daily total check
        assert day1["created"] == (day1["validated"] + day1["pending"] + day1["rejected"])


def test_field_accuracy_rule_based():
    """
    Step 2: GET /dashboard/analytics/field-accuracy
    Verifies rule-based confidence calculation and separate reporting of unscored fields.
    """
    resp = client.get("/dashboard/analytics/field-accuracy")
    assert resp.status_code == 200
    data = resp.json()

    assert "overall_average_accuracy_pct" in data
    assert "total_scored_fields" in data
    assert "unscored_fields_count" in data
    assert "fields" in data
    assert len(data["fields"]) > 0

    # Verify field properties
    for field in data["fields"]:
        assert "field_name" in field
        assert "display_name" in field
        assert "accuracy_pct" in field
        assert 0.0 <= field["accuracy_pct"] <= 100.0
        assert field["sample_count"] > 0


def test_district_progress_percentage():
    """
    Step 3: GET /dashboard/analytics/district-progress
    Verifies district groupings with validated vs total percentage.
    """
    resp = client.get("/dashboard/analytics/district-progress")
    assert resp.status_code == 200
    data = resp.json()

    assert "total_districts" in data
    assert "districts" in data
    assert len(data["districts"]) > 0

    for d in data["districts"]:
        assert "district" in d
        assert "total_records" in d
        assert "validated_records" in d
        assert "progress_pct" in d
        assert 0.0 <= d["progress_pct"] <= 100.0
        assert d["total_records"] >= d["validated_records"]


def test_review_reasons_aggregation():
    """
    Step 4: GET /dashboard/analytics/review-reasons
    Verifies aggregation of ValidationResult violations and spatial discrepancies.
    """
    resp = client.get("/dashboard/analytics/review-reasons")
    assert resp.status_code == 200
    data = resp.json()

    assert "total_flagged_issues" in data
    assert "reasons" in data
    assert data["total_flagged_issues"] >= 0

    if data["reasons"]:
        total_pct = sum(r["pct"] for r in data["reasons"])
        # Sum of rounded percentages should be close to 100%
        assert 98.0 <= total_pct <= 102.0
        for r in data["reasons"]:
            assert "rule" in r
            assert "label" in r
            assert "count" in r
            assert "pct" in r


def test_overview_consolidated_endpoint():
    """
    Verifies the consolidated single-call overview endpoint for the frontend.
    """
    resp = client.get("/dashboard/analytics/overview")
    assert resp.status_code == 200
    data = resp.json()
    assert "throughput" in data
    assert "accuracy" in data
    assert "districts" in data
    assert "review_reasons" in data
