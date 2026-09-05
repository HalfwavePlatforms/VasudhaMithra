# API Contracts (Single Source of Truth)

> Single source of truth across all 4 modules. Backward compatibility is strictly maintained.

## 1. OCR Pipeline (`ocr-pipeline`, port 8001) — Owned by Member 1

### POST /ocr/extract
Request:
```json
{
  "image_base64": "string",
  "language_hint": "hi",
  "document_id": "DOC-001 (optional)"
}
```
Response:
```json
{
  "document_id": "DOC-001",
  "language": "kn",
  "document_type": "Record of Rights / RTC (Pahani)",
  "pages": 1,
  "raw_text": "string",
  "confidence": 0.92,
  "bounding_boxes": [
    { "text": "string", "confidence": 0.95, "box": [10.0, 10.0, 100.0, 30.0] }
  ],
  "metadata": {
    "width": 920,
    "height": 720,
    "deskew_angle": 0.0
  }
}
```

### GET /health
Response: `{ "status": "ok" }`

---

## 2. Extraction Engine (`extraction-engine`, port 8002) — Owned by Member 2

### POST /extraction/parse
Request:
```json
{
  "raw_text": "string",
  "bounding_boxes": [ /* from OCR */ ]
}
```
Response:
```json
{
  "fields": {
    "owner_name": "Ramesh Gowda",
    "survey_number": "145/2",
    "khasra_number": "4891",
    "khata_number": "512",
    "plot_area": "2.45 acre",
    "village": "Rampur",
    "tehsil": "Sehore",
    "district": "Bhopal",
    "land_classification": "Agricultural",
    "mutation_number": "MR-12/2024"
  },
  "structured_record": {
    "owner_name": { "value": "Ramesh Gowda", "confidence": 0.94 },
    "survey_number": { "value": "145/2", "confidence": 0.98 },
    "plot_area": { "value": "2.45 acre", "area_acres": 2.45, "unit": "acre", "confidence": 0.91 }
  },
  "area_acres": 2.45,
  "confidence_per_field": { "owner_name": 0.94, "survey_number": 0.98 },
  "needs_review": []
}
```

### POST /extraction/validate
Request:
```json
{
  "record_id": "uuid",
  "fields": { /* extracted fields */ },
  "confidence_per_field": { /* optional */ }
}
```
Response:
```json
{
  "valid": true,
  "status": "VERIFIED",
  "risk_level": "LOW",
  "confidence": 0.92,
  "issues": [],
  "violations": []
}
```

### GET /health
Response: `{ "status": "ok" }`

---

## 3. GIS Service (`gis-service`, port 8003) — Owned by Member 3

### GET /gis/parcel/{survey_number}
Response:
```json
{
  "parcel_id": "PARCEL-145-2",
  "survey_number": "145/2",
  "area_gis": 2.47,
  "area_unit": "acre",
  "centroid": [23.2599, 77.4126],
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[77.4116, 23.2589], [77.4136, 23.2589], [77.4136, 23.2609], [77.4116, 23.2609], [77.4116, 23.2589]]]
  },
  "status": "FOUND",
  "source": "synthetic_cadastral_layer (demo prototype)"
}
```

### GET /health
Response: `{ "status": "ok" }`

---

## 4. API Gateway (`api-gateway`, port 8000) — Orchestration & DB

### POST /records/upload
Request: multipart form (`file`, optional `actor`)
Response:
```json
{
  "record_id": "uuid",
  "status": "validated | pending_review",
  "risk_level": "LOW | MEDIUM | HIGH",
  "spatial_consistency": "MATCH | DISCREPANCY | NOT_EVALUATED"
}
```

### Contract Change Log — Phase B5 (Upload Size & MIME Validation)
- **OLD**: Upload validation lacked configurable size limits and MIME-type enforcement before database/OCR execution.
- **NEW**: `POST /records/upload` enforces `MAX_UPLOAD_SIZE_MB` (default 15 MB) and `ALLOWED_MIME_TYPES` (PNG, JPG, WEBP, PDF) prior to DB row creation, disk storage write, or OCR calls. Rejects invalid files with `HTTP 400 Bad Request`.
- **WHY**: Protects storage and downstream processing from corrupt, invalid, or oversized file uploads.
- **MIGRATION**: Backward-compatible addition.

### Contract Change Log — Phase B3 (Basic RBAC & Actor Headers)
- **OLD**: API endpoints lacked role verification (or defaulted missing headers), CORS allowed all origins (`*`), and audit logs recorded hardcoded placeholder actor strings.
- **NEW**: HTTP request headers `X-Role` and `X-Actor` are enforced across protected routes. Missing `X-Role` returns `401 Unauthorized`. Unauthorized role returns `403 Forbidden`. Admin-only route `GET /dashboard/audit-trail` requires `X-Role: admin`. `PATCH /records/{record_id}` records actor identity from `X-Actor`/`X-Role` headers. Narrowed CORS origins to `http://localhost:3000`, `http://localhost:3001`.
- **WHY**: Secures revenue decision endpoints for human-in-the-loop review and populates realistic actor provenance trails.
- **MIGRATION**: Backward-compatible. Frontend includes `X-Role` and `X-Actor` headers in API requests.

### Contract Change Log — Phase B2 (Store Uploaded Files)
- **OLD**: Uploaded document images/PDFs were not persisted to disk or retrievable after processing.
- **NEW**: Uploaded documents are saved to `storage/{record_id}.{ext}` upon upload with MIME/size validation. Added `GET /records/{record_id}/document` streaming endpoint and `document_url` field in `GET /records/{record_id}`.
- **WHY**: Frontend document-viewer pane requires an accessible document URL/stream to display original deed scans alongside extracted fields.
- **MIGRATION**: Backward-compatible addition. Migration `002_add_file_path_column.py` adds `file_path` column to `records` table.

### Contract Change Log — Phase B1 (GIS Integration into Upload Flow)
- **OLD**: `GET /records/{record_id}` returned `gis: null` or unpopulated GIS data when GIS call was unhandled.
- **NEW**: `GET /records/{record_id}` returns a fully populated `gis` object (`parcel_id`, `area_doc_acres`, `area_gis_acres`, `spatial_consistency`, `spatial_delta_pct`, `geometry`) when GIS lookup succeeds, and `gis: null` when lookup fails/times out.
- **WHY**: Frontend Cadastral Leaflet Map renderer requires geometry JSON and parcel details to overlay survey boundaries.
- **MIGRATION**: Backward-compatible addition. Migration `001_add_geom_column.py` adds `geom` column to `records` table.

### GET /records/{record_id}
Response:
```json
{
  "record_id": "uuid",
  "original_filename": "sample.png",
  "uploaded_at": "2026-09-03T07:00:00Z",
  "status": "pending_review | validated | rejected",
  "document_type": "Record of Rights / RTC (Pahani)",
  "language": "hi",
  "risk_level": "LOW | MEDIUM | HIGH",
  "ocr_confidence": 0.92,
  "fields": { "owner_name": "...", "survey_number": "...", "plot_area": "2.45 acre" },
  "confidence_per_field": { "owner_name": 0.94 },
  "corrections": {},
  "violations": [],
  "gis": {
    "parcel_id": "PARCEL-145-2",
    "area_doc_acres": 2.45,
    "area_gis_acres": 2.47,
    "spatial_consistency": "MATCH",
    "spatial_delta_pct": 0.81,
    "geometry": { "type": "Polygon", "coordinates": [...] }
  },
  "review": {
    "reviewer_notes": "Verified against survey ledger",
    "reviewed_by": "Revenue Officer",
    "reviewed_at": "2026-09-03T07:15:00Z"
  }
}
```

### PATCH /records/{record_id}
Request:
```json
{
  "actor": "Revenue Officer",
  "reviewer_notes": "Corrected khata number per original deed",
  "decision": "APPROVED",
  "fields": { "khata_number": "512" }
}
```
Response: Updated record serialized.

### GET /records/{record_id}/download
Downloads the original uploaded document (PDF/PNG/JPEG) from persistent server storage (`storage/{record_id}.{ext}`).
- Status 200: Streamed file content with appropriate `Content-Disposition: attachment; filename="<original_filename>"` and MIME type (`application/pdf`, `image/png`, etc.).
- Status 404: `{ "detail": "Original document file not found in storage" }` if record or file missing.

### Contract Change Log — Phase B4 (state Column & State-Wise Dashboard Breakdown)
- **OLD**: `GET /dashboard/stats` returned district, classification, and doc_type breakdowns, but lacked state-wise aggregation.
- **NEW**: `GET /dashboard/stats` includes `"by_state": { "Madhya Pradesh": 45, ... }` aggregation dictionary alongside existing metrics.
- **WHY**: Enables macro state-level analytics across multi-jurisdictional land digitization deployments.
- **MIGRATION**: Backward-compatible addition. Migration `003_add_state_column.py` adds `state` column to `records` table with default `'Madhya Pradesh'`.

### GET /dashboard/stats
Response:
```json
{
  "total_processed": 142,
  "verified_count": 128,
  "pending_review_count": 12,
  "rejected_count": 2,
  "error_count": 5,
  "spatial_discrepancy_count": 4,
  "avg_extraction_accuracy": 0.912,
  "by_state": { "Madhya Pradesh": 142 },
  "by_district": { "Bhopal": 45, "Indore": 52 },
  "by_classification": { "Agricultural": 110, "Residential": 32 },
  "by_doc_type": { "Record of Rights / RTC (Pahani)": 98, "Mutation Extract (Form XII)": 44 }
}
```

### GET /dashboard/audit-trail?limit=30
Response:
```json
{
  "total": 30,
  "audit_logs": [
    {
      "id": "uuid",
      "record_id": "uuid",
      "action": "human_reviewed",
      "actor": "Revenue Officer",
      "details": { "decision": "APPROVED" },
      "created_at": "2026-09-03T07:15:00Z"
    }
  ]
}
```

### GET /health
Response: `{ "status": "ok" }`

