# Isolierter Directus-Integrationstest

Am 11.09.2026 gegen das offizielle Image `directus/directus:11.17.4` erfolgreich
ausgefuehrt. Die Testdatenbank verwendet echte Directus-Systemtabellen und echte
Services, Berechtigungen und HTTP-Endpunkte. Die Firmen-Tabellen sind ein minimales
Testschema aus den benoetigten Codefeldern, kein Export des Produktionsschemas.
Die Premium- und Referral-Migrationen werden unveraendert angewendet.

## Wiederholen

Auf dem Mac im Projektterminal, mit laufendem Docker Desktop:

```sh
node scripts/test-referral-directus.mjs --isolated
```

Vorher nach Extension-Aenderungen `npm run build:referral-extension` ausfuehren.
Der Runner startet einen eindeutig benannten Docker-Stack mit internem Netzwerk,
ohne veroeffentlichte Ports. PostgreSQL liegt in tmpfs, Mailpit nimmt alle Mails
lokal entgegen. Es werden keine .env-Dateien gelesen. Zufaellige Test-Zugangsdaten
liegen nur in einer temporaeren Datei mit Modus 0600 und werden nicht ausgegeben.
Stack und temporaere Dateien werden am Ende auch bei Testfehlern entfernt.

## Verifiziert

- Extension laedt im offiziellen pnpm-basierten Directus-Image.
- Admin erstellt Partner; doppelte Codes werden unabhaengig von Grossschreibung abgelehnt.
- Ungueltige/deaktivierte Codes erzeugen keinen berechtigten neuen Benutzer.
- Die echte Directus-Passwort-Policy lehnt ein zu schwaches Passwort ab.
- Neue Registrierung erzeugt User und Einloesung atomar; ein erzwungener Fehler
  beim Einloesungs-Insert rollt auch den echten UsersService-Insert zurueck.
- Bestaetigungs-Mail trifft im lokalen Mailpit ein; ihr Token wird durch den
  echten Directus-Bestaetigungs-Endpunkt akzeptiert, danach funktioniert Login.
- Erneute Registrierung eines unbestaetigten Users erzeugt keine zweite Einloesung.
- Bereits bestehende Konten erhalten keine nachtraegliche Einloesung.
- Zwei parallele Registrierungen mit demselben Code erzeugen einen User/eine Einloesung.
- Account-Setup bindet die eigene Einloesung an die neue Organisation.
- Echte ItemsService-Freigabe und Premium-Aktivierung funktionieren; wiederholte
  Freigabe/Aktivierung erzeugen keinen zweiten Grant.
- Firmenkonto darf weder freigeben noch Admin-Uebersicht oder Aktivierung nutzen.
- Echter Reviewer ohne Admin-Policy darf freigeben, aber nicht Referral-Admin
  oder manuelle Aktivierung nutzen. Zweites Firmenprofil erhaelt keinen zweiten Trial.
- Freigabe-Mail mit Premium-Hinweis und Admin-Uebersicht funktionieren.
- Directus-E-Mail-Filter wird angewendet; Partner-Deaktivierung erhaelt bestehende Grants.
- Bei ausgeschaltetem Flag lehnen Referral-Endpunkte vor Datenzugriff ab.
  Normale Registrierung und Account-Setup funktionieren selbst dann, wenn die
  Referral-Tabellen im Test voruebergehend umbenannt sind.

## Behobene Laufzeitfehler

Das offizielle Image stellt `jsonwebtoken` und `@directus/utils` nicht direkt
neben den Extensions bereit. Die Erweiterung loest diese Abhaengigkeiten jetzt
vom installierten `@directus/api` aus auf. Bei einem Directus-Upgrade muss dieser
versionsgebundene Zugriff erneut getestet werden.

Directus-Validierungsfehler koennen Eingabewerte enthalten. Die Erweiterung
protokolliert deshalb keine rohen Registrierungs-/Mailfehler mehr und liefert
bei `FAILED_VALIDATION` nur `400 invalid_data` zurueck.

## Weiterhin offen vor produktivem Einsatz

- Aktuelle Serverversion, vollstaendiges Schema und tatsaechliche Policies der
  zentralen Instanz pruefen; keine Aussage ueber deren aktuellen Zustand.
- Der Browserlauf inklusive Firmenprofil-Erfassung, Einreichung, Moderation und
  anschliessender Premium-Bearbeitung ist am 13.09.2026 mit synthetischen
  Stammdaten bestanden; siehe [referral-browser-test.md](referral-browser-test.md).
  Dies ersetzt nicht die Pruefung des produktiven Schemas und seiner Policies.
- Konkurrierende Registrierung ueber verschiedene Codes und den normalen
  Directus-Registrierungsweg ist nicht durch den Paralleltest desselben Codes belegt.
- Auslieferung, Produktionsmigration, Aktivierung und echte Partnercodes bleiben
  gesonderte Schritte mit Zustimmung. Lokal ist das Feature weiterhin standardmaessig aus.

Zusaetzlich bestanden: 33 Unit-/Render-Tests, ESLint, App-TypeScript,
Referral-TypeScript und `git diff --check`. Die vorhandenen Favicons blieben
bytegleich. Kein Commit, Push oder Produktionseinsatz.
