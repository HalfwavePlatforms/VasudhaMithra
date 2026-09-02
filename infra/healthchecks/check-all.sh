#!/usr/bin/env bash
# Run this right before you demo. Confirms every service responds before you're
# standing in front of judges finding out something's down.

set -e

SERVICES=(
  "API Gateway|http://localhost:8000/health"
  "OCR Pipeline|http://localhost:8001/health"
  "Extraction Engine|http://localhost:8002/health"
  "GIS Service|http://localhost:8003/health"
  "Upload Portal|http://localhost:3000"
  "Dashboard|http://localhost:3001"
)

FAILED=0

for entry in "${SERVICES[@]}"; do
  NAME="${entry%%|*}"
  URL="${entry##*|}"
  if curl -sf -o /dev/null --max-time 3 "$URL"; then
    echo "OK    $NAME ($URL)"
  else
    echo "DOWN  $NAME ($URL)"
    FAILED=1
  fi
done

if [ "$FAILED" -eq 1 ]; then
  echo ""
  echo "One or more services are down. Run 'docker-compose logs <service>' to debug."
  exit 1
else
  echo ""
  echo "All services healthy. Good to demo."
fi
