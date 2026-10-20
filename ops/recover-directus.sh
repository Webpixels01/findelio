#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
ENV_FILE=${ENV_FILE:-"$ROOT_DIR/.env.production"}
export ENV_FILE
sh "$ROOT_DIR/ops/validate-production-env.sh"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$ROOT_DIR/compose.production.yaml")
compose_overlay=$(sed -n 's/^COMPOSE_OVERLAY_FILE=//p' "$ENV_FILE" | tail -n 1 | tr -d '\r')
if [[ -n "$compose_overlay" ]]; then
  if [[ "$compose_overlay" != "compose.production.external-proxy.yaml" ]]; then
    echo "Nicht erlaubtes Compose-Overlay: $compose_overlay" >&2
    exit 1
  fi
  COMPOSE+=( -f "$ROOT_DIR/$compose_overlay" )
fi
"${COMPOSE[@]}" config --quiet
if ! "${COMPOSE[@]}" config --images | grep -Fxq 'directus/directus:11.17.4'; then
  echo "Reparatur abgebrochen: Compose muss Directus 11.17.4 verwenden." >&2
  exit 1
fi
container=$("${COMPOSE[@]}" ps -q directus)
if [[ -z "$container" ]]; then
  echo "Reparatur abgebrochen: laufender Directus-Container fehlt." >&2
  exit 1
fi
case "$(docker inspect --format '{{.Config.Image}}' "$container")" in
  directus/directus:12.5.0|directus/directus:11.17.4) ;;
  *) echo "Reparatur abgebrochen: unerwartete CMS-Version." >&2; exit 1 ;;
esac

echo "Lade die zuvor verwendete CMS-Version ..."
"${COMPOSE[@]}" pull directus
echo "Sichere den aktuellen Datenbestand ..."
bash "$ROOT_DIR/ops/backup.sh"

# The tested 12.5 additions are retained. Do not restore a dump, run down
# migrations, delete migration records or change users, policies or content.
echo "Starte Directus 11.17.4 mit der bestehenden Datenbank und den bestehenden Uploads ..."
"${COMPOSE[@]}" up -d --no-deps --force-recreate --wait directus
echo "Leere ausschliesslich die CMS-Daten- und Systemcaches ..."
"${COMPOSE[@]}" exec -T directus node cli.js cache clear
echo "Prüfe Website und Sicherheitsfunktionen ..."
"${COMPOSE[@]}" exec -T app node --input-type=module - < "$ROOT_DIR/ops/check-deployment.mjs"
echo "CMS-Reparatur abgeschlossen."
