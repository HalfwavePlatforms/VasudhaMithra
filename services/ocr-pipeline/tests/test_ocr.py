import base64
import io
import os
import sys
from PIL import Image

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


def test_extract_valid_image():
    # Generate a small test PNG
    img = Image.new("RGB", (200, 100), color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    response = client.post("/ocr/extract", json={"image_base64": b64, "language_hint": "en"})
    assert response.status_code == 200
    data = response.json()
    assert "raw_text" in data
    assert "confidence" in data
    assert "bounding_boxes" in data
    assert "document_type" in data
    assert "handwriting" in data


def test_extract_valid_pdf():
    # Generate a dummy 1-page PDF using PIL
    img = Image.new("RGB", (200, 100), color="white")
    buf = io.BytesIO()
    img.save(buf, format="PDF")
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    response = client.post("/ocr/extract", json={"image_base64": b64, "language_hint": "en"})
    assert response.status_code == 200
    data = response.json()
    assert "raw_text" in data
    assert data["metadata"].get("is_pdf") is True
    assert data["pages"] == 1


def test_extract_multipage_pdf():
    # Generate a 2-page PDF using PIL
    img1 = Image.new("RGB", (200, 100), color="white")
    img2 = Image.new("RGB", (200, 100), color="white")
    buf = io.BytesIO()
    img1.save(buf, format="PDF", save_all=True, append_images=[img2])
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    response = client.post("/ocr/extract", json={"image_base64": b64, "language_hint": "en"})
    assert response.status_code == 200
    data = response.json()
    assert data["pages"] == 2
    assert "--- Page 1 ---" in data["raw_text"]
    assert "--- Page 2 ---" in data["raw_text"]
    assert data["metadata"].get("is_pdf") is True
    assert len(data["metadata"]["page_details"]) == 2


