"""
Test suite for Local Government Directory (LGD) Canonicalization and Resolution.

Rebuilding / updating the LGD SQLite Index:
-------------------------------------------
1. Download official LGD data (or use bundled seed):
   $ python data/lgd/download_lgd.py
2. Build optimized SQLite database index:
   $ python data/lgd/build_lgd_index.py
   This populates:
   - services/gis-service/src/data/lgd_index.seed.db (bundled seed fixture, ~320 villages)
   - services/gis-service/src/data/lgd_index.db (full national directory, ~677,400 villages)
"""

import os
import sys

src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
if sys.path[0] != src_dir:
    sys.path.insert(0, src_dir)

from fastapi.testclient import TestClient
from main import app, _resolve_lgd_code

client = TestClient(app)


def test_lgd_exact_match():
    """
    Verify exact match on a real village from LGD index.
    Should return match_confidence='exact', canonical names, and valid LGD code.
    """
    # 1. Direct function call
    match = _resolve_lgd_code(
        village="Adalagere",
        tehsil="Gubbi",
        district="Tumakuru",
        state="Karnataka",
    )
    assert match is not None
    assert match["village_lgd_code"] == "611765"
    assert match["canonical_village"] == "Adalagere"
    assert match["canonical_district"] == "Tumakuru"
    assert match["match_confidence"] == "exact"

    # 2. Transliterated / alias match (Tumkur -> Tumakuru)
    match_alias = _resolve_lgd_code(
        village="Adalagere",
        district="Tumkur",
        state="Karnataka",
    )
    assert match_alias is not None
    assert match_alias["village_lgd_code"] == "611765"
    assert match_alias["match_confidence"] == "exact"

    # 3. HTTP endpoint test
    resp = client.get(
        "/gis/resolve-lgd",
        params={"village": "Hongasandra", "district": "Bengaluru Urban", "state": "Karnataka"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body.get("status") == "ok"
    assert body["match"]["village_lgd_code"] == "938422"
    assert body["match"]["match_confidence"] == "exact"


def test_lgd_fuzzy_match():
    """
    Verify fuzzy match on slightly misspelled village name (e.g. 'Adalagre').
    Should resolve to correct canonical village with match_confidence='fuzzy'.
    """
    match = _resolve_lgd_code(
        village="Adalagre",
        district="Tumkur",
        state="Karnataka",
    )
    assert match is not None
    assert match["canonical_village"] == "Adalagere"
    assert match["village_lgd_code"] == "611765"
    assert match["match_confidence"] == "fuzzy"


def test_lgd_unindexed_village_fallback():
    """
    Verify that an unindexed / fictitious village returns None from _resolve_lgd_code,
    and get_parcel gracefully falls through to Tiers 3/4 without raising errors.
    """
    # 1. Unindexed village returns None
    match = _resolve_lgd_code(
        village="NonExistentVillageXYZ999",
        district="UnknownDistrict",
        state="Karnataka",
    )
    assert match is None

    # 2. Endpoint returns not_found
    resp = client.get(
        "/gis/resolve-lgd",
        params={"village": "NonExistentVillageXYZ999", "state": "Karnataka"},
    )
    assert resp.status_code == 200
    assert resp.json().get("status") == "not_found"

    # 3. get_parcel still resolves through cadastral fallback engine (strictly additive, no crash)
    parcel_resp = client.get(
        "/gis/parcel/UNINDEXED_777",
        params={
            "village": "NonExistentVillageXYZ999",
            "state": "Karnataka",
            "area_acres": 2.5,
        },
    )
    assert parcel_resp.status_code == 200
    parcel_body = parcel_resp.json()
    assert parcel_body.get("status") == "FOUND"
    assert parcel_body.get("source") in ("cadastral_spatial_engine", "osm_nominatim_dynamic_cadastre")
    # Metadata should have null/None for LGD fields
    meta = parcel_body.get("metadata", {})
    assert meta.get("village_lgd_code") is None
    assert meta.get("match_confidence") is None


def test_get_parcel_with_lgd_integration():
    """
    Verify get_parcel returns enriched metadata with village_lgd_code when LGD matches,
    and null/None when not matching.
    """
    # Case A: Matching village in Karnataka
    resp_match = client.get(
        "/gis/parcel/LGDSURVEY_101",
        params={
            "village": "Hongasandra",
            "district": "Bengaluru Urban",
            "state": "Karnataka",
            "area_acres": 1.75,
        },
    )
    assert resp_match.status_code == 200
    body_match = resp_match.json()
    assert body_match.get("status") == "FOUND"
    meta_match = body_match.get("metadata", {})
    assert meta_match.get("village_lgd_code") == "938422"
    assert meta_match.get("canonical_village") == "Hongasandra"
    assert meta_match.get("match_confidence") == "exact"

    # Case B: Non-matching village
    resp_no_match = client.get(
        "/gis/parcel/LGDSURVEY_102",
        params={
            "village": "CompletelyFictitiousPlaceName",
            "state": "Karnataka",
            "area_acres": 1.2,
        },
    )
    assert resp_no_match.status_code == 200
    body_no_match = resp_no_match.json()
    assert body_no_match.get("status") == "FOUND"
    meta_no_match = body_no_match.get("metadata", {})
    assert meta_no_match.get("village_lgd_code") is None
    assert meta_no_match.get("match_confidence") is None
