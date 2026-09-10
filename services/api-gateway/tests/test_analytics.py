import os
import sys
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from main import app
from database import SessionLocal

client = TestClient(app)


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
