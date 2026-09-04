"""
GIS Service — Cadastral Layer & Spatial Parcel Lookup for SIH 26018.

Two-tier lookup architecture:
  Tier 1 (PostGIS, when DATABASE_URL env var is set):
      SELECT survey_number, ST_AsGeoJSON(geom), ST_Area(geography(geom)) / 4046.86 AS area_acres
      FROM parcels WHERE survey_number = :sn
      Uses GeoAlchemy2 + SQLAlchemy. Falls back to Tier 2 if DB is unreachable.

  Tier 2 (Seeded JSON, always available — standalone dev / CI):
      Reads src/data/seeded_parcels.json — 10 real village polygons, hand-drawn over
      actual Indian cadastral geography. Labeled "source": "seeded_demo_data".

Area discrepancy integration:
  The returned area_gis (in acres) is consumed by the API Gateway when calling
  POST /extraction/validate with gis_area_acres= to trigger the document vs GIS
  spatial consistency check.

No fake confidence or AI fraud claims: this service returns spatial facts only.
"""
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException

# ── Data paths ────────────────────────────────────────────────────────────────
# Resolve relative to this file so it works from any working directory
_SRC_DIR = Path(__file__).parent
_DATA_DIR = _SRC_DIR / "data"
_SEEDED_FILE = _DATA_DIR / "seeded_parcels.json"

# Shared in-memory index (survey_number → parcel dict)
_SEEDED_INDEX: dict[str, dict] = {}


def _normalise_sn(sn: str) -> str:
    """Normalise survey number for consistent lookup: strip whitespace, lowercase."""
    return sn.strip().lower().replace(" ", "")


def _build_seeded_index() -> dict[str, dict]:
    if not _SEEDED_FILE.exists():
        return {}
    with open(_SEEDED_FILE, "r", encoding="utf-8") as f:
        parcels = json.load(f)
    return {_normalise_sn(p["survey_number"]): p for p in parcels}


# ── FastAPI lifespan (replaces deprecated on_event) ──────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _SEEDED_INDEX
    _SEEDED_INDEX = _build_seeded_index()
    yield
    # No cleanup needed


app = FastAPI(title="GIS Cadastral Service", lifespan=lifespan)


# ── PostGIS helpers ───────────────────────────────────────────────────────────

def _get_db_engine():
    """
    Returns a SQLAlchemy engine if DATABASE_URL is set, else None.
    Importing SQLAlchemy/GeoAlchemy2 is deferred so the service starts
    cleanly without them when running in standalone/JSON-only mode.
    """
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        return None
    try:
        from sqlalchemy import create_engine
        return create_engine(db_url, pool_pre_ping=True)
    except Exception:
        return None


def _query_postgis(survey_number: str) -> Optional[dict]:
    """
    Query the `parcels` table via PostGIS.
    Returns a parcel dict or None if not found / DB unavailable.

    Schema (see docs/gis.md SCHEMA REQUEST):
        survey_number TEXT (indexed)
        geom          GEOMETRY(Polygon, 4326)
        area_sqm      FLOAT
    """
    engine = _get_db_engine()
    if engine is None:
        return None

    try:
        from sqlalchemy import text
        query = text(
            """
            SELECT
                survey_number,
                ST_AsGeoJSON(geom)::text AS geojson,
                ST_Area(geography(geom)) / 4046.86   AS area_acres,
                ST_X(ST_Centroid(geom))               AS centroid_lon,
                ST_Y(ST_Centroid(geom))               AS centroid_lat
            FROM parcels
            WHERE survey_number = :sn
            LIMIT 1
            """
        )
        with engine.connect() as conn:
            row = conn.execute(query, {"sn": survey_number}).fetchone()

        if row is None:
            return None

        geom = json.loads(row.geojson)
        return {
            "parcel_id": f"PARCEL-{survey_number.replace('/', '-')}",
            "survey_number": survey_number,
            "area_gis": round(row.area_acres, 4),
            "area_unit": "acre",
            "centroid": [round(row.centroid_lat, 6), round(row.centroid_lon, 6)],
            "geometry": geom,
            "status": "FOUND",
            "source": "seeded_demo_data",
        }
    except Exception:
        # DB unavailable — fall through to JSON tier
        return None


def _query_seeded(survey_number: str) -> Optional[dict]:
    """Look up survey_number in the seeded JSON index."""
    # Ensure index is loaded (handles case where lifespan hasn't fired, e.g. tests)
    global _SEEDED_INDEX
    if not _SEEDED_INDEX:
        _SEEDED_INDEX = _build_seeded_index()

    key = _normalise_sn(survey_number)
    parcel = _SEEDED_INDEX.get(key)
    if parcel is None:
        return None

    geom = parcel["geometry"]
    coords = geom["coordinates"][0]

    # Compute centroid from polygon ring average (exclude closing duplicate vertex)
    lons = [c[0] for c in coords[:-1]]
    lats = [c[1] for c in coords[:-1]]
    centroid_lat = round(sum(lats) / len(lats), 6)
    centroid_lon = round(sum(lons) / len(lons), 6)

    return {
        "parcel_id": parcel["parcel_id"],
        "survey_number": parcel["survey_number"],
        "area_gis": float(parcel["area_acres"]),
        "area_unit": "acre",
        "centroid": [centroid_lat, centroid_lon],
        "geometry": geom,
        "status": "FOUND",
        "source": parcel["source"],  # always "seeded_demo_data"
        "metadata": {
            "village": parcel.get("village"),
            "tehsil": parcel.get("tehsil"),
            "district": parcel.get("district"),
            "state": parcel.get("state"),
        },
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    # Eagerly build the index if not yet populated (handles TestClient / late init)
    global _SEEDED_INDEX
    if not _SEEDED_INDEX:
        _SEEDED_INDEX = _build_seeded_index()
    db_available = _get_db_engine() is not None
    return {
        "status": "ok",
        "tier": "postgis" if db_available else "seeded_json",
        "seeded_parcel_count": len(_SEEDED_INDEX),
    }


@app.get("/gis/parcel/{survey_number:path}")
def get_parcel(survey_number: str):
    """
    Returns cadastral parcel geometry and area for a given survey number.

    Lookup order:
      1. PostGIS `parcels` table (when DATABASE_URL is set and DB reachable)
      2. Seeded JSON file (standalone fallback — always available)

    Response always includes `source` field:
      "seeded_demo_data" — synthetic demo parcel (hand-drawn, labeled explicitly)
    """
    clean_sn = survey_number.strip().replace(" ", "")

    # Tier 1: PostGIS
    result = _query_postgis(clean_sn)

    # Tier 2: Seeded JSON fallback
    if result is None:
        result = _query_seeded(clean_sn)

    if result is None:
        raise HTTPException(
            status_code=404,
            detail={
                "status": "NOT_FOUND",
                "survey_number": clean_sn,
                "message": (
                    f"No cadastral parcel found for survey number '{clean_sn}'. "
                    "Parcel may not be in the seeded demo dataset. "
                    "Add it to src/data/seeded_parcels.json or apply the PostGIS schema."
                ),
            },
        )

    return result


@app.get("/gis/parcels")
def list_parcels():
    """
    List all seeded demo parcels. Useful for development and testing.
    In production this would be replaced by a paginated spatial query.
    """
    # Ensure index is loaded
    index = _SEEDED_INDEX if _SEEDED_INDEX else _build_seeded_index()
    parcels = []
    for p in index.values():
        parcels.append({
            "parcel_id": p["parcel_id"],
            "survey_number": p["survey_number"],
            "area_acres": p["area_acres"],
            "village": p.get("village"),
            "district": p.get("district"),
            "state": p.get("state"),
            "source": p["source"],
        })
    return {"count": len(parcels), "parcels": parcels}
