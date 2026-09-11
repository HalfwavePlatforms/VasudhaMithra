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
    document_type       TEXT,
    language            TEXT,
    risk_level          TEXT DEFAULT 'MEDIUM',
    parcel_id           TEXT,
    area_doc_acres      FLOAT,
    area_gis_acres      FLOAT,
    spatial_consistency TEXT DEFAULT 'NOT_EVALUATED',
    spatial_delta_pct   FLOAT,
    gis_geojson         JSONB,
    reviewer_notes      TEXT,
    reviewed_by         TEXT,
    reviewed_at         TIMESTAMPTZ,
    file_path           TEXT,
    state               TEXT,
    geom                JSONB,
    verification_token  TEXT,
    verification_url    TEXT,
    village_lgd_code    TEXT
);

CREATE TABLE record_fields (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id           UUID NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    field_name          TEXT NOT NULL,   -- owner_name, survey_number, khasra_number, etc.
    field_value         TEXT,
    confidence          FLOAT,
    was_corrected       BOOLEAN NOT NULL DEFAULT false,
    corrected_value     TEXT,
    extraction_source   TEXT DEFAULT 'rule_based'  -- rule_based | ai_assisted
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
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    prev_hash           TEXT,
    curr_hash           TEXT,
    hash_input_ts       TEXT
);

CREATE TABLE correction_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id           UUID NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    field_name          TEXT NOT NULL,
    old_value           TEXT,
    new_value           TEXT NOT NULL,
    corrected_by        TEXT NOT NULL,
    corrected_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason              TEXT
);

CREATE INDEX idx_records_status ON records(status);
CREATE INDEX idx_record_fields_record_id ON record_fields(record_id);
CREATE INDEX idx_record_fields_name_value ON record_fields(field_name, field_value);
    -- speeds up duplicate detection: WHERE field_name='khasra_number' AND field_value = X
```

## Schema Migration History (Alembic 001 - 007)
- **Migration `001_add_geom_column.py`**: Added `geom` column (`JSONB`/`JSON`) to `records` table for spatial boundaries without requiring binary PostGIS lock-in.
- **Migration `002_add_file_path_column.py`**: Added `file_path` column (`TEXT`) to `records` table for document image archival paths (`storage/{record_id}.{ext}`).
- **Migration `003_add_state_column.py`**: Added `state` column (`TEXT`) to `records` table with default `'Madhya Pradesh'` for state-level analytics.
- **Migration `004_add_audit_hash_chain.py`**: Added `prev_hash` and `curr_hash` SHA-256 cryptographic audit chain columns to `audit_log`.
- **Migration `005_add_correction_log.py`**: Created `correction_log` table tracking every human officer correction and rationale.
- **Migration `006_add_hash_input_ts.py`**: Added `hash_input_ts` column to `audit_log` preserving original timestamp strings for tamper-proof verification.
- **Migration `007_add_village_lgd_code.py`**: Added `village_lgd_code` (`VARCHAR(10)`) to `records` for national Local Government Directory (LGD) compliance.

