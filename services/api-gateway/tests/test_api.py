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
