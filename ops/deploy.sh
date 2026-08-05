#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
ENV_FILE=${ENV_FILE:-"$ROOT_DIR/.env.production"}
export ENV_FILE
COMPOSE_FILE="$ROOT_DIR/compose.production.yaml"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

sh "$ROOT_DIR/ops/validate-production-env.sh"
"${COMPOSE[@]}" config --quiet

database_container=$("${COMPOSE[@]}" ps -q database 2>/dev/null || true)
directus_container=$("${COMPOSE[@]}" ps -q directus 2>/dev/null || true)
if [[ -n "$database_container" && -n "$directus_container" ]]; then
  bash "$ROOT_DIR/ops/backup.sh"
else
  echo "Noch keine laufende Produktionsinstanz gefunden; vor diesem ersten Deployment ist die dokumentierte Datenübernahme erforderlich."
fi

echo "Baue das Frontend-Image ..."
"${COMPOSE[@]}" build app

echo "Starte Datenbank und Cache ..."
"${COMPOSE[@]}" up -d --wait database cache

echo "Prüfe und ergänze Datenbankmigrationen ..."
"${COMPOSE[@]}" --profile tools run --rm migrate

echo "Lade Directus und Erweiterungen neu ..."
"${COMPOSE[@]}" up -d --force-recreate --wait directus

echo "Aktualisiere Frontend und HTTPS-Proxy ..."
"${COMPOSE[@]}" up -d --wait app proxy

echo "Deployment abgeschlossen."
"${COMPOSE[@]}" ps
