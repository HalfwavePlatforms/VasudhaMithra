# Deployment

## Path 1: Local docker-compose (default — this is what you demo on)

This is the path that's guaranteed to work regardless of internet at the venue.

```bash
cp .env.example .env
docker-compose up --build
bash infra/healthchecks/check-all.sh   # confirms every service is alive before you present
```

`docker-compose.yml` runs everything with hot-reload for development.
`docker-compose.prod.yml` runs optimized builds (no hot-reload, restart policies on)
— use this the night before your demo slot to catch any prod-build-only bugs early:
```bash
docker-compose -f docker-compose.prod.yml up --build
```

## Path 2: Hosted backup (optional bonus link, do this only if core product is done)

Deploy **only** the api-gateway + both frontends publicly. Keep ocr-pipeline,
extraction-engine, and gis-service internal (called only by the gateway) —
no reason to expose them and pay for public compute on services nobody hits directly.

Recommended platform: **Railway** (or Render) — near-zero config, deploys straight
from a GitHub push, generous free tier, no need to hand-roll AWS infra in 36 hours.

1. Create a Railway project, connect this GitHub repo.
2. Add a Postgres+PostGIS plugin (Railway has one-click Postgres; enable the
   PostGIS extension via `CREATE EXTENSION postgis;` in their DB console).
3. Set environment variables from `.env.example` in Railway's dashboard — **never
   commit real secrets to the repo**, that's what `infra/secrets/secrets-checklist.md`
   is for.
4. Point `services/api-gateway`, `frontend/upload-portal`, `frontend/dashboard`
   each at their own Railway service, using their respective `Dockerfile`.
5. `.github/workflows/deploy.yml` auto-deploys on merge to `main` once `RAILWAY_PROJECT_ID`
   and Railway's deploy token are set as GitHub Actions secrets.

## CI (`.github/workflows/ci.yml`)
Runs on every PR: lints + runs each service's test suite independently. This is
what catches "you broke my contract" before it reaches `main`, not during the demo.

## Health checks
Every service exposes `GET /health`. `docker-compose.yml` uses this for Docker's
built-in `healthcheck:` directive (so a crashed service shows as unhealthy, not
silently hanging), and `infra/healthchecks/check-all.sh` is a one-command way to
verify the whole stack right before you start pitching.
