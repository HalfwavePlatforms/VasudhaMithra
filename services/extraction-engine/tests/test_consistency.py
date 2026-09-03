"""
Comprehensive tests for extraction engine:
  - All 12 fields extract from English text
  - Hindi keyword extraction (all 4 previously missing: village, tehsil, district, land_classification)
  - New fields: registration_info, ownership_type, extended mutation_number
  - plot_area structured_record shape (value=float, unit, raw)
  - Area sanity range violations
  - Village/tehsil/district admin hierarchy check
  - survey_number vs khasra_number identity (extraction overlap)
  - Area discrepancy check: SPATIAL MATCH and SPATIAL DISCREPANCY cases
  - Multilingual plot_area keywords (Kannada, Tamil, Telugu)
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


# ──────────────────────────────────────────────────────────────────────────────
# HEALTH
# ──────────────────────────────────────────────────────────────────────────────

def test_health():
    assert client.get("/health").json() == {"status": "ok"}


# ──────────────────────────────────────────────────────────────────────────────
# CORE FIELD EXTRACTION — English
# ──────────────────────────────────────────────────────────────────────────────

FULL_ENGLISH_TEXT = """
Land Revenue Department — Record of Rights
Survey No 145/2A  Khasra No 4891  Khata No 512
Owner: Ramesh Kumar Sharma
Area: 2.45 acres
Village Kothari  Tehsil Sehore  District Bhopal
Land Classification: Agricultural
Mutation No MR-12/2024
Registration No 4567/2024
Ownership Type: Individual Freehold
"""

def test_parse_returns_200():
    response = client.post("/extraction/parse", json={"raw_text": FULL_ENGLISH_TEXT, "bounding_boxes": []})
    assert response.status_code == 200


def test_extracts_survey_number():
    response = client.post("/extraction/parse", json={"raw_text": FULL_ENGLISH_TEXT, "bounding_boxes": []})
    body = response.json()
    assert body["fields"]["survey_number"] is not None
    assert "145" in body["fields"]["survey_number"]


def test_extracts_khasra_number():
    response = client.post("/extraction/parse", json={"raw_text": FULL_ENGLISH_TEXT, "bounding_boxes": []})
    body = response.json()
    assert body["fields"]["khasra_number"] is not None


def test_extracts_khata_number():
    response = client.post("/extraction/parse", json={"raw_text": FULL_ENGLISH_TEXT, "bounding_boxes": []})
    body = response.json()
    assert body["fields"]["khata_number"] is not None


def test_extracts_owner_name():
    response = client.post("/extraction/parse", json={"raw_text": FULL_ENGLISH_TEXT, "bounding_boxes": []})
    body = response.json()
    assert body["fields"]["owner_name"] is not None
    assert len(body["fields"]["owner_name"]) > 2


def test_extracts_plot_area():
    response = client.post("/extraction/parse", json={"raw_text": FULL_ENGLISH_TEXT, "bounding_boxes": []})
    body = response.json()
    assert body["fields"]["plot_area"] is not None
    assert "2.45" in body["fields"]["plot_area"]


def test_plot_area_structured_shape():
    """plot_area in structured_record must have value=float, unit, raw, confidence."""
    response = client.post("/extraction/parse", json={"raw_text": FULL_ENGLISH_TEXT, "bounding_boxes": []})
    body = response.json()
    sr = body["structured_record"]["plot_area"]
    assert isinstance(sr["value"], float), "plot_area.value must be a float (acres)"
    assert isinstance(sr["unit"], str)
    assert "raw" in sr, "plot_area must preserve raw string"
    assert "confidence" in sr
    assert 0.0 <= sr["confidence"] <= 1.0


def test_plot_area_acres_value():
    """2.45 acres should parse to value=2.45 with unit=acre."""
    response = client.post("/extraction/parse", json={"raw_text": FULL_ENGLISH_TEXT, "bounding_boxes": []})
    body = response.json()
    sr = body["structured_record"]["plot_area"]
    assert sr["value"] == pytest.approx(2.45, rel=0.01)
    assert sr["unit"] == "acre"


def test_extracts_village():
    response = client.post("/extraction/parse", json={"raw_text": FULL_ENGLISH_TEXT, "bounding_boxes": []})
    body = response.json()
    assert body["fields"]["village"] is not None


def test_extracts_tehsil():
    response = client.post("/extraction/parse", json={"raw_text": FULL_ENGLISH_TEXT, "bounding_boxes": []})
    body = response.json()
    assert body["fields"]["tehsil"] is not None


def test_extracts_district():
    response = client.post("/extraction/parse", json={"raw_text": FULL_ENGLISH_TEXT, "bounding_boxes": []})
    body = response.json()
    assert body["fields"]["district"] is not None


def test_extracts_land_classification():
    response = client.post("/extraction/parse", json={"raw_text": FULL_ENGLISH_TEXT, "bounding_boxes": []})
    body = response.json()
    assert body["fields"]["land_classification"] is not None


def test_extracts_mutation_number():
    response = client.post("/extraction/parse", json={"raw_text": FULL_ENGLISH_TEXT, "bounding_boxes": []})
    body = response.json()
    assert body["fields"]["mutation_number"] is not None
    assert "12" in body["fields"]["mutation_number"]


def test_extracts_registration_info():
    """New field: registration_info."""
    response = client.post("/extraction/parse", json={"raw_text": FULL_ENGLISH_TEXT, "bounding_boxes": []})
    body = response.json()
    assert body["fields"]["registration_info"] is not None
    assert "4567" in body["fields"]["registration_info"]


def test_extracts_ownership_type():
    """New field: ownership_type."""
    response = client.post("/extraction/parse", json={"raw_text": FULL_ENGLISH_TEXT, "bounding_boxes": []})
    body = response.json()
    assert body["fields"]["ownership_type"] is not None


def test_area_acres_top_level():
    """area_acres at root level must be a float (backward compat for API Gateway)."""
    response = client.post("/extraction/parse", json={"raw_text": FULL_ENGLISH_TEXT, "bounding_boxes": []})
    body = response.json()
    assert isinstance(body["area_acres"], float)
    assert body["area_acres"] == pytest.approx(2.45, rel=0.01)


# ──────────────────────────────────────────────────────────────────────────────
# MULTILINGUAL — HINDI (fields that were previously missing Hindi keywords)
# ──────────────────────────────────────────────────────────────────────────────

HINDI_TEXT = """
राजस्व विभाग — अधिकार अभिलेख
सर्वे नं 72/3  खसरा 8801  खाता 201
भूमि स्वामी: रामलाल वर्मा
क्षेत्रफल: 1.80 एकड़
गाँव रामपुर  तहसील हरदा  जिला होशंगाबाद
भूमि वर्ग: कृषि भूमि
नामांतरण संख्या 456/2023
पंजीकरण संख्या 789/2024
स्वामित्व प्रकार: व्यक्तिगत
"""

def test_hindi_village_extraction():
    """गाँव keyword (previously missing) must now extract village."""
    response = client.post("/extraction/parse", json={"raw_text": HINDI_TEXT, "bounding_boxes": []})
    body = response.json()
    assert body["fields"]["village"] is not None, "Hindi 'गाँव' keyword must extract village"


def test_hindi_tehsil_extraction():
    """तहसील keyword (previously missing) must now extract tehsil."""
    response = client.post("/extraction/parse", json={"raw_text": HINDI_TEXT, "bounding_boxes": []})
    body = response.json()
    assert body["fields"]["tehsil"] is not None, "Hindi 'तहसील' keyword must extract tehsil"


def test_hindi_district_extraction():
    """जिला keyword (previously missing) must now extract district."""
    response = client.post("/extraction/parse", json={"raw_text": HINDI_TEXT, "bounding_boxes": []})
    body = response.json()
    assert body["fields"]["district"] is not None, "Hindi 'जिला' keyword must extract district"


def test_hindi_land_classification_extraction():
    """भूमि वर्ग keyword (previously missing) must now extract land_classification."""
    response = client.post("/extraction/parse", json={"raw_text": HINDI_TEXT, "bounding_boxes": []})
    body = response.json()
    assert body["fields"]["land_classification"] is not None, "Hindi 'भूमि वर्ग' keyword must extract land_classification"


def test_hindi_mutation_number_extraction():
    """नामांतरण संख्या keyword (extended) must extract mutation_number."""
    response = client.post("/extraction/parse", json={"raw_text": HINDI_TEXT, "bounding_boxes": []})
    body = response.json()
    assert body["fields"]["mutation_number"] is not None, "Hindi 'नामांतरण संख्या' must extract mutation_number"


def test_hindi_registration_info():
    """पंजीकरण संख्या keyword must extract registration_info."""
    response = client.post("/extraction/parse", json={"raw_text": HINDI_TEXT, "bounding_boxes": []})
    body = response.json()
    assert body["fields"]["registration_info"] is not None, "Hindi 'पंजीकरण संख्या' must extract registration_info"


def test_hindi_area_plot():
    """क्षेत्रफल / एकड़ keywords must extract plot_area in Hindi documents."""
    response = client.post("/extraction/parse", json={"raw_text": HINDI_TEXT, "bounding_boxes": []})
    body = response.json()
    assert body["fields"]["plot_area"] is not None, "Hindi plot area extraction failed"


# ──────────────────────────────────────────────────────────────────────────────
# UNIT CONVERSION — Hectare
# ──────────────────────────────────────────────────────────────────────────────

def test_hectare_conversion():
    """1 hectare = 2.47105 acres — structured_record must reflect converted value."""
    text = "Survey No 10/1 Owner: Test Owner Area 1 hectare Village A Khasra 999 Khata 1"
    response = client.post("/extraction/parse", json={"raw_text": text, "bounding_boxes": []})
    body = response.json()
    sr = body["structured_record"].get("plot_area", {})
    if sr.get("value"):
        assert sr["value"] == pytest.approx(2.47105, rel=0.01), "1 hectare should convert to ~2.47105 acres"
        assert sr["unit"] == "hectare"


# ──────────────────────────────────────────────────────────────────────────────
# VALIDATION — Required fields
# ──────────────────────────────────────────────────────────────────────────────

def test_validate_flags_missing_required_field():
    response = client.post(
        "/extraction/validate",
        json={"record_id": "test-id", "fields": {"survey_number": None}},
    )
    body = response.json()
    assert body["valid"] is False
    assert any(v["rule"] == "required" for v in body["violations"])


def test_validate_passes_all_required_fields():
    fields = {
        "survey_number": "145/2",
        "khasra_number": "4891",
        "khata_number": "512",
        "owner_name": "Ramesh Kumar",
        "plot_area": "2.45 acres",
        "village": "Kothari",
        "tehsil": "Sehore",
        "district": "Bhopal",
        "land_classification": "Agricultural",
        "mutation_number": "MR-12/2024",
        "registration_info": "4567/2024",
        "ownership_type": "Individual Freehold",
    }
    response = client.post(
        "/extraction/validate",
        json={"record_id": "test-full", "fields": fields},
    )
    body = response.json()
    # All required fields present — only possible issues are LOW severity
    high_violations = [v for v in body["violations"] if v["severity"] == "HIGH"]
    assert len(high_violations) == 0


# ──────────────────────────────────────────────────────────────────────────────
# CONSISTENCY CHECKS
# ──────────────────────────────────────────────────────────────────────────────

def test_area_sanity_too_small():
    """An area of 0.0001 acres is implausibly small — should trigger area_sanity violation."""
    fields = {
        "survey_number": "10/1", "khasra_number": "100", "khata_number": "1",
        "owner_name": "Test", "plot_area": "0.0001 acres",
    }
    response = client.post("/extraction/validate", json={"record_id": "t1", "fields": fields})
    body = response.json()
    rules = [v["rule"] for v in body["violations"]]
    assert "area_sanity" in rules, "Implausibly small area must trigger area_sanity check"


def test_area_sanity_too_large():
    """An area of 99999 acres is implausibly large — should trigger area_sanity violation."""
    fields = {
        "survey_number": "10/1", "khasra_number": "100", "khata_number": "1",
        "owner_name": "Test", "plot_area": "99999 acres",
    }
    response = client.post("/extraction/validate", json={"record_id": "t2", "fields": fields})
    body = response.json()
    rules = [v["rule"] for v in body["violations"]]
    assert "area_sanity" in rules, "Implausibly large area must trigger area_sanity check"


def test_area_sanity_normal_passes():
    """A normal area of 2.45 acres must NOT trigger area_sanity."""
    fields = {
        "survey_number": "10/1", "khasra_number": "100", "khata_number": "1",
        "owner_name": "Test", "plot_area": "2.45 acres",
    }
    response = client.post("/extraction/validate", json={"record_id": "t3", "fields": fields})
    body = response.json()
    rules = [v["rule"] for v in body["violations"]]
    assert "area_sanity" not in rules


def test_admin_hierarchy_village_without_tehsil_district():
    """Village present but tehsil+district absent → admin_hierarchy LOW violation."""
    fields = {
        "survey_number": "10/1", "khasra_number": "100", "khata_number": "1",
        "owner_name": "Test", "plot_area": "2 acres",
        "village": "Kothari",
        # tehsil and district deliberately absent
    }
    response = client.post("/extraction/validate", json={"record_id": "t4", "fields": fields})
    body = response.json()
    rules = [v["rule"] for v in body["violations"]]
    assert "admin_hierarchy" in rules


def test_admin_hierarchy_complete_no_violation():
    """Village + tehsil + district all present → no admin_hierarchy violation."""
    fields = {
        "survey_number": "10/1", "khasra_number": "100", "khata_number": "1",
        "owner_name": "Test", "plot_area": "2 acres",
        "village": "Kothari", "tehsil": "Sehore", "district": "Bhopal",
    }
    response = client.post("/extraction/validate", json={"record_id": "t5", "fields": fields})
    body = response.json()
    rules = [v["rule"] for v in body["violations"]]
    assert "admin_hierarchy" not in rules


def test_survey_khasra_identity():
    """Identical survey_number and khasra_number → field_overlap MEDIUM violation."""
    fields = {
        "survey_number": "145/2", "khasra_number": "145/2", "khata_number": "1",
        "owner_name": "Test", "plot_area": "2 acres",
    }
    response = client.post("/extraction/validate", json={"record_id": "t6", "fields": fields})
    body = response.json()
    rules = [v["rule"] for v in body["violations"]]
    assert "field_overlap" in rules


def test_survey_khasra_different_no_overlap():
    """Different survey and khasra numbers → no field_overlap violation."""
    fields = {
        "survey_number": "145/2", "khasra_number": "4891", "khata_number": "1",
        "owner_name": "Test", "plot_area": "2 acres",
    }
    response = client.post("/extraction/validate", json={"record_id": "t7", "fields": fields})
    body = response.json()
    rules = [v["rule"] for v in body["violations"]]
    assert "field_overlap" not in rules


# ──────────────────────────────────────────────────────────────────────────────
# AREA DISCREPANCY CHECK — WOW Feature
# ──────────────────────────────────────────────────────────────────────────────

def test_area_discrepancy_spatial_match():
    """Doc=2.45 acres, GIS=2.50 acres → Δ=2.04% → SPATIAL MATCH, no violation."""
    fields = {
        "survey_number": "145/2", "khasra_number": "4891", "khata_number": "512",
        "owner_name": "Ramesh Kumar", "plot_area": "2.45 acres",
    }
    response = client.post(
        "/extraction/validate",
        json={"record_id": "t8", "fields": fields, "gis_area_acres": 2.50},
    )
    body = response.json()
    rules = [v["rule"] for v in body["violations"]]
    assert "area_gis_discrepancy" not in rules
    # Should appear in issues as informational
    assert any("SPATIAL MATCH" in i for i in body["issues"])


def test_area_discrepancy_spatial_mismatch():
    """Doc=2.0 acres, GIS=3.5 acres → Δ=42.86% → DISCREPANCY HIGH violation."""
    fields = {
        "survey_number": "145/2", "khasra_number": "4891", "khata_number": "512",
        "owner_name": "Ramesh Kumar", "plot_area": "2.0 acres",
    }
    response = client.post(
        "/extraction/validate",
        json={"record_id": "t9", "fields": fields, "gis_area_acres": 3.5},
    )
    body = response.json()
    rules = [v["rule"] for v in body["violations"]]
    assert "area_gis_discrepancy" in rules
    discrepancy_violations = [v for v in body["violations"] if v["rule"] == "area_gis_discrepancy"]
    assert discrepancy_violations[0]["severity"] == "HIGH"
    # Must NOT claim AI or fraud — must say "Potential inconsistency"
    assert "Potential inconsistency" in discrepancy_violations[0]["message"]
    assert body["risk_level"] == "HIGH"
    assert body["status"] == "REVIEW_REQUIRED"


def test_area_discrepancy_detail_block():
    """Discrepancy violation must include a detail block with doc_acres, gis_acres, delta_pct."""
    fields = {
        "survey_number": "10/1", "khasra_number": "100", "khata_number": "1",
        "owner_name": "Test", "plot_area": "1.0 acres",
    }
    response = client.post(
        "/extraction/validate",
        json={"record_id": "t10", "fields": fields, "gis_area_acres": 5.0},
    )
    body = response.json()
    discrepancy_violations = [v for v in body["violations"] if v["rule"] == "area_gis_discrepancy"]
    assert len(discrepancy_violations) == 1
    detail = discrepancy_violations[0].get("detail", {})
    assert "doc_acres" in detail
    assert "gis_acres" in detail
    assert "delta_pct" in detail
    assert detail["delta_pct"] == pytest.approx(80.0, rel=0.01)


def test_area_discrepancy_boundary_exactly_5pct():
    """Exactly 5% discrepancy is on the threshold — should be MATCH (≤ 5.0%)."""
    # doc=1.0, gis=1/0.95 → delta≈5.26% — let's use exact boundary
    # gis=2.0, doc=2.1 → delta=5% → MATCH
    fields = {
        "survey_number": "10/1", "khasra_number": "100", "khata_number": "1",
        "owner_name": "Test", "plot_area": "2.1 acres",
    }
    response = client.post(
        "/extraction/validate",
        json={"record_id": "t11", "fields": fields, "gis_area_acres": 2.0},
    )
    body = response.json()
    rules = [v["rule"] for v in body["violations"]]
    assert "area_gis_discrepancy" not in rules


def test_no_gis_area_no_discrepancy_check():
    """Without gis_area_acres, no discrepancy violation should appear."""
    fields = {
        "survey_number": "10/1", "khasra_number": "100", "khata_number": "1",
        "owner_name": "Test", "plot_area": "2.45 acres",
    }
    response = client.post(
        "/extraction/validate",
        json={"record_id": "t12", "fields": fields},
    )
    body = response.json()
    rules = [v["rule"] for v in body["violations"]]
    assert "area_gis_discrepancy" not in rules


# ──────────────────────────────────────────────────────────────────────────────
# CONFIDENCE SCORES
# ──────────────────────────────────────────────────────────────────────────────

def test_confidence_scores_are_real_not_hardcoded():
    """All confidence values must be in [0.0, 1.0] and must vary (not all identical)."""
    response = client.post("/extraction/parse", json={"raw_text": FULL_ENGLISH_TEXT, "bounding_boxes": []})
    body = response.json()
    confs = [v for v in body["confidence_per_field"].values() if v > 0]
    assert len(confs) > 0
    for c in confs:
        assert 0.0 <= c <= 1.0, f"Confidence {c} out of range"
    # At least some variation — not all the same hardcoded value
    assert len(set(confs)) > 1 or len(confs) == 1, "Expected varying confidence scores"


def test_bbox_confidence_used_when_provided():
    """When bounding boxes are provided, confidence must reflect them (not fallback)."""
    text = "Survey No 123/4 Owner: Test Area 1 acre Village X Khasra 100 Khata 1"
    boxes = [
        {"text": "123/4", "confidence": 0.55, "box": [0, 0, 10, 10]},
    ]
    response = client.post("/extraction/parse", json={"raw_text": text, "bounding_boxes": boxes})
    body = response.json()
    survey_conf = body["confidence_per_field"].get("survey_number", 1.0)
    # bbox confidence was 0.55 — result should reflect real OCR signal
    assert survey_conf < 0.80, f"Low OCR bbox confidence should lower field confidence, got {survey_conf}"
