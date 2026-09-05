# services/gis-service/tests/test_gis.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health():
    data = client.get("/health").json()
    assert data.get("status") == "ok"
    assert "tier" in data
    assert "mode" in data
    assert data["mode"] in ("PostGIS: live", "PostGIS: unavailable, using seeded fallback")


def test_get_seeded_parcel():
    response = client.get("/gis/parcel/145/2")
    assert response.status_code == 200

    body = response.json()
    assert body.get("status") == "FOUND"
    assert "area_gis" in body
    assert "geometry" in body


def test_get_nonexistent_parcel_returns_404():
    response = client.get("/gis/parcel/NONEXISTENT_99999")
    assert response.status_code == 404