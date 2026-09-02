import logging
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

load_dotenv()
logger = logging.getLogger("api-gateway.database")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://lrms_user:changeme@postgres:5432/land_records")


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
    DATABASE_URL = "sqlite:///./land_records.db"
    engine = _init_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

