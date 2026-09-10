"""
Builds SQLite database index from LGD (Local Government Directory) village listing CSV.
Provides high-performance canonical village resolution with normalization and spatial metadata.
"""

import os
import sys
import csv
import sqlite3
import re
import unicodedata
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, "..", ".."))
GIS_DATA_DIR = os.path.join(PROJECT_ROOT, "services", "gis-service", "src", "data")

CSV_PATH = os.path.join(CURRENT_DIR, "lgd_villages.csv")
SEED_CSV_PATH = os.path.join(CURRENT_DIR, "seed_lgd_villages.csv")
TARGET_DB_PATH = os.path.join(GIS_DATA_DIR, "lgd_index.db")
SEED_DB_PATH = os.path.join(GIS_DATA_DIR, "lgd_index.seed.db")

COMMON_ALIASES = {
    "bangalore": "bengaluru",
    "bangalore urban": "bengaluru urban",
    "bangalore south": "bengaluru south",
    "tumkur": "tumakuru",
    "mysore": "mysuru",
    "belgaum": "belagavi",
    "gulbarga": "kalaburagi",
    "bellary": "ballari",
    "bijapur": "vijayapura",
    "shimoga": "shivamogga",
    "baraily": "bareli",
}


def _normalise_name(s: str) -> str:
    """
    Normalizes a place name for robust matching:
    - Strips whitespace
    - Lowercases
    - Strips punctuation (periods, commas, hyphens, slashes, brackets, quotes)
    - Normalizes unicode characters
    - Handles common transliteration variance
    """
    if not s:
        return ""
    s = unicodedata.normalize("NFKC", str(s)).strip().lower()
    s = re.sub(r"[\.,\-\/\(\)\[\]\'\"_:\;\*]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return COMMON_ALIASES.get(s, s)


def build_index(source_csv: str, target_db: str):
    logger.info(f"Building SQLite LGD index from {source_csv} -> {target_db}")
    os.makedirs(os.path.dirname(target_db), exist_ok=True)

    # Use temporary file to make build idempotent and atomic
    temp_db = target_db + ".tmp"
    if os.path.exists(temp_db):
        os.remove(temp_db)

    conn = sqlite3.connect(temp_db)
    cur = conn.cursor()

    cur.execute("PRAGMA synchronous = OFF")
    cur.execute("PRAGMA journal_mode = MEMORY")
    cur.execute("PRAGMA page_size = 4096")
    cur.execute("PRAGMA cache_size = 100000")

    cur.execute(
        """
    CREATE TABLE lgd_villages (
        state TEXT,
        district TEXT,
        subdistrict TEXT,
        village TEXT,
        village_code TEXT,
        norm_village TEXT,
        norm_district TEXT,
        norm_state TEXT
    )
    """
    )

    batch = []
    count = 0
    with open(source_csv, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f)
        for row in reader:
            v_code = (row.get("village_code") or row.get("Village Code") or "").strip()
            if not v_code:
                continue

            st = (row.get("state_name") or row.get("State Name(In English)") or "").strip()
            dist = (row.get("district_name") or row.get("District Name (In English)") or "").strip()
            subdist = (row.get("subdistrict_name") or row.get("Sub-District Name (In English)") or "").strip()
            v = (row.get("village_name") or row.get("Village Name (In English)") or "").strip()

            norm_v = _normalise_name(v)
            norm_dist = _normalise_name(dist)
            norm_st = _normalise_name(st)

            batch.append((st, dist, subdist, v, v_code, norm_v, norm_dist, norm_st))
            count += 1
            if len(batch) >= 50000:
                cur.executemany(
                    """
                INSERT INTO lgd_villages (state, district, subdistrict, village, village_code, norm_village, norm_district, norm_state)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                    batch,
                )
                batch = []
                logger.info(f"Inserted {count} rows...")

    if batch:
        cur.executemany(
            """
        INSERT INTO lgd_villages (state, district, subdistrict, village, village_code, norm_village, norm_district, norm_state)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
            batch,
        )

    logger.info(f"Total {count} rows inserted. Creating indexes...")
    cur.execute("CREATE INDEX idx_lgd_exact ON lgd_villages(state, district, village)")
    cur.execute("CREATE INDEX idx_lgd_norm ON lgd_villages(norm_state, norm_district, norm_village)")
    cur.execute("CREATE INDEX idx_lgd_norm_village ON lgd_villages(norm_village)")

    conn.commit()
    logger.info("Optimizing index with VACUUM...")
    cur.execute("VACUUM")
    conn.close()

    if os.path.exists(target_db):
        os.remove(target_db)
    os.rename(temp_db, target_db)

    size_mb = os.path.getsize(target_db) / (1024 * 1024)
    logger.info(f"Successfully created {target_db} ({size_mb:.2f} MB, {count} records)")
    return count, size_mb


if __name__ == "__main__":
    # Build seed DB first to ensure repo always has bundled index
    if os.path.exists(SEED_CSV_PATH):
        logger.info("--- Building bundled seed index ---")
        build_index(SEED_CSV_PATH, SEED_DB_PATH)

    # Build main index from lgd_villages.csv if present, or fallback to seed
    if os.path.exists(CSV_PATH):
        logger.info("--- Building full LGD index ---")
        build_index(CSV_PATH, TARGET_DB_PATH)
    elif os.path.exists(SEED_CSV_PATH):
        logger.info("Full CSV not present; building target index from seed...")
        build_index(SEED_CSV_PATH, TARGET_DB_PATH)
    else:
        logger.error("No CSV found to build LGD index.")
        sys.exit(1)
