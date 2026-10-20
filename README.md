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

## Sicherheitsprüfungen

```bash
npm ci
npm run test:security
npm run lint
npx tsc --noEmit --incremental false
node scripts/test-referral-directus.mjs --isolated
node scripts/test-referral-directus.mjs --isolated --recover-from-12
node scripts/test-referral-directus.mjs --isolated --licensed-upgrade
```

Die Docker-Testbefehle erstellen eine kurzlebige Umgebung mit eigener
Datenbank und lokalem Mailpit; Produktionsdaten und echte E-Mail-Empfänger
werden nicht verwendet. Sie prüfen auch gleichzeitige Anfragen, direkte
CMS-Zugriffe und die Kompatibilität der Directus-Erweiterungen. Mit
`--recover-from-12` werden vor dem Upgrade gefilterte Berechtigungen und
öffentliche/private Beispieldaten angelegt. Der Test reproduziert die
Sperre unter Directus 12 und prüft die Wiederherstellung des Zugriffs unter
Directus 11 mit derselben Datenbank, unveränderten Regeln und Redis-Caches.
`--licensed-upgrade` benötigt `LICENSE_KEY` in der ignorierten `.env.local`.
Er prüft 11.17.4 → 12.5.0 mit aktiver Lizenz, bestehenden gefilterten Regeln
und getrennten Eigentümerzugriffen. Nur der Test-CMS erhält dafür ausgehenden
Netzwerkzugriff zur Directus-Lizenzprüfung. Die Testaktivierung wird vor dem
Löschen der Testdatenbank freigegeben; schlägt dies fehl, bleibt die Instanz
zur Wiederherstellung erhalten. Der Schlüssel wird nicht ausgegeben.
Nach Änderungen an den beiden Sicherheits-Erweiterungen
`npm run build:security-extensions` ausführen.

Für die bisher ungepatchte Entwicklungsabhängigkeit `braces` liegt eine
dokumentierte lokale Korrektur unter [vendor/braces/SECURITY.md](vendor/braces/SECURITY.md).
Die Rollout-Voraussetzungen des Sicherheitsupdates stehen in
[DEPLOYMENT.md](DEPLOYMENT.md#sicherheitsupdate-vom-20102026).

Der Test des fertigen Produktionsimages verwendet ein internes Test-Backend:

```bash
docker build -t findelio-security-test \
  --build-arg NEXT_PUBLIC_SITE_URL=https://site.example \
  --build-arg DIRECTUS_URL=http://127.0.0.1:1 \
  --build-arg DIRECTUS_PUBLIC_URL=https://cms.example .
docker run --rm --network none --entrypoint node \
  --mount "type=bind,source=$PWD/tests/security-production.mjs,target=/tmp/security-production.mjs,readonly" \
  --mount "type=bind,source=$PWD/ops/check-deployment.mjs,target=/tmp/check-deployment.mjs,readonly" \
  findelio-security-test /tmp/security-production.mjs
```

## Blog

Redaktion, Import und Veröffentlichung der Blogbeiträge sind in [BLOG.md](BLOG.md) beschrieben. Drei deutschsprachige Entwürfe liegen als Directus-Import unter `content/blog-import-de-ch.json` bereit.
