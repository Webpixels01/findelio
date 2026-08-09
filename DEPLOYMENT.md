# Findelio in Produktion betreiben

Diese Anleitung beschreibt die vorbereitete Docker-Produktion auf einem Linux-Server. Die Website läuft unter `SITE_DOMAIN`, Directus unter `CMS_DOMAIN`. Caddy übernimmt HTTPS-Zertifikate und deren Erneuerung automatisch.

## Architektur

- `proxy`: Caddy auf den öffentlichen Ports 80 und 443
- `app`: Next.js als nicht privilegierter Benutzer, nur intern auf Port 3000
- `directus`: Directus, nur über die CMS-Domain erreichbar
- `database`: PostgreSQL ohne öffentlichen Port
- `cache`: Redis ohne öffentlichen Port
- dauerhafte Volumes für PostgreSQL, Redis, Directus-Uploads und Caddy-Zertifikate
- rotierende Containerlogs mit höchstens fünf Dateien zu je 10 MB

## Voraussetzungen

- Linux-Server mit Docker Engine und Docker Compose v2
- offene TCP-Ports 80 und 443 sowie UDP-Port 443
- DNS-Einträge für `findelio.ch`, `www.findelio.ch` und beispielsweise `cms.findelio.ch`, die auf den Server zeigen
- geklärter Versand über den vorhandenen SMTP-Zugang
- produktive Zahlungsanbieter-Schlüssel und ein Live-Webhook auf `https://findelio.ch/api/billing/webhook`

Die Domains sind Beispiele aus `.env.production.example` und können vor dem ersten Start geändert werden.

## 1. Projekt und Produktionsvariablen

```bash
git clone https://github.com/Webpixels01/findelio.git /opt/findelio
cd /opt/findelio
cp .env.production.example .env.production
chmod 600 .env.production
```

Danach alle Platzhalter in `.env.production` ersetzen. Zufällige Werte können auf dem Server beispielsweise so erzeugt werden:

```bash
openssl rand -hex 32
openssl rand -hex 48
```

Geheimnisse gehören ausschliesslich in `.env.production`. Diese Datei wird weder von Git noch vom Docker-Build übernommen.

Vor jedem Start validieren:

```bash
sh ops/validate-production-env.sh
docker compose --env-file .env.production -f compose.production.yaml config --quiet
```

## 2. Einmalige Übernahme des aktuellen Datenbestands

Der aktuelle Findelio-Stand besteht nicht nur aus Quellcode, sondern auch aus PostgreSQL-Daten und Directus-Uploads. Beim ersten Livegang werden deshalb der lokale Datenbank-Dump und das Upload-Archiv einmalig auf den Server übertragen.

Diese Wiederherstellung verändert die Zieldatenbank und wird erst durchgeführt, wenn der konkrete Server bereitsteht, ein aktuelles lokales Backup geprüft ist und die Zielpfade eindeutig feststehen. Sie darf nicht auf einer bereits produktiv genutzten Datenbank ausgeführt werden.

Der grundsätzliche Ablauf ist:

1. Lokale PostgreSQL-Datenbank im Custom-Format exportieren.
2. Directus-Uploads als komprimiertes Archiv exportieren.
3. Beide Dateien samt SHA-256-Prüfsummen verschlüsselt auf den Server übertragen.
4. Nur PostgreSQL und Redis starten.
5. Datenbank-Dump in die leere Produktionsdatenbank einspielen.
6. Directus starten und Upload-Archiv in das persistente Upload-Volume einspielen.
7. Einen eigenen Directus-Servicebenutzer beziehungsweise ein eigenes statisches Produktionstoken setzen und `.env.production` aktualisieren.
8. Erst danach `bash ops/deploy.sh` ausführen.

Das in `.env.production.example` gesetzte `MIGRATION_BASELINE` markiert beim ersten Deployment die bereits im übernommenen Datenbestand vorhandenen Migrationen. Der Vorgang wird abgebrochen, falls die erwartete Tabelle `deletion_requests` fehlt. Dadurch kann die Baseline nicht versehentlich auf eine leere Datenbank angewendet werden.

## 3. Erstes Deployment

```bash
bash ops/deploy.sh
```

Der Ablauf validiert die Konfiguration, baut das Frontend, wartet auf Datenbank und Redis, kontrolliert die Migrationen, lädt Directus samt Erweiterungen neu und startet abschliessend Website und HTTPS-Proxy.

Danach prüfen:

```bash
curl --fail https://findelio.ch/api/health
curl --fail https://cms.findelio.ch/server/health
docker compose --env-file .env.production -f compose.production.yaml ps
```

Zusätzlich im Browser testen:

- Startseite und Firmensuche
- Anmeldung und Sitzungserneuerung
- Bildauslieferung über die CMS-Domain
- Registrierung samt Bestätigungsmail
- Team-Einladung
- Admin-Prüfbereich
- Zahlungsabschluss und Live-Webhook

## Absenderlogo in Mailübersichten (BIMI)

Das quadratische Findelio-Absenderlogo liegt als SVG Tiny PS unter `public/bimi-logo.svg`. Nach dem Deployment muss es öffentlich und ohne Anmeldung unter `https://findelio.ch/bimi-logo.svg` erreichbar sein.

Die Aktivierung erfolgt einmalig im Infomaniak Manager:

1. **Service Mail → Globale Sicherheit** öffnen und prüfen, dass SPF, DKIM und DMARC grün sind.
2. Im Bereich **BIMI** auf **Erstellen** klicken.
3. Das Findelio-Logo sowie das von einer anerkannten Zertifizierungsstelle ausgestellte VMC beziehungsweise die von Infomaniak akzeptierte Markenzertifizierung hinterlegen.
4. Den von Infomaniak erzeugten BIMI-DNS-Eintrag speichern.
5. Nach der DNS-Verbreitung kontrollieren, dass `default._bimi.findelio.ch` einen gültigen TXT-Eintrag liefert und eine neue Mail von `info@findelio.ch` testen.

Der vorgesehene Logo-Verweis lautet `https://findelio.ch/bimi-logo.svg`. Mailanbieter entscheiden selbst, ob und wann sie das Logo anzeigen; ältere, bereits empfangene Nachrichten werden dadurch nicht nachträglich verändert.

## Spätere Aktualisierungen

Auf dem Entwicklungsrechner werden Änderungen getestet, committed und auf den freigegebenen Git-Branch übertragen. Auf dem Server:

```bash
cd /opt/findelio
git status --short
git pull --ff-only
bash ops/deploy.sh
```

`ops/deploy.sh` erstellt bei einer bereits laufenden Installation zuerst ein Backup. Bereits angewendete SQL-Migrationen werden anhand von Dateiname und SHA-256-Prüfsumme erkannt. Eine nachträglich veränderte Migration wird abgelehnt; Schemaänderungen müssen immer als neue Datei hinzukommen.

## Backups

Manuelles Backup:

```bash
bash ops/backup.sh
```

Es entstehen:

- `database.dump`
- `directus-uploads.tar.gz`
- `SHA256SUMS`

Backups liegen unter `backups/<UTC-Zeitstempel>/` und werden nicht automatisch gelöscht. Mindestens eine Kopie muss verschlüsselt ausserhalb des Servers gespeichert werden. `.env.production` wird bewusst nicht mitgesichert und benötigt eine separate verschlüsselte Sicherung.

Für automatische tägliche Backups kann später ein systemd-Timer eingerichtet werden. Die Aufbewahrungs- und Löschregel wird erst festgelegt, wenn das externe Backupziel bekannt ist.

## Rollback

Ein reiner Code-Rollback erfolgt auf den zuvor dokumentierten Git-Commit und anschliessend erneut über `bash ops/deploy.sh`. Datenbankmigrationen werden nicht automatisch rückwärts ausgeführt. Falls eine Migration zurückgenommen werden muss, wird nach ausdrücklicher Bestätigung das unmittelbar davor erstellte Datenbank- und Upload-Backup wiederhergestellt.

Vor jedem Rollback festhalten:

```bash
git rev-parse HEAD
docker compose --env-file .env.production -f compose.production.yaml ps
```

## Sicherheitsregeln

- PostgreSQL und Redis niemals öffentlich freigeben.
- `.env.production`, Backups, Tokens und Passwörter niemals committen oder per unverschlüsselter E-Mail versenden.
- Directus-, PostgreSQL-, Redis-, Caddy- und Node-Versionen nur kontrolliert aktualisieren.
- Vor Schemaänderungen, Rollen- oder Berechtigungsänderungen immer ein geprüftes Backup erstellen.
- Serverzugänge ausschliesslich über SSH-Schlüssel; Passwort-Login nach erfolgreicher Einrichtung deaktivieren.
- Betriebssystem- und Docker-Sicherheitsupdates regelmässig einspielen.
