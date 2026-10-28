# Vietnamesisch

Die Website verwendet `vi` (`/vi`), das Sprachmenü `VI` und die
Firmenbeschreibung `Tiếng Việt`. Die Übersetzungen der Directus-Stammdaten
verwenden entsprechend dem vorhandenen Schema `vi-VN`. Als gesprochene
Firmensprache wird `vi` verwendet.

## Umfang

- Alle 992 Oberflächentexte sind in `messages/vi.json` übersetzt, einschliesslich
  Formulare, Dashboard, Premium, Empfehlungen und rechtliche Seiten.
- Sprachwechsel, HTML-Sprache, Suchmaschinen-Verweise und Social-Media-Metadaten
  berücksichtigen Vietnamesisch. Sitemap und Robots-Regeln nutzen die zentrale
  Sprachliste automatisch.
- Premium-Firmenbeschreibungen können auf Vietnamesisch gespeichert, geprüft
  und angezeigt werden. Leere Beschreibungsübersetzungen behalten den bisherigen
  deutschen Rückfalltext. Bestehende Firmeninhalte und Blogartikel werden nicht
  automatisch übersetzt.
- Registrierungsbestätigung und Team-Einladungen erhalten vietnamesische Texte;
  die bereits mehrsprachigen Referral-Hinweise und Erfolgsberichte ebenfalls.
  Andere bislang deutsche Server-Benachrichtigungen bleiben unverändert.

## Vor dem späteren Deployment

Die neue Migration `infra/directus/migrations/20261005_vietnamese_locale.sql`
muss vor dem Start der neuen App und Directus-Extensions angewendet werden.
Der bestehende Deployment-Ablauf übernimmt diese Reihenfolge. Die Migration:

- ergänzt `vi` in den Locale-Checks und Directus-Auswahllisten für
  Team-Einladungen, Löschanfragen und Blogartikel;
- ergänzt `vi-VN` in `languages` und `vi` in `spoken_languages`;
- ergänzt vietnamesische Namen für die 39 bestehenden Branchen und die dann
  27 gesprochenen Sprachen sowie den Namen Vietnamesisch in den neun bisherigen
  Website-Sprachen;
- erhält bestehende IDs, Einträge, Übersetzungen und sonstige Feldoptionen.

Die Produktions-Compose-Datei erlaubt zusätzlich den Bestätigungslink
`https://${SITE_DOMAIN}/vi/registrierung-bestaetigen`.
Der lokale Compose-Stack erlaubt `http://localhost:3000/vi/registrierung-bestaetigen`.
Eigene Testports benötigen wie bisher eine passende Directus-Allowlist.

Eine lokale App, die das zentrale CMS nutzt, zeigt die Stammdaten bis zur
freigegebenen Migration noch in der bisherigen Sprache. Die Firmensprache
Vietnamesisch erscheint dort ebenfalls erst nach der Migration. Das ist kein
Fallback auf eine englische Oberflächendatei.

## Prüfungen

- `npm run test:i18n`: vollständige Schlüssel, ICU-Platzhalter, Rich-Text-Tags,
  Zahlenfälle, Mail-Lokalisierung und Directus-Auslieferungsdateien.
- `node tests/vietnamese-migration.postgres.mjs --isolated`: wegwerfbarer
  PostgreSQL-17-Container ohne Netzwerk oder Host-Ports. Prüft Bestandsdaten,
  neue Stammdaten, Locale-Checks, Feldoptionen und wiederholtes Ausführen.
- `node scripts/test-referral-directus.mjs --isolated`: echte Directus-11.17.4-
  Registrierung mit vietnamesischer Bestätigungsmail, lokalem Mailpit und
  Aktivierung; keine extern zugestellten E-Mails.
- `npm run lint`, `npx tsc --noEmit --incremental false`, `npm run build`.

Die Migration ist für einen später ausdrücklich freigegebenen Produktionseinsatz
vorbereitet. Ihre lokale Prüfung allein bestätigt keine Live-Aktivierung.
