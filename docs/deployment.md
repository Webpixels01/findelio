# Deployment von Findelio

Der vereinbarte Produktionsablauf wird im Repository-Verzeichnis auf dem Server
mit einem zusammenhängenden Befehl ausgeführt:

```bash
git pull --ff-only origin agent/premium-listing-workflows && git merge-base --is-ancestor <COMMIT> HEAD && bash ops/deploy.sh
```

`<COMMIT>` ist vor dem Ausführen durch den tatsächlich gepushten Commit der
gewünschten Änderung zu ersetzen. Im Server-Checkout muss bereits der Branch
`agent/premium-listing-workflows` ausgecheckt sein. `--ff-only` verhindert einen
ungeplanten Merge. Die anschliessende Prüfung verhindert das Deployment, falls
HEAD den erwarteten Commit nicht enthält. Durch `&&` stoppt der Ablauf beim
ersten Fehler.

Nach einer freigegebenen Änderung:

1. Passende Tests und Typprüfung ausführen und den Diff prüfen.
2. Änderungen committen, den aktuellen Branch pushen und den erfolgreichen Push prüfen.
3. Den vollständigen Befehl mit dem konkreten Commit zurückgeben; keine alten
   Commit-IDs aus früheren Antworten wiederverwenden.

`ops/deploy.sh` übernimmt die Prüfung von `.env.production`, berücksichtigt das
konfigurierte Proxy-Overlay, erstellt bei laufender Produktion ein Backup, baut
das Frontend, führt die vorhandenen Migrationen aus, startet Directus und die
Anwendung neu und prüft das Ergebnis. Der Befehl ist ein vollständiges Deployment,
auch wenn die Änderung nur das Frontend betrifft. Ein reiner Frontend-Neustart
ist ein gesonderter Ablauf und ersetzt diesen vereinbarten Standard nicht.

Die Ausgabe `Deployment abgeschlossen.` bestätigt den erfolgreichen Abschluss.
Bei einem Fehler die Ausgabe prüfen, bevor das Skript erneut ausgeführt wird.

## Directus 12.6.0

Produktion und lokale Compose-Konfiguration verwenden `directus/directus:12.6.0`.
Das offizielle Image enthält die erforderliche Node.js-Laufzeit; das separate
Frontend-Image bleibt unverändert. `LICENSE_KEY` bleibt in der Serverumgebung.

Der Deployment-Check erwartet exakt 12.6.0, eine Lizenz aus der Umgebung sowie
lesbare Kantone, Branchen und Sprachen mit dem bestehenden Server-Token.
Bei einem Fehler nach Beginn des CMS-Neustarts wird nur dann automatisch auf
12.5.0 zurückgewechselt, wenn vor diesem Deployment tatsächlich 12.5.0 lief.
Anschliessend werden Version, Lizenzkonfiguration, Lesezugriffe und Website geprüft.
Der Deployment-Befehl endet trotzdem mit einem Fehler: Das Upgrade ist dann nicht
abgeschlossen. Bei anderen Ausgangsversionen erfolgt kein automatischer Downgrade.

`bash ops/recover-directus.sh` ist der manuelle Rückweg von 12.6.0 auf 12.5.0.
Er erstellt ein weiteres Backup, verwendet die vorhandene Datenbank und Uploads
und prüft anschliessend CMS und Website. Er stellt keinen Datenbank-Dump wieder her
und entfernt keine Migrationen. Dieser Ablauf gilt nur für diesen Versionswechsel.
Das Compose-Image im Repository bleibt 12.6.0; ein erneutes reguläres Deployment
würde den Upgrade-Versuch wiederholen.

Der isolierte Upgrade- und Rückfalltest lässt sich so wiederholen:

```bash
node scripts/test-referral-directus.mjs --isolated --upgrade-from-12-5
```

Er benötigt Docker und `LICENSE_KEY` in `.env.local`. Verwendet werden synthetische
Daten, eine eigene PostgreSQL-Datenbank, Redis und ein lokaler Mailfänger. Nach der
Prüfung von 12.5.0 erfolgt das Upgrade derselben Datenbank auf 12.6.0; geprüft werden
Lizenz, Berechtigungen, Registrierung, E-Mails, Premium-Testaktivierung,
Besucherzählung, Rate-Limits und Zwei-Faktor-Authentifizierung. Abschliessend wird
12.5.0 mit der durch 12.6.0 migrierten Datenbank gestartet und auf Lizenz,
Lesezugriffe und Eigentümerberechtigungen geprüft. Die Testlizenz wird freigegeben
und die Testinstanz entfernt. Dies ersetzt keinen vollständigen Test des
Produktionsschemas oder sämtlicher Browserabläufe.
