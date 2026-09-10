import os
import sys
import uuid
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from main import app
from database import SessionLocal
from models.db_models import Record, RecordField

client = TestClient(app)


@pytest.fixture(scope="module")
def setup_test_records():
    db = SessionLocal()
    try:
        # 1. Ensure a validated Kannada record exists for 145/2
        rec_kn = db.query(Record).filter(
            Record.fields.any((RecordField.field_name == "survey_number") & (RecordField.field_value == "145/2"))
        ).first()
        if not rec_kn:
            rec_kn = Record(
                id=uuid.uuid4(),
                original_filename="kannada_rtc_145.pdf",
                status="validated",
                language="kn",
                state="Karnataka",
            )
            db.add(rec_kn)
            db.flush()
            db.add_all([
                RecordField(id=uuid.uuid4(), record_id=rec_kn.id, field_name="survey_number", field_value="145/2"),
                RecordField(id=uuid.uuid4(), record_id=rec_kn.id, field_name="owner_name", field_value="Basavaraja Hegde"),
                RecordField(id=uuid.uuid4(), record_id=rec_kn.id, field_name="land_classification", field_value="Dry Land"),
                RecordField(id=uuid.uuid4(), record_id=rec_kn.id, field_name="village", field_value="Halebeedu"),
                RecordField(id=uuid.uuid4(), record_id=rec_kn.id, field_name="district", field_value="Hassan"),
            ])
            db.commit()

        # 2. Ensure a validated Hindi record exists for 45/A
        rec_hi = db.query(Record).filter(
            Record.fields.any((RecordField.field_name == "survey_number") & (RecordField.field_value == "45/A"))
        ).first()
        if not rec_hi:
            rec_hi = Record(
                id=uuid.uuid4(),
                original_filename="hindi_khasra_45.pdf",
                status="validated",
                language="hi",
                state="Madhya Pradesh",
            )
            db.add(rec_hi)
            db.flush()
            db.add_all([
                RecordField(id=uuid.uuid4(), record_id=rec_hi.id, field_name="survey_number", field_value="45/A"),
                RecordField(id=uuid.uuid4(), record_id=rec_hi.id, field_name="owner_name", field_value="रामेश कुमार"),
                RecordField(id=uuid.uuid4(), record_id=rec_hi.id, field_name="land_classification", field_value="कृषि भूमि"),
                RecordField(id=uuid.uuid4(), record_id=rec_hi.id, field_name="village", field_value="रामपुर"),
                RecordField(id=uuid.uuid4(), record_id=rec_hi.id, field_name="district", field_value="भोपाल"),
            ])
            db.commit()

        yield
    finally:
        db.close()


def test_voice_query_hindi_owner(setup_test_records):
    """
    Test Step 7: Real spoken query in Hindi asking for owner of survey 45/A.
    Verifies transcription text is parsed, real owner looked up, and Hindi response composed.
    """
    response = client.post(
        "/public/voice-query",
        json={"query_text": "सर्वे नंबर 45/A का मालिक कौन है?", "language": "hi"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["parsed"]["survey_number"] == "45/A"
    assert data["parsed"]["query_type"] == "owner"
    assert data["record_found"] is True
    assert "रामेश कुमार" in data["data"]["owner_name"]
    assert "रामेश कुमार" in data["spoken_response"]
    assert "पंजीकृत है" in data["spoken_response"]


def test_voice_query_kannada_status(setup_test_records):
    """
    Test Step 7: Real spoken query in Kannada asking for status of survey 145/2.
    Verifies transcription text is parsed, real status looked up, and Kannada response composed.
    """
    response = client.post(
        "/public/voice-query",
        json={"query_text": "ಸರ್ವೆ ನಂಬರ್ 145/2 ಸ್ಥಿತಿ ಏನು?", "language": "kn"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["parsed"]["survey_number"] == "145/2"
    assert data["parsed"]["query_type"] == "status"
    assert data["record_found"] is True
    assert data["data"]["status"] == "validated"
    assert "ಸರ್ವೆ ನಂಬರ್ 145/2" in data["spoken_response"]
    assert "ಅಂಗೀಕರಿಸಲಾಗಿದೆ" in data["spoken_response"] or "ಪರಿಶೀಲಿಸಿ" in data["spoken_response"]


def test_voice_query_english_dispute(setup_test_records):
    """
    Verifies dispute queries extract correctly and return honest dispute / spatial consistency facts.
    """
    response = client.post(
        "/public/voice-query",
        json={"query_text": "Is there any dispute on survey number 145/2?", "language": "en"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["parsed"]["survey_number"] == "145/2"
    assert data["parsed"]["query_type"] == "dispute"
    assert data["record_found"] is True
    assert "dispute" in data["spoken_response"].lower()


def test_voice_query_not_found_honest_response():
    """
    Step 3: If no record matches the survey_number, return an honest
    'No digitized record found for that survey number' response — NEVER let the LLM fabricate.
    """
    response = client.post(
        "/public/voice-query",
        json={"query_text": "What is the status of survey number 9999/9999?", "language": "en"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["record_found"] is False
    assert data["data"] is None
    assert "No digitized record was found for survey number 9999/9999" in data["spoken_response"]


def test_voice_query_no_survey_number():
    """
    If no survey number is mentioned, ask citizen to specify it.
    """
    response = client.post(
        "/public/voice-query",
        json={"query_text": "Please tell me the status of my land", "language": "en"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["parsed"]["survey_number"] is None
    assert "mention your land survey number" in data["spoken_response"].lower()


def test_voice_query_privacy_discipline(setup_test_records):
    """
    Step 5: Public-safe data only — excludes sensitive internal fields
    (raw_ocr_text, ocr_confidence, reviewer_notes, confidence, etc.).
    """
    response = client.post(
        "/public/voice-query",
        json={"query_text": "Who is the owner of survey number 145/2?", "language": "en"},
    )
    assert response.status_code == 200
    res_str = response.text.lower()
    assert "raw_ocr_text" not in res_str
    assert "ocr_confidence" not in res_str
    assert "reviewer_notes" not in res_str
    assert "confidence" not in res_str


def test_voice_query_manual_override_fallback(setup_test_records):
    """
    Step 6: Text fallback where user supplies survey_number directly.
    """
    response = client.post(
        "/public/voice-query",
        json={
            "query_text": "what is the land classification?",
            "survey_number_override": "145/2",
            "language": "en",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["parsed"]["survey_number"] == "145/2"
    assert data["parsed"]["query_type"] == "classification"
    assert data["record_found"] is True
    assert "Dry Land" in data["spoken_response"]
