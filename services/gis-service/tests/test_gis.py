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


def test_get_cadastral_engine_parcel():
    # Survey number not in seeded dataset with Kannada village/district metadata
    response = client.get(
        "/gis/parcel/452",
        params={
            "village": "ಅದಲಗೆರೆ",
            "tehsil": "ಗುಬ್ಬಿ",
            "district": "ತುಮಕೂರು",
            "state": "Karnataka",
            "area_acres": 1.15,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body.get("status") == "FOUND"
    assert body.get("survey_number") == "452"
    assert body.get("area_gis") == 1.15
    assert body.get("source") in ("cadastral_spatial_engine", "osm_nominatim_dynamic_cadastre")
    assert body["geometry"]["type"] == "Polygon"
    assert len(body["geometry"]["coordinates"][0]) >= 4
    # Centroid should be in Karnataka vicinity (~12-14 deg N, ~75-78 deg E)
    centroid = body.get("centroid")
    assert 12.0 <= centroid[0] <= 16.0
    assert 74.0 <= centroid[1] <= 78.0
    assert "official_portal" in body["metadata"]
    assert "kgis" in body["metadata"]["official_portal"]["portal_url"] or "bhuvan" in body["metadata"]["official_portal"]["portal_url"]


def test_get_spatial_portals():
    response = client.get("/gis/spatial-portals")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "karnataka" in data["portals"]
    assert "national" in data["portals"]
    assert "kgis.ksrsac.in" in data["portals"]["karnataka"]["portal_url"]
    assert "bhuvan" in data["portals"]["national"]["portal_url"]