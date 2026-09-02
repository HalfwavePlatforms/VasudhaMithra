import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

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
