# Database Schema (PostgreSQL + PostGIS)

Owned by `services/api-gateway`. Migrations live in `services/api-gateway/migrations/`
(Alembic). Nobody else writes to this DB directly — always go through the API gateway.

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE records (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_filename   TEXT NOT NULL,
    uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    status              TEXT NOT NULL DEFAULT 'processing',
        -- processing | pending_review | validated | rejected
    raw_ocr_text        TEXT,
    ocr_confidence      FLOAT,
    geom                GEOMETRY(Polygon, 4326)  -- nullable, filled by GIS mock
);

CREATE TABLE record_fields (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id           UUID NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    field_name          TEXT NOT NULL,   -- owner_name, survey_number, khasra_number, etc.
    field_value         TEXT,
    confidence          FLOAT,
    was_corrected       BOOLEAN NOT NULL DEFAULT false,
    corrected_value     TEXT
);

CREATE TABLE validation_results (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id           UUID NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    field_name          TEXT,
    rule                TEXT NOT NULL,   -- format | duplicate | consistency
    passed              BOOLEAN NOT NULL,
    message             TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id           UUID REFERENCES records(id) ON DELETE CASCADE,
    action              TEXT NOT NULL,   -- uploaded | ocr_completed | extracted | corrected | validated
    actor               TEXT,            -- 'system' or a user identifier
    details             JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_records_status ON records(status);
CREATE INDEX idx_record_fields_record_id ON record_fields(record_id);
CREATE INDEX idx_record_fields_name_value ON record_fields(field_name, field_value);
    -- speeds up duplicate detection: WHERE field_name='khasra_number' AND field_value = X
```

## Schema Migration Notes
- **Migration `003_add_state_column.py`**: Added `state` column (`TEXT`) to `records` table with server default `'Madhya Pradesh'` for state-level analytics aggregation.
- **Migration `002_add_file_path_column.py`**: Added `file_path` column (`TEXT`) to `records` table for storing local storage file paths (`storage/{record_id}.{ext}`).
- **Migration `001_add_geom_column.py`**: Added `geom` column (`JSONB`/`JSON`) to `records` table. Storing GeoJSON structures as JSONB is an interim step when standard PostgreSQL (without the optional PostGIS binary extension) is used, ensuring GeoJSON polygon coordinates are fully persisted and retrievable by `api-gateway` and the frontend map.

