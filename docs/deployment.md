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
