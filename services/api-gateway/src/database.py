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
    # Check and add missing columns safely without unnecessary DDL locks
    with engine.connect() as conn:
        try:
            from sqlalchemy import text, inspect as sa_inspect
            insp = sa_inspect(conn)
            
            # Check record_fields columns
            rf_cols = [c["name"] for c in insp.get_columns("record_fields")]
            if "extraction_source" not in rf_cols:
                if DATABASE_URL.startswith("sqlite"):
                    conn.execute(text("ALTER TABLE record_fields ADD COLUMN extraction_source VARCHAR DEFAULT 'rule_based'"))
                else:
                    conn.execute(text("ALTER TABLE record_fields ADD COLUMN IF NOT EXISTS extraction_source VARCHAR DEFAULT 'rule_based'"))
                conn.commit()

            # Check audit_log columns
            audit_cols = [c["name"] for c in insp.get_columns("audit_log")]
            if "prev_hash" not in audit_cols:
                conn.execute(text("ALTER TABLE audit_log ADD COLUMN prev_hash VARCHAR"))
                conn.commit()
            if "curr_hash" not in audit_cols:
                conn.execute(text("ALTER TABLE audit_log ADD COLUMN curr_hash VARCHAR"))
                conn.commit()
            if "hash_input_ts" not in audit_cols:
                conn.execute(text("ALTER TABLE audit_log ADD COLUMN hash_input_ts VARCHAR"))
                conn.commit()

            # Check records columns
            rec_cols = [c["name"] for c in insp.get_columns("records")]
            if "verification_token" not in rec_cols:
                conn.execute(text("ALTER TABLE records ADD COLUMN verification_token VARCHAR"))
                conn.commit()
            if "verification_url" not in rec_cols:
                conn.execute(text("ALTER TABLE records ADD COLUMN verification_url VARCHAR"))
                conn.commit()
            if "village_lgd_code" not in rec_cols:
                conn.execute(text("ALTER TABLE records ADD COLUMN village_lgd_code VARCHAR"))
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


