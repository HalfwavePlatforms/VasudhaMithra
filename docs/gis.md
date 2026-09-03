# GIS & Cadastral Parcel Integration Architecture

## 1. Overview
VasudhaMithra bridges textual legacy deeds and spatial cadastral maps. In Indian land governance (DILRMP), deed records frequently suffer from area discrepancies against ground survey reality.

## 2. The Winning Feature — Spatial Consistency Engine
When a document is ingested:
1. Optical text recognition extracts the stated extent (`plot_area`, e.g. `2.45 acre`).
2. Extraction engine parses and canonicalizes the measurement to numeric Acres (`area_doc_acres`).
3. API Gateway invokes `gis-service` on `GET /gis/parcel/{survey_number}`.
4. The cadastral layer queries PostGIS / synthetic GeoJSON polygon geometry and calculates the true polygon area (`area_gis_acres`).
5. **Cross-Validation Rule**:
   $$\Delta\% = \frac{|\text{Area}_{\text{doc}} - \text{Area}_{\text{gis}}|}{\text{Area}_{\text{gis}}} \times 100$$
   - **$\Delta\% \le 5.0\%$**: Tagged as `✓ SPATIAL MATCH`. Record automatically advances to `validated`.
   - **$\Delta\% > 5.0\%$**: Tagged as `⚠ SPATIAL DISCREPANCY`. Record flagged as `HIGH RISK` and placed in the Revenue Officer Review Backlog for field verification.

## 3. Synthetic vs Real Cadastral Data Disclosure (No Fake GIS)
- **Hackathon Prototype**: Uses deterministic GeoJSON parcel boundaries centered on revenue circles with authentic survey numbering.
- **Production Roadmap**: Directly connects to state GeoServer / PostGIS cadastral layers (e.g. Karnataka Bhoomi / MP Bhulekh / Bhu-Naksha).