"""
API Gateway.
Owns: the database, and orchestration of calls to ocr-pipeline and
extraction-engine. This is the ONLY service the frontends talk to.
Contract: see docs/api-contracts.md — section 3.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine
from models.db_models import Base
from routes import records, dashboard

app = FastAPI(title="API Gateway")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to your deployed frontend origin(s) before real deploy
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(records.router)
app.include_router(dashboard.router)


@app.on_event("startup")
def on_startup():
    # For the hackathon, create tables directly. For anything longer-lived,
    # use Alembic migrations (services/api-gateway/migrations/) instead.
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health():
    return {"status": "ok"}
