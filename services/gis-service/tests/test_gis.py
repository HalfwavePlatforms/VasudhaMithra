"""
GIS Service tests — runs fully standalone (no PostGIS / no DATABASE_URL needed).
All tests use the seeded JSON fallback tier.
"""
import sys
import os

# Point to src/ so `main` is importable without a package install
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

# Survey numbers that exist in seeded_parcels.json
KNOWN_SNS = ["145/2", "72/3", "210/1A", "33/5B", "88/2", "19/6", "54/1", "301/4", "7/9A", "501/3C"]

# ── Health ─────────────────────────────────────────────────────────────────────

def test_health_ok():
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    # Without DATABASE_URL, must fall back to seeded_json tier
    assert body["tier"] == "seeded_json"
    assert body["seeded_parcel_count"] == 10


# ── Parcel lookup — known survey numbers ──────────────────────────────────────

@pytest.mark.parametrize("sn", KNOWN_SNS)
def test_known_parcel_returns_200(sn):
    resp = client.get(f"/gis/parcel/{sn}")
    assert resp.status_code == 200, f"Survey number {sn!r} must be found in seeded data"


@pytest.mark.parametrize("sn", KNOWN_SNS)
def test_parcel_response_schema(sn):
    """All seeded parcels must return the full API contract shape."""
    resp = client.get(f"/gis/parcel/{sn}")
    body = resp.json()
    assert "parcel_id" in body
    assert "survey_number" in body
    assert "area_gis" in body
    assert "area_unit" in body
    assert body["area_unit"] == "acre"
    assert "centroid" in body
    assert len(body["centroid"]) == 2
    assert "geometry" in body
    assert body["geometry"]["type"] == "Polygon"
    assert "coordinates" in body["geometry"]
    assert "status" in body
    assert body["status"] == "FOUND"
    assert "source" in body


@pytest.mark.parametrize("sn", KNOWN_SNS)
def test_source_is_seeded_demo_data(sn):
    """source must always be 'seeded_demo_data' — never 'synthetic_cadastral_layer (demo prototype)'."""
    resp = client.get(f"/gis/parcel/{sn}")
    body = resp.json()
    assert body["source"] == "seeded_demo_data", (
        f"source must be 'seeded_demo_data', got '{body['source']}'"
    )


def test_area_gis_is_positive_float():
    resp = client.get("/gis/parcel/145/2")
    body = resp.json()
    assert isinstance(body["area_gis"], float)
    assert body["area_gis"] > 0.0


def test_area_matches_seeded_value():
    """145/2 is seeded at 2.47 acres — area_gis must reflect that exactly."""
    resp = client.get("/gis/parcel/145/2")
    body = resp.json()
    assert body["area_gis"] == pytest.approx(2.47, rel=0.01)


# ── Area discrepancy — seeded areas support the WOW feature ───────────────────

def test_area_discrepancy_seeded_records():
    """
    For ≥ 3 seeded records, confirm area_gis is a positive float that could
    be used for the area discrepancy check in the extraction engine.
    This tests that the GIS service provides real (non-zero, non-random) areas
    that are consistent across calls.
    """
    areas_seen = set()
    for sn in KNOWN_SNS[:5]:
        resp = client.get(f"/gis/parcel/{sn}")
        body = resp.json()
        area = body["area_gis"]
        assert area > 0.0, f"area_gis for {sn} must be > 0"
        areas_seen.add(area)
    # All 5 parcels must have distinct areas (not random-seeded the same)
    assert len(areas_seen) == 5, "Each seeded parcel must have a distinct area_gis"


def test_area_is_deterministic():
    """Same survey number must always return the same area (not random)."""
    r1 = client.get("/gis/parcel/88/2").json()["area_gis"]
    r2 = client.get("/gis/parcel/88/2").json()["area_gis"]
    assert r1 == r2, "area_gis must be deterministic for a given survey number"


# ── Unknown survey number ─────────────────────────────────────────────────────

def test_unknown_parcel_returns_404():
    resp = client.get("/gis/parcel/UNKNOWN-9999")
    assert resp.status_code == 404


def test_unknown_parcel_detail():
    resp = client.get("/gis/parcel/UNKNOWN-9999")
    detail = resp.json()["detail"]
    assert detail["status"] == "NOT_FOUND"
    assert "survey_number" in detail


# ── List endpoint ─────────────────────────────────────────────────────────────

def test_list_parcels_returns_all_10():
    resp = client.get("/gis/parcels")
    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] == 10
    assert len(body["parcels"]) == 10


def test_list_parcels_schema():
    resp = client.get("/gis/parcels")
    for p in resp.json()["parcels"]:
        assert "parcel_id" in p
        assert "survey_number" in p
        assert "area_acres" in p
        assert "source" in p
        assert p["source"] == "seeded_demo_data"


# ── Geometry validity ─────────────────────────────────────────────────────────

def test_polygon_is_closed():
    """GeoJSON Polygon rings must have first == last coordinate."""
    for sn in KNOWN_SNS:
        resp = client.get(f"/gis/parcel/{sn}")
        coords = resp.json()["geometry"]["coordinates"][0]
        assert coords[0] == coords[-1], f"Polygon ring for {sn} must be closed (first == last)"


def test_centroid_is_valid_lat_lon():
    for sn in KNOWN_SNS:
        resp = client.get(f"/gis/parcel/{sn}")
        lat, lon = resp.json()["centroid"]
        assert -90 <= lat <= 90, f"Centroid lat {lat} out of range for {sn}"
        assert -180 <= lon <= 180, f"Centroid lon {lon} out of range for {sn}"


def test_india_centroid_bounds():
    """All seeded parcels are in India — centroids must be within Indian bbox."""
    # India rough bbox: lat 8–37, lon 68–97
    for sn in KNOWN_SNS:
        resp = client.get(f"/gis/parcel/{sn}")
        lat, lon = resp.json()["centroid"]
        assert 8.0 <= lat <= 37.0, f"Centroid lat {lat} outside India for {sn}"
        assert 68.0 <= lon <= 97.0, f"Centroid lon {lon} outside India for {sn}"
