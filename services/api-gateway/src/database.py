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
except Exception as e:
    logger.warning("Auto table creation failed: %s", e)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


