# Sicherheitskorrekturen vom 24. Oktober 2026

Die acht Hinweise aus dem Audit wurden im lokalen Quellcode bearbeitet. Der
ursprüngliche Audit führte sie als `needs_validation`; dieser Bericht beschreibt
die implementierten Schutzmaßnahmen und deren Regressionstests, keine nachträglich
behaupteten Angriffe auf das Produktivsystem. Es wurde nichts deployed und keine
Produktivdatenbank verändert.

## Änderungen

| Bereich | Korrektur |
| --- | --- |
| Stripe-Ereignisse | Subscription-Ereignisse laden den aktuellen Stripe-Zustand. Alte Rechnungsereignisse dürfen die Kündigung nur für die aktuelle, passende Rechnung ändern. Ein DB-Trigger verhindert die Reaktivierung endgültig beendeter Subscription-IDs auch bei konkurrierenden Schreibzugriffen. |
| Login über WebSocket | REST und WebSocket verwenden denselben dauerhaften, normalisierten Kontozähler im nativen `auth.login`-Hook vor der Passwortprüfung. Fehler im Limiter sperren den Versuch. |
| Verifikationsmails | Empfängerübergreifend über alle Partner: 60 Sekunden Abstand und höchstens drei Versuche in 24 Stunden pro normalisierter Adresse; HMAC statt Klartextadresse im Zähler. |
| Moderationsmails | Datenbankseitige Inhaltsversion und eindeutige Versandmarkierung verhindern wiederholte Nachrichten für unveränderte Einreichungen, auch bei parallelen Anfragen. |
| Moderationsentscheidungen | Angezeigte Version muss der gesperrten DB-Zeile entsprechen. Freigabe, Ablehnung und Sperrung laufen transaktional, auch ohne Referral-Feature. Freigegebene Inhalte sind gegen verspätete Editor-Updates geschützt; Beitragsänderungen erzeugen neue Entwürfe. |
| Kostenlose Premium-Freischaltungen | Gemäß Nutzerentscheidung nur Administratoren: native Directus-Admin-Prüfung in API und Seite, passender Navigationseintrag, Schreiben mit Benutzer-Token. Eine Migration entfernt direkte Schreibrechte nichtadministrativer Directus-Policies. |
| Einladungsquoten | Transaktionale Organisationssperre und benutzerbezogene Advisory-Sperre verhindern parallele Überschreitungen, auch über mehrere Organisationen. |
| Teamrollen | Berechtigung und Zielrolle werden nach derselben Organisationssperre erneut geprüft. Eine parallele Beförderung kann nicht mit veralteten Rechten übergangen werden. |

Zusätzlich verwenden Löschung und Moderation dieselbe Sperrreihenfolge, um
Deadlocks zu vermeiden. Ein Mailfehler nach Einladungserstellung überschreibt
keine zwischenzeitlich angenommene Einladung. Die ausgelieferten Extension-Dateien
in `dist` wurden mit ihren Quellen synchronisiert.

## Migration und Auslieferung

Die Korrekturen benötigen alle vier SQL-Migrationen unter `infra/directus/migrations`:

1. `20261024_moderation_snapshot_binding.sql`
2. `20261024_notification_delivery.sql`
3. `20261024_stripe_terminal_state.sql`
4. `20261024_premium_grants_admin_only.sql`

Für die Auslieferung Schreibzugriffe während der Umstellung pausieren, eine
Datenbanksicherung erstellen, die Migrationen mit Fehlerabbruch ausführen und
anschließend Directus mit aktualisierten Extensions sowie das Frontend gemeinsam
neu starten. Die aktuellen Referral-Extensions werden auch bei deaktiviertem
Referral-Feature für die Moderation benötigt. Directus muss sein Schema und seine
Berechtigungen nach den SQL-Änderungen neu laden.

Der eindeutige Stripe-Index bricht bei bereits vorhandenen doppelten Stripe-IDs
bewusst ab. Solche Altbestände vorab prüfen und fachlich bereinigen; die Migration
löscht keine Subscription-Daten automatisch. Die Stripe-Migration ist einmalig
auszuführen. Bereits falsch gespeicherte Altzustände werden durch diese Reparatur
nicht automatisch mit Stripe abgeglichen.

Die Premium-Migration entzieht auch dem bisherigen Frontend-Servicekonto direkte
Schreibrechte auf `premium_grants`. Lesezugriffe zur Berechnung des Premium-Status
bleiben erhalten. Die separat autorisierte interne Referral-Aktivierung bleibt
bestehen. Ein Rückwechsel auf das alte Frontend würde diese Schreibrechte benötigen
und ist daher kein sicherer Rollback.

## Verifikation

Alle ausgeführten Anwendungstests liefen in begrenzten, wegwerfbaren Docker-
Containern ohne externe Netzwerkverbindung, Produktionsschlüssel oder schreibbaren
Quellcode-Mount. Builds arbeiteten mit einer Wegwerfkopie im begrenzten Scratch-
Dateisystem und schreibgeschützten Abhängigkeiten. PostgreSQL war nur über die
isolierte Loopback-Verbindung erreichbar.

- 101 Unit-/Regressionstests erfolgreich: alle `tests/*.test.mjs`, Referral-
  Extensiontests, Admin-Rendering und die drei TypeScript-Testdateien. Enthalten
  sind jetzt auch die vier zuvor nicht ausführbaren Deployment-Shelltests.
- 31 native PostgreSQL-Tests für Team-, Lösch-, Versand- und Stripe-Rennen,
  Premium-Berechtigungen und vollständige Moderations-/Referral-Workflows erfolgreich;
  zusätzlich SQL-Prüfungen der Moderations- und Stripe-Trigger erfolgreich.
- TypeScript: `tsc --noEmit --incremental false` erfolgreich.
- Vollständiger Next.js-16.4.2-Produktionsbuild mit Node 24 erfolgreich.
- 29 HTTP-Prüfungen gegen den gestarteten Standalone-Build mit isoliertem Dummy-CMS:
  öffentliche Seiten, zehn übersetzte Logins, anonyme Dashboard-Sperren, abgewiesene
  Anmeldung sowie CMS-Ausfall und Wiederherstellung erfolgreich.
- ESLint ohne Fehler oder Warnungen.
- Native Directus-12.5.0-Instanz aus leerer PostgreSQL-Datenbank gestartet; aktuelle
  Extensions geladen. Administrator-Anmeldung mit TOTP, `admin_access`, Token- und
  Passwort-WebSocket-Anmeldung sowie gemeinsames REST-/WebSocket-Limit erfolgreich.
- Import der nativen Directus-Berechtigungsfunktion in Directus 12.5.0 erfolgreich.

Die neuen Tests sind über `npm run test:security-repairs` und
`npm run test:security-postgres` zusammengefasst. Die PostgreSQL-Tests benötigen
ausdrücklich wegwerfbare Testdatenbanken und die Variablen
`FINDELIO_TEAM_TEST_DATABASE`, `FINDELIO_DELETION_TEST_DATABASE`,
`FINDELIO_TEST_PG_PORT` und `FINDELIO_TEST_RUNTIME` (Verzeichnis mit `package.json`
und installierten `knex`-/`pg`-Modulen). Die Versandtests erwarten eine leere Datenbank
`findelio_notification_delivery_test`, die Workflow-Tests die leere Datenbank
`findelio_referral_workflow_test`; die übrigen isolieren ihre Tabellen in
zufälligen Schemas. Keine Produktionsverbindung verwenden.

Die vollständigen Unit-Prüfungen stehen unter `npm run test:regression`.
`npm run test:production-smoke` benötigt einen fertigen Standalone-Build,
`FINDELIO_DISPOSABLE_PRODUCTION_TEST=1`, `DIRECTUS_URL=http://127.0.0.1:8055`,
`DIRECTUS_TOKEN=offline-dummy-token` und
`NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000`. Er startet ausschließlich lokale
Fixture-/Frontend-Prozesse und darf nur in einer isolierten Wegwerfumgebung laufen.
Der native Directus-Test (`npm run test:security-native`) nennt seine benötigte
Dummy-Datenbank, Benutzer-, TOTP- und Serverkonfiguration im Dateikopf.

Diese Prüfungen sind kein vollständiger Browser-/Stripe-/Produktivdaten-Test.
Der Frontend-Starttest ersetzt CMS-Inhalte durch Dummy-Antworten; der separate
native Directus-Test überprüft echte Anmeldung und Hooks, aber nicht alle
installierten Produktionspolicies. Die Workflow-Tests ersetzen Directus-Services
teilweise durch Adapter; PostgreSQL-Sperren und Trigger sind real. SMTP-Annahme
und Datenbank-Commit sind nicht atomar: Ein Prozessabsturz genau dazwischen kann
weiterhin eine doppelte Nachricht verursachen.

## Prüfung vor dem Push

Der bestehende Produktionsablauf entdeckt die SQL-Dateien automatisch und führt
sie vor Directus-Neustart, Cache-Leerung und Frontend-Austausch aus. Die Compose-
Konfiguration verwendet bereits Directus 12.5.0. Im lokalen `infra/compose.yaml`
ist keine automatische Migration eingerichtet.

Das Deployment ist nicht ohne Unterbrechung für Schreibaktionen: Während alte
Frontend- und neue Backend-Versionen überlappen, fehlen alten Review-Anfragen
Versionsnummern; alte Premium-Schreibzugriffe verlieren ihre Berechtigung.
Deshalb das oben beschriebene Wartungsfenster verwenden. Stripe-Dubletten vor
Beginn prüfen: Scheitert eine spätere Migration, bleiben vorherige Migrationen
bereits angewendet. Der vorhandene Runner erfasst die Migrationsprüfsumme erst
nach dem SQL-Commit; bei einem Prozessabbruch dazwischen muss der Betreiber den
Datenbank- und Ledger-Stand vor einem erneuten Versuch prüfen.
