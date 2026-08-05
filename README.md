# Findelio

Mehrsprachiges Schweizer Firmenverzeichnis mit Next.js, Directus, PostgreSQL und Redis.

## Enthalten

- Next.js 16, TypeScript und Tailwind CSS
- Mehrsprachigkeit mit `next-intl`
- Sprachen: de-CH, EN, SK, CS, HU, PL, RU, PT-PT und RO
- öffentliche Firmensuche und Firmenprofile
- Directus-gepflegter Blog mit SEO-Metadaten und vorbereiteten Artikelentwürfen
- Firmenkonten, Organisationen und Teamverwaltung
- redaktioneller Prüf- und Veröffentlichungsablauf
- Free- und Premium-Einträge samt Zahlungen
- mehrsprachige Oberfläche in neun Sprachen
- Directus-Erweiterungen, E-Mail-Vorlagen und reproduzierbare Migrationen
- lokale sowie vorbereitete produktive Docker-Konfiguration

## Lokal starten

```bash
npm install
npm run dev
```

Directus, PostgreSQL und Redis werden lokal separat über die Infrastruktur-Compose-Datei gestartet:

```bash
docker compose --env-file infra/.env -f infra/compose.yaml up -d
```

Danach öffnen:

```text
http://localhost:3000
```

## Produktion

Die produktive Bereitstellung verwendet `compose.production.yaml`, Caddy mit automatischem HTTPS und eine nicht versionierte `.env.production`.

Die vollständige Anleitung steht in [DEPLOYMENT.md](DEPLOYMENT.md). Vor dem ersten Livegang muss der vorhandene lokale Daten- und Uploadbestand kontrolliert auf den Server übernommen werden.

## Blog

Redaktion, Import und Veröffentlichung der Blogbeiträge sind in [BLOG.md](BLOG.md) beschrieben. Drei deutschsprachige Entwürfe liegen als Directus-Import unter `content/blog-import-de-ch.json` bereit.
