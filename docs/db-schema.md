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

## Why this shape
- **`record_fields` is a narrow table, not one wide column per field.** Land records
  have ~10 fields today; the ministry's real spec could add more. A narrow schema
  means adding a new field type is a data change, not a migration.
- **`geom` is nullable and separate from the GIS service's mock response** — the
  DB is ready for real cadastral polygons even though the hackathon demo fakes them.
- **`audit_log` is append-only and generic** — it's what lets you show a judge a full
  provenance trail for any record without designing a bespoke history table per entity.
