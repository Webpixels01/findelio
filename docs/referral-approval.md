# Referral-Freigabe: lokaler Implementierungsstand

Stand: 11. September 2026. Feature standardmaessig deaktiviert.
Die zentrale Directus-Instanz wurde weder gelesen noch veraendert.
Kein Commit, Push oder Deployment. Die Referral-Migration wurde nur gegen
leere, wegwerfbare lokale PostgreSQL-Fixtures ausgefuehrt.

## Ablauf

Bei deaktiviertem `FINDELIO_REFERRAL_REGISTRATION_ENABLED` bleibt der bisherige
Next-Freigabeweg bestehen. Neue Endpoints verweigern den Zugriff vor Schema-/
Referral-Abfragen. Das Flag muss spaeter bewusst in App und Directus gesetzt
werden; diese Umsetzung aendert keine `.env`-Datei.

Bei aktivem Feature ruft Next `/findelio-referrals/approve-revision` mit der
Benutzersession und ausschliesslich der Revisions-ID auf:

1. Dieselbe volle Review-Berechtigung wie `hasListingReviewAccess` pruefen,
   zusaetzlich Services mit der Accountability des Aufrufers verwenden.
2. Organisation, Listing, Revision und Einloesung in konsistenter Reihenfolge
   sperren. Die gesamte Freigabe wird pro Organisation serialisiert.
3. Erstes berechtigtes Profil, Start, festes Ende und Entscheidung speichern.
   Historische Freigaben oder `published_at` verhindern einen nachtraeglichen
   Test fuer bereits veroeffentlichte Organisationen (`void`).
4. Profilfelder, Branchen, Sprachen, Galerie, Oeffnungszeiten und Revision
   in derselben Transaktion aktualisieren. Optionale, nicht eingereichte
   Felder bleiben erhalten. Action-Hooks erst nach Commit ausloesen.
5. In einer zweiten Transaktion reservierte Einloesung aktivieren. Grant und
   dessen eindeutige Zuordnung werden gemeinsam committed. Scheitert dies,
   bleibt `pending_activation` bestehen. Kein REST-Aufruf innerhalb der Trx.
6. Die bestehende Decision-Mail folgt danach. Ihr Text liest den gespeicherten
   Status und den tatsaechlichen Grant, nicht ein Client-Ergebnis.

Bei vorhandenem Premium bleibt die damalige Entscheidung dauerhaft gespeichert.
Erscheint Premium erst zwischen Freigabe und Aktivierung, bleibt
`trial_decision = eligible`; Status und `skip_reason = activation_*` dokumentieren
warum trotzdem kein neuer Grant entstand. Die vorbereitete Migration erlaubt
nun diesen Fall und fordert bei Aktivierungszustaenden eine vollstaendige
Reservierung. Bestehende Abos und Grants werden nicht veraendert.

Ein abgelaufener Zeitraum endet als `expired_unactivated`. Re-Approve, Retry
und Widerruf eines bereits erstellten Grants erzeugen keinen neuen Zeitraum.
Der bestehende Premium-Lesepfad wertet `ends_at` aus; es entsteht kein Stripe-Abo.

## Wiederaufnahme und Rechte

- `POST /findelio-referrals/activate`, Body `redemption_id`: nur echte Directus-
  Admin-Accountability. Review-Rechte allein reichen nicht.
- Next-Proxy: `POST /api/admin/referrals/[id]/activate`, Session und Origin-Pruefung,
  Directus kontrolliert die Admin-Rechte unabhaengig davon nochmals.
- Keine beliebigen Listing-, Org-, Datums- oder Grant-Daten vom Client.
- Keine neuen Collection-Berechtigungen vergeben.
- Die Admin-Oberflaeche wurde im nachfolgenden Schritt ergaenzt; siehe
  `docs/referral-admin.md`. Sie zeigt `pending_activation` mit Retry-Moeglichkeit. Der Retry-Endpunkt
  selbst verschickt keine weitere Kundenmail.

Die neuen Referral-Abschnitte der Mail liegen in neun Sprachen vor. Sie verwenden
das optionale Directus-Feld `directus_users.language`, sonst Deutsch (CH).
Der schon bestehende deutsche Mailrahmen wurde nicht komplett lokalisiert.

## Build und Tests auf dem Mac im Projektterminal

- `npm run build:referral-extension`: transpiliert die bestehende getestete
  `lib/referral-dates.ts` in die JS-Laufzeit der Extension und synchronisiert dist.
- `npm run test:referral-dates`
- `npm run test:referral-registration`
- `npm run test:referral-approval`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run typecheck:referral-dates`
- `git diff --check`

Ergebnis: 29 Unit-Tests erfolgreich, ESLint und beide Typpruefungen erfolgreich.
Node meldet bei den bereits vorhandenen TS-Tests einen Hinweis zur impliziten
ES-Modulerkennung; die Tests bestehen. Kein Next-Build ausgefuehrt: TypeScript
wurde separat geprueft, ohne moegliche Build-Abfragen gegen das zentrale CMS.

`tests/referral-workflow.postgres.mjs` ist ein expliziter Opt-in-Test mit einer
leeren DB namens `findelio_referral_workflow_test` auf `127.0.0.1`.
Er liest ausschliesslich `FINDELIO_TEST_PG_PORT` und `FINDELIO_TEST_RUNTIME`.
Der Runtime-Pfad enthaelt separat installierte `knex@3.1.0` und `pg@8.16.3`.
Es werden keine Projekt-Env-Dateien geladen. Das Skript legt Fixture-Tabellen an
und fuehrt die echte Premium- und Referral-Migration darauf aus.
Es ist absichtlich nicht gegen eine bereits bestehende DB wiederholbar.

11 Tests erfolgreich: parallele Freigaben/Aktivierungen, Rollback inklusive
Fehler NACH Grant-Insert, stabile Zeitraeume, vorhandenes/spaeteres Premium,
Ablauf, historische Freigabe, normale Freigabe ohne Referral und Constraints.
Die Transaktionen, SQL-Abfragen, Locks und Constraints laufen auf echtem
PostgreSQL 17. ItemsService und PermissionsService werden durch schlanke
Testadapter ersetzt. Das ist KEIN Directus-End-to-End-Test.
Der verwendete Wegwerf-Container wurde danach entfernt.

## Noch vor Aktivierung erforderlich

- Extension-Laden, reale Admin-/Reviewer-Berechtigungen, Service-Transaktionen,
  Registrierung/Bestaetigung/Org-Bindung, lokaler Mailversand und Feature-off
  sind inzwischen mit Directus 11.17.4 getestet (siehe referral-integration.md).
  Produktionsversion, produktive Filter/Presets und Audit/Action-Hooks bleiben
  gesondert zu pruefen.
- Der volle Review-Check verwendet denselben versionierten Evaluator wie
  `/permissions/me`, lazy ueber den API-Package-Export geladen. Kein stiller
  Fallback auf reduzierte Rechte, wenn das Modul fehlt.
- Browserablauf ueber Next-Registrierung, Profilerfassung, Moderation und
  Premium-Bearbeitung am 13.09.2026 bestanden (referral-browser-test.md).
- Parallel eintreffende Stripe-Webhook-Updates und manuelle Grant-Aenderungen
  gegen die reale Directus-Laufzeit pruefen. Die Tests decken parallele Referral-
  Vorgaenge und zwischen den Phasen hinzugekommenes Premium ab.
- Admin-Verwaltung fuer Partner, Codes, Uebersicht und Retry ist inzwischen
  lokal implementiert (siehe referral-admin.md). Das Gesamtsystem ist noch
  nicht produktiv aktiviert.

Verwendete Directus-11.17.4-Vertraege:
- [ItemsService, Trx und bypassEmitAction](https://github.com/directus/directus/blob/v11.17.4/api/src/services/items.ts)
- [PermissionsService](https://github.com/directus/directus/blob/v11.17.4/api/src/services/permissions.ts)
- [permissions/me-Evaluator](https://github.com/directus/directus/blob/v11.17.4/api/src/controllers/permissions.ts)
- [API-Package-Exports](https://github.com/directus/directus/blob/v11.17.4/api/package.json)

## In diesem Umsetzungsschritt geaenderte Dateien

- Neu: `app/api/admin/referrals/[id]/activate/route.ts`
- Neu: `docs/referral-approval.md`
- Geaendert: `infra/directus/extensions/directus-extension-findelio-referrals/dist/index.js`
- Neu: `infra/directus/extensions/directus-extension-findelio-referrals/dist/referral-approval.js`
- Neu: `infra/directus/extensions/directus-extension-findelio-referrals/dist/referral-dates.js`
- Geaendert: `infra/directus/extensions/directus-extension-findelio-referrals/src/index.js`
- Neu: `infra/directus/extensions/directus-extension-findelio-referrals/src/referral-approval.js`
- Neu: `infra/directus/extensions/directus-extension-findelio-referrals/src/referral-approval.test.mjs`
- Neu: `infra/directus/extensions/directus-extension-findelio-referrals/src/referral-dates.js`
- Geaendert: `infra/directus/extensions/directus-extension-findelio-review-notification/dist/index.js`
- Neu: `infra/directus/extensions/directus-extension-findelio-review-notification/dist/referral-mail.js`
- Geaendert: `infra/directus/extensions/directus-extension-findelio-review-notification/src/index.js`
- Neu: `infra/directus/extensions/directus-extension-findelio-review-notification/src/referral-mail.js`
- Geaendert: `infra/directus/migrations/20260910_referral_system.sql`
- Geaendert: `lib/directus-review.ts`
- Geaendert: `package.json`
- Neu: `scripts/build-referral-extension.mjs`
- Neu: `tests/referral-workflow.postgres.mjs`
