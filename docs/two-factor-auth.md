# Zwei-Faktor-Authentifizierung

Findelio verwendet die TOTP-Funktion von Directus 12.5.0. Es gibt keinen neuen
Anmeldedienst. Der QR-Code wird mit `qrcode.react` lokal im Browser gezeichnet;
Schlüssel werden nicht an einen QR-Code-Dienst geschickt.

## Verhalten

- Für Konten mit Directus-Administratorrechten ist 2FA Pflicht. Das gilt auch
  für direkt zugewiesene Richtlinien und geerbte Rollen. Die Firmenkonto-Rolle
  und Administratoren innerhalb einer Kundenorganisation bleiben freiwillig,
  solange sie keine globalen Directus-Administratorrechte haben.
- Kunden finden die Einrichtung im Dashboard unter **Kontosicherheit** oder
  direkt unter `/de-ch/konto/sicherheit`. Ohne Aktivierung bleibt ihr Login gleich.
- Die Einrichtung verlangt das aktuelle Passwort, die Sicherung des
  Wiederherstellungsschlüssels und einen gültigen sechsstelligen Code.
- Der Nachweis der Passwortprüfung gilt zehn Minuten und ist an das eigene
  Konto und den erzeugten Schlüssel gebunden. Ein fremder oder veränderter
  Einrichtungsnachweis wird abgelehnt.
- Nach der Einrichtung erfolgt eine neue Anmeldung mit Passwort und Code.
  Kunden können 2FA mit aktuellem Passwort und Code wieder deaktivieren.
  Administratoren können ihre eigene 2FA nicht deaktivieren.
- Einrichtung und Login werden im CMS gegen zu viele Versuche begrenzt.
  Die vorhandenen Login-Limits gelten auch für falsche Authenticator-Codes.

Die Migration setzt bei bestehenden Administratorrichtlinien `enforce_tfa`.
Neue Administratorrichtlinien erhalten die Einstellung ebenfalls. Die
Findelio-Erweiterung sperrt noch nicht eingerichtete Administratoren vor dem
Directus-Cache für normale REST-, GraphQL- und Erweiterungszugriffe sowie
WebSocket-Anmeldungen. Eigenes Profil, Einrichtung und Abmeldung bleiben möglich.
Der native Studio-Dialog initialisiert seine Oberflächendaten schon vor der
Einrichtung. Für diese begrenzte Sitzung liefert die Erweiterung leere
Verwaltungslisten und einen eingeschränkten Zugriffsstatus. Diese Antworten haben
eigene interne Routen, damit zuvor gecachte Verwaltungsdaten nicht ausgegeben
werden. Relationale Erweiterungen der erlaubten Profilabfragen sind gesperrt.
Directus prüft weiterhin die Signatur und Gültigkeit aller Zugangstokens und
die Authenticator-Codes selbst. Das zusätzliche Tokenmerkmal bleibt auch beim
Erneuern einer noch nicht eingerichteten Sitzung erhalten.

## Deployment

Der vorhandene Ablauf `bash ops/deploy.sh` erstellt das Backup, baut das Frontend,
wendet die kleine Richtlinienmigration an und lädt die Erweiterung neu. Es ist
kein Datenimport und keine neue Umgebungsvariable erforderlich. Directus bleibt
auf 12.5.0; der vorhandene `LICENSE_KEY` bleibt unverändert in der Serverumgebung.

Beim ersten geschützten Zugriff richtet ein bestehender Administrator seine
2FA ein. Das funktioniert sowohl in Findelio als auch über den nativen
Directus-Einrichtungsdialog. Erst danach steht die Verwaltung zur Verfügung.
Servicekonten ohne Administratorrechte sind von der Pflicht nicht betroffen.

## Handy verloren

Der bei der Einrichtung angezeigte Schlüssel ist ein dauerhafter TOTP-Schlüssel,
kein einmaliger Wiederherstellungscode. Er gehört in einen sicheren
Passwortmanager oder eine andere sichere Aufbewahrung. Mit diesem Schlüssel
lässt sich derselbe Authenticator auf einem neuen Gerät einrichten.

Sind Gerät **und** Schlüssel verloren, ist kein automatischer E-Mail-Bypass
vorgesehen. Nach verlässlicher Identitätsprüfung kann ein anderer, bereits mit
2FA angemeldeter Directus-Administrator die 2FA des betroffenen Kontos über
die Benutzerverwaltung zurücksetzen (native API: `POST /users/{id}/tfa/disable`).
Der Benutzer muss die 2FA anschließend neu einrichten, wenn sein Konto sie verlangt.

Wenn das einzige Administratorkonto betroffen ist, muss ein befugter
Serverbetreiber nach Backup und Identitätsprüfung gezielt dessen `tfa_secret`
in `directus_users` auf `NULL` setzen, dessen Einträge aus `directus_sessions`
entfernen und den Directus-Cache leeren. Niemals die 2FA-Pflicht global abschalten
oder unbeteiligte Benutzer ändern. Für diesen Notfall gibt es keinen öffentlichen
Findelio-Endpunkt.

Bei Änderung des 2FA-Schlüssels werden die Refresh-Sitzungen widerrufen.
Bereits ausgestellte normale Directus-Access-Tokens haben weiterhin ihre native
kurze Laufzeit; die Änderung ersetzt keine vollständige sofortige Sperrung aller
Access-Tokens. Tokens aus der verpflichtenden Einrichtung erhalten auch nach
Abschluss keine Verwaltungsrechte und müssen durch einen neuen Login ersetzt werden.

## Prüfen

`npm run test:security`, `npm run lint`, `npx tsc --noEmit` und der Docker-Build
prüfen die Anwendung. Die echte Directus-Integration läuft ausschließlich mit
einer temporären Datenbank und lokalem Mailpit:

```sh
node scripts/test-referral-directus.mjs --isolated --licensed-upgrade
```

Der Test liest nur `LICENSE_KEY` aus `.env.local`, prüft die bestehende
Berechtigungs- und Registrierungslogik sowie native und Findelio-2FA und gibt
seine temporäre Lizenzaktivierung vor dem Entfernen der Instanz wieder frei.

Für den zusätzlichen Browsertest muss Playwright über die lokale
Node-Modulauflösung erreichbar sein. Chrome wird über `CHROME_BIN` gewählt
(Standard: Google Chrome unter macOS). Die Ports 3317 und 3318 müssen frei sein.

```sh
docker build -t findelio-two-factor-test:20261020 \
  --build-arg NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3317 \
  --build-arg DIRECTUS_PUBLIC_URL=http://127.0.0.1:3318 .
node scripts/test-referral-directus.mjs --isolated --licensed-upgrade --two-factor-browser
```

Dieser Zusatz startet das Produktionsimage und prüft die Formulare mit
synthetischen Konten. Screenshots unter `/tmp/findelio-two-factor-browser`
enthalten ausschließlich die kurzlebigen Testkonten und deren Testschlüssel.
Er ist nicht für produktive Konten vorgesehen.
