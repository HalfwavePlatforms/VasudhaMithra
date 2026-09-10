import logging
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

load_dotenv()
logger = logging.getLogger("api-gateway.database")

from pathlib import Path
from models.db_models import Base

# Determine absolute path for SQLite db file in project root
ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
DEFAULT_SQLITE_PATH = (ROOT_DIR / "land_records.db").as_posix()

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_SQLITE_PATH}")

def _init_engine(url: str):
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(url, connect_args=connect_args)


try:
    engine = _init_engine(DATABASE_URL)
    if not DATABASE_URL.startswith("sqlite"):
        with engine.connect() as conn:
            pass
except Exception as e:
    logger.warning("Failed to connect to %s: %s. Falling back to local SQLite database.", DATABASE_URL, e)
    DATABASE_URL = f"sqlite:///{DEFAULT_SQLITE_PATH}"
    engine = _init_engine(DATABASE_URL)

try:
    Base.metadata.create_all(bind=engine)
    # Check and add extraction_source column to record_fields if missing
    with engine.connect() as conn:
        try:
            from sqlalchemy import text
            if DATABASE_URL.startswith("sqlite"):
                cols = [r[1] for r in conn.execute(text("PRAGMA table_info(record_fields)")).fetchall()]
                if "extraction_source" not in cols:
                    conn.execute(text("ALTER TABLE record_fields ADD COLUMN extraction_source VARCHAR DEFAULT 'rule_based'"))
                    conn.commit()
                audit_cols = [r[1] for r in conn.execute(text("PRAGMA table_info(audit_log)")).fetchall()]
                if "hash_input_ts" not in audit_cols:
                    conn.execute(text("ALTER TABLE audit_log ADD COLUMN hash_input_ts VARCHAR"))
                    conn.commit()
                rec_cols = [r[1] for r in conn.execute(text("PRAGMA table_info(records)")).fetchall()]
                if "verification_token" not in rec_cols:
                    conn.execute(text("ALTER TABLE records ADD COLUMN verification_token VARCHAR"))
                    conn.commit()
                if "verification_url" not in rec_cols:
                    conn.execute(text("ALTER TABLE records ADD COLUMN verification_url VARCHAR"))
                    conn.commit()
            else:
                conn.execute(text("ALTER TABLE record_fields ADD COLUMN IF NOT EXISTS extraction_source VARCHAR DEFAULT 'rule_based'"))
                conn.execute(text("ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS prev_hash VARCHAR"))
                conn.execute(text("ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS curr_hash VARCHAR"))
                conn.execute(text("ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS hash_input_ts VARCHAR"))
                conn.execute(text("ALTER TABLE records ADD COLUMN IF NOT EXISTS verification_token VARCHAR"))
                conn.execute(text("ALTER TABLE records ADD COLUMN IF NOT EXISTS verification_url VARCHAR"))
                conn.commit()
        except Exception as mig_err:
            logger.debug("Column migration check: %s", mig_err)
except Exception as e:
    logger.warning("Auto table creation failed: %s", e)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


