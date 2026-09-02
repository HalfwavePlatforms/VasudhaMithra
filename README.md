# Intelligent Land Record Digitization and Validation System (SIH26018)

## What this is
An AI-powered pipeline that OCRs scanned/photographed land records, extracts structured
fields (survey no., khata no., owner, area, etc.), validates them against business rules,
and surfaces low-confidence records for human review — with a live dashboard.

## Architecture at a glance
```
Upload Portal (React) ──> API Gateway (FastAPI) ──> OCR Pipeline (FastAPI)
                                │                          │
                                ├──> Extraction Engine <────┘
                                │
                                ├──> PostgreSQL + PostGIS
                                │
                                └──> GIS Service (mock cadastral overlay)

Dashboard (React) ──> API Gateway (read endpoints)
```
Every service is independent and talks over HTTP — see `docs/api-contracts.md` before
touching any service's code. That file is the single source of truth everyone builds against.

## Run everything locally (this is what you'll demo on)
```bash
cp .env.example .env          # fill in your OCR API key etc.
docker-compose up --build
```
- Upload portal: http://localhost:3000
- Dashboard: http://localhost:3001
- API gateway: http://localhost:8000/docs (FastAPI auto-generated Swagger UI)
- Check every service is alive: `bash infra/healthchecks/check-all.sh`

## Repo layout
| Folder | Owner | Depends on |
|---|---|---|
| `services/ocr-pipeline` | OCR/CV person | nothing — pure input→output |
| `services/extraction-engine` | Backend/rules person | OCR's API contract (mockable) |
| `services/api-gateway` | DB/backend lead | OCR + extraction contracts |
| `services/gis-service` | Whoever's floating | nothing |
| `frontend/upload-portal` | Frontend 1 | API gateway contract |
| `frontend/dashboard` | Frontend 2 | API gateway contract |
| `data/` | Whoever's floating | — synthetic documents + seed scripts |
| `docs/` | Team lead / pitch owner | — architecture, contracts, schema |
| `infra/` | DB/backend lead | — nginx, health checks, deploy config |

## Git workflow
- `main` is protected. Work on `feat/<your-service-name>` branches.
- Open a PR to merge — even in a hackathon. This is what catches broken contracts
  *before* demo day instead of during it.
- Only touch `docs/api-contracts.md` with a heads-up in the team chat — everyone's
  code depends on it staying accurate.

## Deployment
See `docs/deployment.md` for the two supported paths:
1. **Local docker-compose** (default — guaranteed to work for the live demo)
2. **Hosted backup** (API gateway + frontends deployed to Railway, optional bonus link)
