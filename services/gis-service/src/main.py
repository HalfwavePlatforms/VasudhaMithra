"""
GIS Service — Cadastral Layer & Spatial Parcel Lookup for SIH 26018.
Returns synthetic cadastral polygon, computed parcel area, and boundary geometry
for any survey number to enable Document <-> Data <-> GIS Spatial Consistency checking.
Clearly labeled as synthetic cadastral data for prototype evaluation.
"""
import hashlib
import math
import random
from fastapi import FastAPI

app = FastAPI(title="GIS Cadastral Service (Member 3)")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/gis/parcel/{survey_number:path}")
def get_parcel(survey_number: str):
    clean_no = survey_number.strip().replace(" ", "")
    seed = int(hashlib.sha256(clean_no.encode("utf-8")).hexdigest(), 16) % (10**8)
    rng = random.Random(seed)

    # Base coordinates (Bhopal / Karnataka geographic cluster for demo)
    base_lat = 23.2599 + (rng.uniform(-0.05, 0.05))
    base_lon = 77.4126 + (rng.uniform(-0.05, 0.05))

    # Generate a realistic convex/quadrilateral parcel shape
    width_m = rng.uniform(80, 220)   # meters
    height_m = rng.uniform(80, 220)  # meters
    m_per_lat = 111139.0
    m_per_lon = 111139.0 * math.cos(math.radians(base_lat))

    d_lat = height_m / m_per_lat
    d_lon = width_m / m_per_lon

    p1 = [round(base_lon - d_lon / 2, 6), round(base_lat - d_lat / 2, 6)]
    p2 = [round(base_lon + d_lon / 2, 6), round(base_lat - d_lat / 2, 6)]
    p3 = [round(base_lon + d_lon / 2 + rng.uniform(-0.0001, 0.0001), 6), round(base_lat + d_lat / 2, 6)]
    p4 = [round(base_lon - d_lon / 2 + rng.uniform(-0.0001, 0.0001), 6), round(base_lat + d_lat / 2, 6)]
    coords = [p1, p2, p3, p4, p1]

    # Calculate actual parcel area: (width_m * height_m) / 4046.86 sq.m per acre
    calculated_acres = round((width_m * height_m) / 4046.86, 2)

    parcel_id = f"PARCEL-{clean_no.replace('/', '-')}"

    return {
        "parcel_id": parcel_id,
        "survey_number": survey_number,
        "area_gis": calculated_acres,
        "area_unit": "acre",
        "centroid": [round(base_lat, 6), round(base_lon, 6)],
        "geometry": {
            "type": "Polygon",
            "coordinates": [coords],
        },
        "status": "FOUND",
        "source": "synthetic_cadastral_layer (demo prototype)",
    }

