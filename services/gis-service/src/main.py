"""
GIS Service — MOCKED for the hackathon demo.
Returns a synthetic cadastral polygon for any survey number so the frontend
can render a map overlay. Clearly disclosed as illustrative in the pitch —
see docs/architecture.md for what a real DILRMP/GeoServer integration would
replace this with.
Contract: see docs/api-contracts.md — section 4.
"""
import hashlib
import random

from fastapi import FastAPI

app = FastAPI(title="GIS Service (mock)")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/gis/parcel/{survey_number}")
def get_parcel(survey_number: str):
    # Deterministic pseudo-random polygon per survey number, so demoing the
    # same record twice shows the same shape — looks intentional, not random.
    seed = int(hashlib.sha256(survey_number.encode()).hexdigest(), 16) % (10**8)
    rng = random.Random(seed)

    base_lat, base_lon = 23.0, 77.0  # arbitrary demo center point (central India)
    offset = 0.01
    coords = []
    for _ in range(5):
        lat = base_lat + rng.uniform(-offset, offset)
        lon = base_lon + rng.uniform(-offset, offset)
        coords.append([lon, lat])
    coords.append(coords[0])  # close the polygon

    return {
        "survey_number": survey_number,
        "geometry": {"type": "Polygon", "coordinates": [coords]},
        "source": "mock_cadastral_layer",
    }
