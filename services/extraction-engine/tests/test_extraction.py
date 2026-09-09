import sys
import os

src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
if sys.path[0] != src_dir:
    sys.path.insert(0, src_dir)
sys.modules.pop("main", None)

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_parse_extracts_survey_number():
    sample_text = "Survey No 123/4A Owner: Ramesh Kumar Area 2.5 acre Village Kothari"
    response = client.post("/extraction/parse", json={"raw_text": sample_text, "bounding_boxes": []})
    assert response.status_code == 200
    body = response.json()
    assert body["fields"]["survey_number"] is not None


def test_validate_flags_missing_required_field():
    response = client.post(
        "/extraction/validate",
        json={"record_id": "test-id", "fields": {"survey_number": None}},
    )
    body = response.json()
    assert body["valid"] is False
    assert any(v["rule"] == "required" for v in body["violations"])


def test_low_confidence_document_triggers_llm_mock():
    """Confirms low-confidence document triggers LLM fallback when LLM_PROVIDER is mock."""
    os.environ["LLM_PROVIDER"] = "mock"
    import llm_extractor
    llm_extractor.reset_llm_call_count()

    # Raw OCR text with low confidence tokens and partial info (34/2B with 1.75 acre)
    sample_text = "Faded register page fragment: 34/2B and 1.75 acre recorded."
    # Low confidence bounding box to keep overall document confidence well below 0.75
    bboxes = [
        {"text": "Faded", "confidence": 0.20, "box": [0, 0, 10, 10]},
        {"text": "register", "confidence": 0.25, "box": [11, 0, 20, 10]},
    ]

    response = client.post(
        "/extraction/parse",
        json={"raw_text": sample_text, "bounding_boxes": bboxes},
    )
    assert response.status_code == 200
    body = response.json()

    # Verify LLM was triggered
    assert llm_extractor.get_llm_call_count() >= 1
    assert body.get("ai_fallback_triggered") is True
    assert "extraction_source" in body
    # survey_number or plot_area matched by mock provider
    assert body["fields"]["survey_number"] == "34/2B"
    assert body["extraction_source"]["survey_number"] == "llm"
    assert body["extraction_source"].get("owner_name") in ("rules", "llm")

