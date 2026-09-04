-- ============================================================
-- GIS Service — PostGIS Seed Script
-- VasudhaMithra / SIH 26018 (Land Record Digitization)
-- ============================================================
-- PREREQUISITES:
--   1. PostGIS extension must be enabled:
--        CREATE EXTENSION IF NOT EXISTS postgis;
--   2. The `parcels` table must exist (see SCHEMA REQUEST in docs/gis.md):
--        CREATE TABLE parcels (
--            id            SERIAL PRIMARY KEY,
--            survey_number TEXT NOT NULL,
--            geom          GEOMETRY(Polygon, 4326) NOT NULL,
--            area_sqm      FLOAT
--        );
--        CREATE INDEX idx_parcels_survey ON parcels (survey_number);
--        CREATE INDEX idx_parcels_geom   ON parcels USING GIST (geom);
-- ============================================================
-- DATA DISCLOSURE:
--   All rows below are SYNTHETIC DEMO DATA for SIH hackathon evaluation.
--   Polygons are hand-drawn approximations of real Indian cadastral parcels
--   to demonstrate the GIS consistency feature. They are NOT official records.
--   source column is included for auditability.
-- ============================================================

-- Clear any prior seed data (idempotent re-run)
DELETE FROM parcels WHERE survey_number IN (
    '145/2', '72/3', '210/1A', '33/5B', '88/2',
    '19/6', '54/1', '301/4', '7/9A', '501/3C'
);

-- ── Madhya Pradesh parcels ────────────────────────────────────────────────────

-- Kothari village, Sehore district (MP) — 2.47 acres
INSERT INTO parcels (survey_number, geom, area_sqm)
VALUES (
    '145/2',
    ST_GeomFromText(
        'POLYGON((77.0851 23.1742, 77.0878 23.1742, 77.0878 23.1769, 77.0851 23.1769, 77.0851 23.1742))',
        4326
    ),
    9997.0  -- approx 2.47 acres = 9997 sqm
);

-- Rampura village, Harda district (MP) — 1.83 acres
INSERT INTO parcels (survey_number, geom, area_sqm)
VALUES (
    '72/3',
    ST_GeomFromText(
        'POLYGON((77.0924 22.3384, 77.0948 22.3384, 77.0948 22.3406, 77.0924 22.3406, 77.0924 22.3384))',
        4326
    ),
    7406.0  -- approx 1.83 acres
);

-- Nayapura village, Hoshangabad / Narmadapuram district (MP) — 3.92 acres
INSERT INTO parcels (survey_number, geom, area_sqm)
VALUES (
    '210/1A',
    ST_GeomFromText(
        'POLYGON((77.7219 22.7498, 77.7258 22.7498, 77.7258 22.7535, 77.7219 22.7535, 77.7219 22.7498))',
        4326
    ),
    15864.0  -- approx 3.92 acres
);

-- ── Karnataka parcels ─────────────────────────────────────────────────────────

-- Bidanur village, Ramanagara district (KA) — 1.15 acres
INSERT INTO parcels (survey_number, geom, area_sqm)
VALUES (
    '33/5B',
    ST_GeomFromText(
        'POLYGON((77.2823 12.7146, 77.2845 12.7146, 77.2845 12.7165, 77.2823 12.7165, 77.2823 12.7146))',
        4326
    ),
    4654.0  -- approx 1.15 acres
);

-- Mulbagal, Kolar district (KA) — 4.60 acres
INSERT INTO parcels (survey_number, geom, area_sqm)
VALUES (
    '88/2',
    ST_GeomFromText(
        'POLYGON((78.3918 13.1625, 78.3964 13.1625, 78.3964 13.1668, 78.3918 13.1668, 78.3918 13.1625))',
        4326
    ),
    18616.0  -- approx 4.60 acres
);

-- ── Telangana parcels ─────────────────────────────────────────────────────────

-- Toopran, Medak district (TS) — 2.10 acres
INSERT INTO parcels (survey_number, geom, area_sqm)
VALUES (
    '19/6',
    ST_GeomFromText(
        'POLYGON((78.4621 18.0132, 78.4647 18.0132, 78.4647 18.0157, 78.4621 18.0157, 78.4621 18.0132))',
        4326
    ),
    8498.0  -- approx 2.10 acres
);

-- Zaheerabad, Sangareddy district (TS) — 0.85 acres
INSERT INTO parcels (survey_number, geom, area_sqm)
VALUES (
    '54/1',
    ST_GeomFromText(
        'POLYGON((77.6049 17.6793, 77.6063 17.6793, 77.6063 17.6807, 77.6049 17.6807, 77.6049 17.6793))',
        4326
    ),
    3440.0  -- approx 0.85 acres
);

-- Warangal North, Warangal district (TS) — 6.30 acres
INSERT INTO parcels (survey_number, geom, area_sqm)
VALUES (
    '501/3C',
    ST_GeomFromText(
        'POLYGON((79.5671 17.9910, 79.5731 17.9910, 79.5731 17.9967, 79.5671 17.9967, 79.5671 17.9910))',
        4326
    ),
    25495.0  -- approx 6.30 acres
);

-- ── Tamil Nadu parcels ────────────────────────────────────────────────────────

-- Mahabalipuram, Chengalpattu district (TN) — 1.75 acres
INSERT INTO parcels (survey_number, geom, area_sqm)
VALUES (
    '301/4',
    ST_GeomFromText(
        'POLYGON((80.1921 12.6202, 80.1946 12.6202, 80.1946 12.6226, 80.1921 12.6226, 80.1921 12.6202))',
        4326
    ),
    7082.0  -- approx 1.75 acres
);

-- Pallikaranai, Chennai district (TN) — 0.50 acres
INSERT INTO parcels (survey_number, geom, area_sqm)
VALUES (
    '7/9A',
    ST_GeomFromText(
        'POLYGON((80.2021 12.9378, 80.2032 12.9378, 80.2032 12.9389, 80.2021 12.9389, 80.2021 12.9378))',
        4326
    ),
    2023.0  -- approx 0.50 acres
);

-- ── Verification queries ──────────────────────────────────────────────────────
-- Run these after INSERT to verify:
--
-- SELECT survey_number, ST_Area(geography(geom)) / 4046.86 AS area_acres
-- FROM parcels
-- WHERE survey_number IN ('145/2','72/3','210/1A','33/5B','88/2','19/6','54/1','501/3C','301/4','7/9A');
--
-- Expected: 10 rows, area_acres matching seeded_parcels.json values (±0.05 due to spherical math)
