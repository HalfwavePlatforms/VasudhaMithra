# System Architecture

## Data flow
1. User uploads a scanned/photographed land record via **Upload Portal**.
2. **API Gateway** stores the file, creates a `records` row (`status=processing`),
   calls **OCR Pipeline**.
3. OCR Pipeline preprocesses (deskew/denoise) and returns raw text + confidence
   + bounding boxes.
4. API Gateway forwards raw text to **Extraction Engine**, which parses it into
   structured fields with per-field confidence, and flags low-confidence fields.
5. Extraction Engine runs validation rules (format, duplicate detection against
   existing `record_fields` rows) and returns violations.
6. API Gateway persists fields + validation results, sets `status=pending_review`
   if anything needs human eyes, else `validated`.
7. **Dashboard** polls `GET /dashboard/stats` for live counts/charts.
8. A human reviewer opens a flagged record in the Upload Portal's review queue,
   corrects fields via `PATCH /records/{id}`, which re-triggers validation.
9. **GIS Service** is called on demand (`GET /gis/parcel/{survey_number}`) to
   overlay the record on a mock cadastral map — clearly labeled as illustrative.

## What's real vs. what's demonstrated as roadmap
| Capability | Hackathon build | Full DILRMP-scale version |
|---|---|---|
| Printed-text OCR | Real (Google Vision / Tesseract) | Same, at higher volume |
| Handwriting OCR (Indic scripts) | Not attempted — flagged as Phase 2 | Fine-tuned TrOCR / IndicOCR research models |
| Field extraction | Real (regex + positional rules) | Same + more field types |
| Validation | Real, against records in our own DB | Same + cross-reference with real LRMS/DILRMP master DB |
| GIS integration | Mocked (one sample shapefile) | Real GeoServer/DILRMP GIS layer integration |
| "Learning mechanism" | Diagram only | Active-learning loop retraining extraction model from corrections |

Being explicit about this split in the pitch is a feature, not a weakness — judges
have seen many teams overclaim "integration"; a credible scope boundary reads as
engineering maturity.

## Service boundaries
Every arrow below is an HTTP call, not a shared library import — this is what lets
each service be built, tested, and deployed independently.

```
Upload Portal ──HTTP──> API Gateway ──HTTP──> OCR Pipeline
Dashboard ─────HTTP──>       │        ──HTTP──> Extraction Engine
                              │        ──HTTP──> GIS Service
                              └────────SQL─────> PostgreSQL + PostGIS
```
