# Empfehlungsverwaltung – lokaler Stand

Die Admin-Oberflaeche ist unter `/{locale}/dashboard/empfehlungen` implementiert.
Nach der spaeteren Aktivierung erscheint sie fuer Directus-Administratoren in
Dashboard → Empfehlungen. Review-Berechtigung allein genuegt nicht.

Moeglich sind:
- Empfehlungsgeber mit Name, festem Code und internen Notizen anlegen.
- Name/Notizen aendern und Codes deaktivieren bzw. reaktivieren.
- Sprachabhaengige Registrierungslinks und Codes kopieren.
- Geworbene Registrierungen, Organisationen und Firmenprofile nach Partner
  und Einloesestatus filtern; 25 Zeilen pro Seite.
- Registrierungsdatum, Testzeitraum und Status sehen; widerrufene/abgelaufene
  Grants unterscheiden. Alle Zeitangaben Europe/Zurich, Stand der letzten Abfrage.
- Ausstehende Aktivierungen erneut versuchen. Die UI liest den Status danach
  erneut und behauptet nicht automatisch eine erfolgreiche Premium-Freischaltung.

Codes bleiben nach dem Anlegen unveraenderlich. Die API akzeptiert bei Updates
kein Code-Feld und keine Zuordnungs-/Grant-Felder. Deaktivierung loescht keine
Historie und veraendert keine vorhandene Testphase. Links verwenden die
konfigurierte oeffentliche Site-URL; bei lokaler Entwicklung also localhost.

## Grenzen und Aktivierung

Das Feature bleibt mit `FINDELIO_REFERRAL_REGISTRATION_ENABLED` standardmaessig
AUS. Kein Eingabefeld, kein Admin-Navigationspunkt und keine neuen Collection-
Abfragen im deaktivierten Ablauf. Die Direktseite liefert dann 404, die neuen
API-Endpunkte lehnen vor Datenzugriff ab. Kein automatischer Fallback auf
Server-Token: Admin-Zugriffe verwenden immer die Benutzersession.

Keine zentrale Directus-Instanz veraendert, keine echten Codes/Registrierungen
angelegt, keine .env-Datei veraendert. Keine Produktion aktiviert und kein
Commit/Push vorgenommen. Die drei vorhandenen ungetrackten Favicons blieben
bytegleich erhalten.

Der isolierte Test mit echter Directus-11.17.4-Laufzeit, Admin-/Review-Policies,
Extension-Laden und Registrierung/E-Mail-Bestaetigung ist inzwischen bestanden;
Details in [referral-integration.md](referral-integration.md).
Browserinteraktionen gegen echte lokale APIs inklusive Firmenprofil-Freigabe sind
inzwischen bestanden (siehe referral-browser-test.md). Vor Aktivierung bleiben
die Pruefung der tatsaechlichen Serverversion, des Schemas und der produktiven Policies offen.
Danach erst eine gesondert freigegebene Migration/Extension-Auslieferung und
Aktivierung. Die Laufzeitversion der zentralen Instanz wurde nicht verifiziert.

## Pruefungen dieses Schritts

- Insgesamt 33 Unit-/Render-Tests bestanden: Daten, Registrierung, Freigabe,
  Admin-Validierung und Zugriffssperren. Render-Tests mit befuellten, leeren
  und Fehlerzustaenden in allen neun Sprachen; jeweils alle benoetigten Texte da.
- 12 PostgreSQL-Tests bestanden, darunter neuer Admin-Test fuer Anlegen,
  doppelte Codes, Deaktivierung, unveraenderte Historie und Seitennavigation.
  Echte SQL-Abfragen/Constraints/Transaktionen; ItemsService/Policy-Auswertung
  bleiben Testadapter. Keine Behauptung eines Directus-E2E-Tests.
- ESLint, App-TypeScript, Referral-TypeScript und git diff --check bestanden.
- Desktop- und Mobilansicht der tatsaechlichen React-Komponente mit lokalen
  Beispieldaten visuell geprueft. Statische Vorschau, keine vollstaendige
  interaktive Browserpruefung. Vorschau und Testcontainer wieder geschlossen.
- Kein Next-Build mit moeglichen CMS-Abfragen ausgefuehrt.

`npm run test:referral-admin` fuehrt Validierung/Zugriffstests und die Render-
Tests aus. Die bestehende PostgreSQL-Testdatei ist um die Admin-Tests erweitert.
`npm run build:referral-extension` synchronisiert die neuen Extension-Dateien
nach dist. Die neun Sprachdateien enthalten einen neuen Referrals-Bereich und
einen Navigationseintrag; bestehende Uebersetzungen bleiben erhalten.

## In diesem Schritt geaenderte oder neue Dateien

- `app/[locale]/dashboard/empfehlungen/page.tsx`
- `app/[locale]/dashboard/layout.tsx`
- `app/api/admin/referrals/[id]/route.ts`
- `app/api/admin/referrals/route.ts`
- `components/dashboard-nav.tsx`
- `components/referral-admin-manager.tsx`
- `docs/referral-admin.md`
- `docs/referral-approval.md`
- `infra/directus/extensions/directus-extension-findelio-referrals/dist/index.js`
- `infra/directus/extensions/directus-extension-findelio-referrals/dist/referral-admin.js`
- `infra/directus/extensions/directus-extension-findelio-referrals/src/index.js`
- `infra/directus/extensions/directus-extension-findelio-referrals/src/referral-admin.js`
- `infra/directus/extensions/directus-extension-findelio-referrals/src/referral-admin.test.mjs`
- `lib/referral-admin-server.ts`
- `lib/referral-admin-types.ts`
- `messages/cs.json`
- `messages/de-ch.json`
- `messages/en.json`
- `messages/hu.json`
- `messages/pl.json`
- `messages/pt-pt.json`
- `messages/ro.json`
- `messages/ru.json`
- `messages/sk.json`
- `package.json`
- `tests/referral-admin-render.mjs`
- `tests/referral-workflow.postgres.mjs`
