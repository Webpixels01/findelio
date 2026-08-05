#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ENV_FILE=${ENV_FILE:-"$ROOT_DIR/.env.production"}

if [ ! -f "$ENV_FILE" ]; then
  echo "Fehlt: $ENV_FILE" >&2
  echo "Kopiere .env.production.example nach .env.production und trage die Produktionswerte ein." >&2
  exit 1
fi

required_variables="
SITE_DOMAIN
CMS_DOMAIN
ACME_EMAIL
POSTGRES_DB
POSTGRES_USER
POSTGRES_PASSWORD
DIRECTUS_SECRET
DIRECTUS_ADMIN_EMAIL
DIRECTUS_ADMIN_PASSWORD
DIRECTUS_TOKEN
DIRECTUS_EMAIL_SMTP_USER
DIRECTUS_EMAIL_SMTP_PASSWORD
ADMIN_NOTIFICATION_EMAIL
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_PREMIUM_MONTHLY
STRIPE_PRICE_PREMIUM_YEARLY
"

for variable_name in $required_variables; do
  value=$(sed -n "s/^${variable_name}=//p" "$ENV_FILE" | tail -n 1 | tr -d '\r')
  if [ -z "$value" ]; then
    echo "Fehlender Wert in .env.production: $variable_name" >&2
    exit 1
  fi
done

if grep -Eq '=(change-me|.*_change-me|admin@example\.com)([[:space:]]|$)' "$ENV_FILE"; then
  echo "Die Produktionsdatei enthält noch Platzhalterwerte." >&2
  exit 1
fi

site_domain=$(sed -n 's/^SITE_DOMAIN=//p' "$ENV_FILE" | tail -n 1 | tr -d '\r')
cms_domain=$(sed -n 's/^CMS_DOMAIN=//p' "$ENV_FILE" | tail -n 1 | tr -d '\r')

case "$site_domain$cms_domain" in
  *://*|*/*|*' '*)
    echo "SITE_DOMAIN und CMS_DOMAIN müssen reine Domainnamen ohne https://, Pfad oder Leerzeichen sein." >&2
    exit 1
    ;;
esac

echo "Produktionsvariablen sind vollständig und enthalten keine bekannten Platzhalter."
