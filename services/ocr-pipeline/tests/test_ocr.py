import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_extract_rejects_invalid_image():
    response = client.post(
        "/ocr/extract", json={"image_base64": "not_valid_base64!!", "language_hint": "en"}
    )
    assert response.status_code == 422
