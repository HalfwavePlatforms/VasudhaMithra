# API Contracts

> Read this before writing any service code. If you need to change a contract here,
> flag it in the team chat first — everyone else is building against what's written.

## 1. OCR Pipeline (`ocr-pipeline`, port 8001)

### POST /ocr/extract
Request:
```json
{ "image_base64": "string", "language_hint": "hi" }
```
Response:
```json
{
  "raw_text": "string",
  "confidence": 0.92,
  "bounding_boxes": [
    { "text": "string", "confidence": 0.95, "box": [x1, y1, x2, y2] }
  ]
}
```

### GET /health
Response: `{ "status": "ok" }`

---

## 2. Extraction Engine (`extraction-engine`, port 8002)

### POST /extraction/parse
Request:
```json
{ "raw_text": "string", "bounding_boxes": [ /* from OCR */ ] }
```
Response:
```json
{
  "fields": {
    "owner_name": "string",
    "survey_number": "string",
    "khasra_number": "string",
    "khata_number": "string",
    "plot_area": "string",
    "village": "string",
    "tehsil": "string",
    "district": "string",
    "land_classification": "string"
  },
  "confidence_per_field": { "owner_name": 0.88, "survey_number": 0.95 },
  "needs_review": ["owner_name"]
}
```

### POST /extraction/validate
Request:
```json
{ "record_id": "uuid", "fields": { /* as above */ } }
```
Response:
```json
{
  "valid": false,
  "violations": [
    { "field": "survey_number", "rule": "format", "message": "does not match expected pattern" },
    { "field": "khasra_number", "rule": "duplicate", "message": "matches existing record uuid X" }
  ]
}
```

### GET /health
Response: `{ "status": "ok" }`

---

## 3. API Gateway (`api-gateway`, port 8000)

This is the only service the frontends talk to. It orchestrates calls to OCR,
extraction, and GIS, and owns the database.

### POST /records/upload
Request: multipart form, `file` field
Response:
```json
{ "record_id": "uuid", "status": "processing" }
```

### GET /records/{record_id}
Response:
```json
{
  "record_id": "uuid",
  "status": "pending_review | validated | rejected",
  "fields": { /* extracted fields */ },
  "confidence_per_field": { /* ... */ },
  "violations": [ /* ... */ ]
}
```

### GET /records
Query params: `?status=pending_review&page=1&limit=20`
Response: paginated list of records, same shape as above.

### PATCH /records/{record_id}
Human correction of a field, e.g. `{ "fields": { "owner_name": "corrected value" } }`
Response: updated record.

### GET /dashboard/stats
Response:
```json
{
  "total_processed": 142,
  "avg_extraction_accuracy": 0.87,
  "pending_review_count": 12,
  "error_count": 3,
  "by_district": { "District A": 40, "District B": 55 }
}
```

### GET /health
Response: `{ "status": "ok" }`

---

## 4. GIS Service (`gis-service`, port 8003)

> Mocked for the hackathon — clearly labeled in the pitch as illustrative of a
> real DILRMP/GIS integration, not a live government connection.

### GET /gis/parcel/{survey_number}
Response:
```json
{
  "survey_number": "string",
  "geometry": { "type": "Polygon", "coordinates": [ /* mock coords */ ] },
  "source": "mock_cadastral_layer"
}
```

### GET /health
Response: `{ "status": "ok" }`

---

## Conventions used everywhere
- All timestamps: ISO 8601 UTC.
- All IDs: UUID v4.
- Error responses: `{ "error": "message", "code": "MACHINE_READABLE_CODE" }`, HTTP status matches the error.
- Every service exposes `GET /health` — this is what `infra/healthchecks/check-all.sh` and Docker's healthcheck both hit.
