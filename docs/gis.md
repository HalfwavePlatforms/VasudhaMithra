# GIS & Cadastral Parcel Integration Architecture

## 1. Overview
VasudhaMithra bridges textual legacy deeds and spatial cadastral maps. In Indian land governance (DILRMP), deed records frequently suffer from area discrepancies against ground survey reality.

## 2. The Winning Feature — Spatial Consistency Engine
When a document is ingested:
1. Optical text recognition extracts the stated extent (`plot_area`, e.g. `2.45 acre`).
2. Extraction engine parses and canonicalizes the measurement to numeric Acres (`area_doc_acres`).
3. API Gateway invokes `gis-service` on `GET /gis/parcel/{survey_number}`.
4. The cadastral layer queries PostGIS / seeded GeoJSON polygon geometry and calculates the true polygon area (`area_gis_acres`).
5. **Cross-Validation Rule**:
   $$\Delta\% = \frac{|\text{Area}_{\text{doc}} - \text{Area}_{\text{gis}}|}{\text{Area}_{\text{gis}}} \times 100$$
   - **$\Delta\% \le 5.0\%$**: Tagged as `✓ SPATIAL MATCH`. Record automatically advances to `validated`.
   - **$\Delta\% > 5.0\%$**: Tagged as `⚠ POTENTIAL INCONSISTENCY`. Record flagged as `HIGH RISK` and placed in the Revenue Officer Review Backlog for field verification.

## 3. Two-Tier Lookup Architecture

```
GET /gis/parcel/{survey_number}
         │
         ▼
  DATABASE_URL set?
  ┌─────────┴─────────┐
  YES                 NO
  ▼                   ▼
PostGIS query     Seeded JSON
ST_AsGeoJSON()    seeded_parcels.json
ST_Area()         (10 real parcels)
  │                   │
  └─────────┬─────────┘
            ▼
   Returns parcel dict
   source: "seeded_demo_data"
```

**Tier 1 — PostGIS** (when `DATABASE_URL` is configured):
- Uses `sqlalchemy` + `geoalchemy2` to query the `parcels` table
- `ST_AsGeoJSON(geom)` returns the full polygon
- `ST_Area(geography(geom)) / 4046.86` gives area in acres (using the spheroid, not flat Earth)
- Falls back to Tier 2 if DB is unreachable

**Tier 2 — Seeded JSON** (always available, standalone mode):
- Reads `src/data/seeded_parcels.json` at startup
- 10 hand-drawn parcels over real Indian villages (MP, Karnataka, Telangana, Tamil Nadu)
- Supports the full area discrepancy feature out-of-the-box, no DB needed

## 4. Synthetic vs Real Cadastral Data Disclosure (No Fake GIS)
- **Hackathon Prototype**: Uses real-coordinate GeoJSON parcel boundaries hand-drawn via geojson.io over actual Indian revenue circles with authentic survey numbering.
- All responses carry `"source": "seeded_demo_data"` — never disguised as official data.
- **Production Roadmap**: Directly connects to state GeoServer / PostGIS cadastral layers (e.g. Karnataka Bhoomi / MP Bhulekh / Bhu-Naksha).

## 5. Seeded Demo Parcels

| Survey No | Village | District | State | Area (acres) |
|-----------|---------|----------|-------|-------------|
| 145/2 | Kothari | Bhopal | Madhya Pradesh | 2.47 |
| 72/3 | Rampura | Harda | Madhya Pradesh | 1.83 |
| 210/1A | Nayapura | Narmadapuram | Madhya Pradesh | 3.92 |
| 33/5B | Bidanur | Ramanagara | Karnataka | 1.15 |
| 88/2 | Mulbagal | Kolar | Karnataka | 4.60 |
| 19/6 | Toopran | Medak | Telangana | 2.10 |
| 54/1 | Zaheerabad | Sangareddy | Telangana | 0.85 |
| 501/3C | Warangal North | Warangal | Telangana | 6.30 |
| 301/4 | Mahabalipuram | Chengalpattu | Tamil Nadu | 1.75 |
| 7/9A | Pallikaranai | Chennai | Tamil Nadu | 0.50 |

---

## SCHEMA REQUEST

```
SCHEMA REQUEST
Table: parcels
Fields:
  id            SERIAL PRIMARY KEY
  survey_number TEXT NOT NULL           (indexed: CREATE INDEX idx_parcels_survey ON parcels (survey_number))
  geom          GEOMETRY(Polygon,4326)  (spatial index: CREATE INDEX idx_parcels_geom ON parcels USING GIST (geom))
  area_sqm      FLOAT                  (pre-computed area in sqm; GIS service also computes via ST_Area for validation)

Purpose: Real spatial lookup for GET /gis/parcel/{survey_number}
Why: PS requires GIS integration; current implementation is fully seeded-JSON-only.
     PostGIS enables ST_Area(geography(geom)) for spheroid-accurate area computation
     and ST_AsGeoJSON for serving validated polygon geometry to the frontend map.

Seed data: See services/gis-service/src/db/seed.sql — 10 demo parcels ready to INSERT.

Query (Member 2 GIS service will run):
  SELECT survey_number, ST_AsGeoJSON(geom)::text AS geojson,
         ST_Area(geography(geom)) / 4046.86 AS area_acres,
         ST_X(ST_Centroid(geom)) AS centroid_lon,
         ST_Y(ST_Centroid(geom)) AS centroid_lat
  FROM parcels
  WHERE survey_number = :sn
  LIMIT 1;

Proposed by: Member 2 (Extraction + GIS)
For review by: Member 3 (API Gateway / DB owner)
```

---

## 6. Running the GIS Service Standalone

```bash
cd services/gis-service
pip install -r requirements.txt
cd src
uvicorn main:app --port 8003 --reload
```

No database or environment variables needed — Tier 2 JSON fallback activates automatically.

```bash
# Test all 10 seeded parcels pass
cd services/gis-service
pytest tests/ -v
```