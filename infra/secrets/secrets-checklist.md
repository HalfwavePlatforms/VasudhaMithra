# Secrets Checklist

Never commit real values for these — `.env` is gitignored, `.env.example` is the
committed template with placeholders only.

## Local (.env)
- [ ] `POSTGRES_PASSWORD`
- [ ] `GOOGLE_VISION_API_KEY` (if using Google Vision over Tesseract)

## Hosted (Railway dashboard → each service's "Variables" tab)
- [ ] `DATABASE_URL` (Railway auto-generates this if you use their Postgres plugin)
- [ ] `GOOGLE_VISION_API_KEY`
- [ ] `OCR_SERVICE_URL`, `EXTRACTION_SERVICE_URL`, `GIS_SERVICE_URL` — set these to
      the *internal* Railway service URLs, not localhost
- [ ] `VITE_API_BASE_URL` — set to the public api-gateway URL for both frontends

## GitHub Actions secrets (Settings → Secrets and variables → Actions)
- [ ] `RAILWAY_TOKEN` — only needed if using `.github/workflows/deploy.yml`

## If a key leaks (e.g. accidentally committed)
1. Rotate it immediately in the provider's console — assume it's compromised
   the moment it hits a public repo, even for a few seconds.
2. Force-push a history rewrite only if the repo isn't already public/forked —
   otherwise rotating the key is the real fix; scrubbing history after the fact
   doesn't undo exposure.
