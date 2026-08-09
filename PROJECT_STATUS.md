# Findelio – Projektstatus

Stand: 5. August 2026

## Technischer Rahmen

- Next.js 16.2.12 mit Turbopack
- TypeScript und Tailwind CSS
- next-intl
- Directus 11.17.4
- PostgreSQL 17 Alpine
- Redis 7 Alpine
- Docker Compose
- Massgebende Directus-Compose-Datei: `infra/compose.yaml`

## Sprachen

- `de-ch`
- `en`
- `sk`
- `cs`
- `hu`
- `pl`
- `ru`
- `pt-pt`
- `ro`

## Umgesetzter Stand

- Login und Logout
- Geschütztes Dashboard
- Firmenprofile erstellen und bearbeiten
- Öffentliche Firmenlisten und Detailseiten
- Revisions- und Prüfworkflow für publizierte Einträge
- Admin-Prüfliste und Prüfdetailseite
- Freigeben, ablehnen und suspendieren
- Admin-E-Mail-Benachrichtigung bei neuer Einreichung
- Kanton-Zuordnungsfehler behoben
- Registrierung mit Vorname, Nachname, E-Mail und Passwort
- Passwortregel mit mindestens acht Zeichen, einem Buchstaben, einer Zahl und einem Spezialzeichen
- Directus-E-Mail-Verifizierung
- Eigene Findelio-Bestätigungsseite mit Erfolgsmeldung und Anmeldebutton
- Login nach erfolgreicher Bestätigung bereits getestet
- Firmenkonto-Onboarding für Benutzer ohne aktive Organisationsmitgliedschaft
- Automatische Erstellung einer aktiven Organisation mit aktiver `owner`-Mitgliedschaft

## Registrierung und Directus-E-Mail

- Öffentliche Registrierung ist aktiviert.
- Neue Benutzer erhalten die Rolle `Firmenkonto`.
- E-Mail-Verifizierung ist aktiviert.
- Verify-Endpunkt: `GET /users/register/verify-email?token=...`
- Erlaubte lokale Bestätigungs-URL: `http://localhost:3000/de-ch/registrierung-bestaetigen`
- `USER_REGISTER_URL_ALLOW_LIST` ist im Directus-Service konfiguriert.
- Directus SMTP läuft über Infomaniak mit `info@findelio.ch`; Geheimnisse bleiben ausschliesslich in `infra/.env`.
- Der Directus-Healthcheck verwendet `http://127.0.0.1:8055/server/ping`.
- `infra/directus/templates/user-registration.liquid` ist als eigene deutsche Registrierungsmail vorhanden.
- Das Template-Verzeichnis ist als `/directus/templates` eingebunden.

## Abgeschlossener E-Mail-Test

Am 28. Juli 2026 erfolgreich bestätigt:

1. Neue Registrierungen lösen die Bestätigungs-Mail aus.
2. Betreff und Inhalt erscheinen auf Deutsch.
3. Es ist kein sichtbares Directus-Branding vorhanden.
4. Der Absender wird als `Findelio <info@findelio.ch>` angezeigt.
5. Das horizontale Findelio-Logo ist sichtbar, zentriert und korrekt dargestellt.
6. Der Bestätigungslink funktioniert und führt zur Findelio-Erfolgsmeldung mit Anmeldebutton.

## Anpassung der Registrierungsmail

Am 28. Juli 2026 umgesetzt und erfolgreich getestet:

- Eigenes Layout `infra/directus/templates/findelio-base.liquid` ohne Directus-Logo und Directus-Fusszeile angelegt.
- Registrierungsmail auf das Findelio-Layout umgestellt.
- Lokalen Directus-Hook `directus-extension-findelio-registration-email` angelegt, der ausschliesslich den fest codierten englischen Betreff der Registrierungsmail auf `E-Mail-Adresse bestätigen` ändert.
- Directus neu gestartet; der Startlog bestätigt, dass die Erweiterung geladen wurde.
- Directus-Healthcheck antwortet nach dem Neustart mit HTTP 200.
- Zweite Testregistrierung über eine freigegebene Gmail-Plusadresse ausgelöst. Next.js zeigte die Erfolgsmeldung, Directus antwortete mit HTTP 204 und protokollierte keinen SMTP- oder Erweiterungsfehler.
- Die zweite E-Mail hatte den deutschen Betreff, kein Directus-Logo und eine Findelio-Fusszeile.
- Der sichtbare Absendername war noch `Directus`; der Projektname wurde daraufhin in `Directus → Settings → Project Settings → General → Project Name` auf `Findelio` geändert.
- `GET /server/info` bestätigt den Projektnamen `Findelio`.
- Eine dritte Testregistrierung für den abschliessenden Absendertest wurde ausgelöst. Directus antwortete mit HTTP 204 und protokollierte keinen Mail- oder Hook-Fehler.
- Gmail zeigt den Absender korrekt als `Findelio <info@findelio.ch>` an.
- Das vorhandene horizontale Findelio-Logo wurde als hochauflösende PNG-Datei für die Registrierungsmail aufbereitet.
- Das Logo wird zentriert und als eingebettetes Inline-Bild per Content-ID versendet, damit es nicht von einer öffentlichen URL oder `localhost` abhängt.
- Directus wurde neu gestartet; Healthcheck und Startlog bestätigen den fehlerfreien Betrieb und den geladenen Mail-Hook.
- Eine weitere Testregistrierung für die Logo-Sichtprüfung wurde ausgelöst. Directus antwortete mit HTTP 204 und protokollierte keinen Fehler beim Inline-Anhang.
- Die Sichtprüfung in Gmail bestätigt, dass das eingebettete Logo sichtbar und korrekt zentriert ist.

## Firmenkonto-Onboarding

Am 28. Juli 2026 umgesetzt und lokal vollständig getestet:

- Benutzer mit der Directus-Rolle `Firmenkonto` werden ohne aktive Mitgliedschaft vom Dashboard auf `/{locale}/firmenkonto-einrichten` umgeleitet.
- Die Einrichtungsseite ist in allen neun unterstützten Sprachen vorhanden.
- Die Eingabe wird im Browser und im Next.js-Endpunkt validiert.
- Der Next.js-Endpunkt akzeptiert nur gleichursprüngliche JSON-Anfragen und prüft Sitzung, Benutzerstatus und Firmenkonto-Rolle.
- Die eigentliche Erstellung läuft über den lokalen Directus-Endpunkt `findelio-account-setup`.
- Der Directus-Endpunkt verwendet ausschliesslich die authentifizierte Benutzer-ID und akzeptiert keine fremde Benutzer-ID aus der Anfrage.
- Er prüft in einer Datenbanktransaktion nochmals Benutzerstatus, Rolle und bestehende aktive Mitgliedschaften.
- Organisation und Mitgliedschaft werden innerhalb derselben Transaktion über die offiziellen Directus-Services angelegt.
- Die neue Organisation erhält den Status `active`, das Rechnungsland `CH` und einen eindeutigen Slug.
- Der Benutzer wird mit Rolle `owner` und Status `active` verknüpft.
- Bestehende aktive Mitgliedschaften verhindern eine zweite Einrichtung.
- Die aktiven Mitgliedschaften werden zusätzlich im Next.js-Backend gefiltert und geprüft; die frühere offene Sicherheitsaufgabe ist damit abgeschlossen.

Erfolgreicher End-to-End-Test:

1. Anmeldung mit einem bestätigten Firmenkonto ohne Mitgliedschaft.
2. Automatische Weiterleitung vom Dashboard zur Einrichtungsseite.
3. Testorganisation `Findelio Onboarding Test 2026-07-28` erstellt.
4. Datenbank bestätigt Organisation `active`, Rechnungsland `CH` sowie Mitgliedschaft `owner/active`.
5. Dashboard zeigt eine Organisation und die Testorganisation in der Übersicht.
6. Ein erneuter Aufruf der Einrichtungsseite leitet direkt ins Dashboard zurück.
7. Directus-Startlog bestätigt die geladenen Erweiterungen für Registrierungsmail und Firmenkonto-Einrichtung.

Abschliessende Qualitätsprüfungen:

- `npm run lint`: erfolgreich ohne Warnungen
- `npm run build`: erfolgreich
- Syntaxprüfung beider Directus-Erweiterungsdateien: erfolgreich
- `git diff --check`: keine Whitespace-Fehler

## Prüfworkflow für neue Firmenprofile

Am 28. Juli 2026 analysiert und korrigiert:

- Ein neues Firmenprofil wurde beim Wechsel von `draft` auf `pending` zwar korrekt gespeichert, erzeugte aber keine `listing_revision`.
- Die Admin-Prüfliste liest ausschliesslich `pending`-Revisionen und blieb deshalb leer.
- Der bisherige Mailversand lief direkt im lokalen Next.js-Prozess. Der SMTP-Verbindungsversuch wurde lokal blockiert, dauerte 3,6 Minuten und endete mit einem Socketfehler.
- Neue Firmenprofile erzeugen bei `Zur Prüfung` jetzt eine vollständige `pending`-Revision.
- Die Revision enthält die aktuellen Profilwerte, Branchen und gesprochenen Sprachen sowie die zu prüfenden Felder.
- Wird ein eingereichtes neues Profil abgelehnt, wechselt das Listing zurück auf `draft`, damit es überarbeitet und erneut eingereicht werden kann.
- Prüfungs-Mails werden über den bereits funktionierenden Directus-Mailservice versendet.
- Der neue abgesicherte Directus-Endpunkt `findelio-review-notification` akzeptiert nur authentifizierte Einreicher mit aktiver Organisationsmitgliedschaft oder Administratoren.
- Die Mail verwendet eine eigene Findelio-Vorlage mit eingebettetem Logo und einem direkten Link zum Prüfbereich.
- Neue Prüfungs-Mails führen über die sichere Sitzungsaktualisierung direkt zu `/de-ch/dashboard/pruefung`; falls eine Anmeldung nötig ist, bleibt dieser Zielpfad erhalten.
- Technische Werte der Adressanzeige (`full`, `city`, `hidden`) werden auf der Prüfdetailseite in der jeweils aktiven Sprache verständlich dargestellt.
- Die Empfängeradresse liegt ausschliesslich in der nicht versionierten Datei `infra/.env`; in `infra/compose.yaml` steht nur der Variablenname.
- Prüfungs-Mails verwenden `info@findelio.ch` sowohl als Absender als auch als Empfänger.
- Der bestehende Eintrag `Well & Wow Kitchen by Marina` wurde repariert und besitzt nun eine `pending`-Revision.
- Die Admin-Prüfquelle bestätigt den reparierten Eintrag als genau einen offenen Prüfungsfall.
- Directus hat die Prüfungs-Mail mit HTTP 204 ohne SMTP-Fehler verarbeitet.

Qualitätsprüfungen nach der Korrektur:

- `npm run lint`: erfolgreich
- `npm run build`: erfolgreich
- Syntaxprüfung aller angepassten Directus-Erweiterungsdateien: erfolgreich

## Branchen- und Sprachsuche im Firmenprofil

Am 29. Juli 2026 umgesetzt:

- Die Branchen- und Sprachauswahl im Bearbeitungsformular besitzt jeweils ein eigenes Suchfeld.
- Die Listen werden während der Eingabe sofort gefiltert.
- Die Suche ignoriert Gross-/Kleinschreibung und diakritische Zeichen.
- Bereits ausgewählte, durch einen Suchbegriff ausgeblendete Optionen bleiben ausgewählt und werden weiterhin gespeichert.
- Eine verständliche Leermeldung erscheint, wenn keine Option zum Suchbegriff passt.
- Alle neuen Oberflächentexte sind in den neun unterstützten Sprachen vorhanden.

Ausgangsanalyse der Premium-Profilfelder:

- Öffnungszeiten, Logo und Galerie sind im Directus-Datenmodell vorhanden und werden auf öffentlichen Firmendetailseiten bereits unterstützt.
- Das Firmenprofil-Bearbeitungsformular bot diese Felder vorher noch nicht an.
- Die vorhandene Premium-Abo-Struktur war vorher nicht mit einer Freischaltung dieser Felder im Dashboard verbunden.
- Für Öffnungszeiten besitzt die Firmenkonto-Policy momentan nur Lese- und Änderungsrechte, jedoch keine Erstellen- oder Löschen-Rechte.
- Direkte Logo- und Galerie-Uploads über die Firmenkonto-Policy waren nicht möglich.

Qualitätsprüfungen:

- JSON-Prüfung aller neun Sprachdateien: erfolgreich
- `npm run lint`: erfolgreich ohne Warnungen
- `npm run build`: erfolgreich

## Kostenpflichtige Premium-Profilfunktionen

Am 29. Juli 2026 umgesetzt:

- Logo, Bildergalerie, Öffnungszeiten und Social-Media-Links sind als Premium-Funktionen definiert.
- Die Freischaltung erfolgt ausschliesslich bei einem Abo mit `status=active`, `plan=premium` und einem noch nicht abgelaufenen Abrechnungszeitraum.
- Die Premium-Prüfung erfolgt serverseitig beim Laden des Bearbeitungsformulars, bei jeder Speicherung und bei jedem Bild-Upload.
- Kostenlose Konten sehen die vier Premium-Funktionen als verständlichen gesperrten Bereich.
- Premium-Konten können ein Logo, bis zu zehn Galeriebilder, bis zu drei Öffnungszeitfenster pro Wochentag und je einen Link für sechs unterstützte Social-Media-Plattformen erfassen.
- Bild-Uploads akzeptieren JPEG, PNG und WebP mit höchstens 8 MB pro Datei.
- Uploads werden dem aktuell angemeldeten Benutzer zugeordnet und im vorhandenen öffentlichen Directus-Dateiordner gespeichert.
- Logo, Galerie, Öffnungszeiten und Social Links werden auf öffentlichen Firmenprofilen nur angezeigt, solange das Premium-Abo aktiv ist.
- Nach Ablauf eines Abos bleiben die gespeicherten Daten erhalten, sind aber im Dashboard gesperrt und öffentlich ausgeblendet. Bei einer späteren Reaktivierung stehen sie wieder zur Verfügung.
- Premium-Änderungen sind in den bestehenden Revisions- und Prüfworkflow integriert.
- Logo- und Galeriebilder werden auf der Prüfseite als Vorschau dargestellt; Social Links und Öffnungszeiten werden lesbar formatiert.
- Der vorhandene abgesicherte Next.js-Serverweg übernimmt Datei-, Galerie- und Öffnungszeitenänderungen nach Mitgliedschafts- und Premium-Prüfung. Deshalb waren keine Änderungen an Directus-Rollen oder Policies erforderlich.
- Alle neuen Oberflächentexte sind in den neun unterstützten Sprachen vorhanden.
- Ohne bestehenden aktiven Premium-Datensatz erscheint der gesperrte Zustand.

Qualitätsprüfungen:

- JSON-Prüfung aller neun Sprachdateien: erfolgreich
- `npm run lint`: erfolgreich ohne Warnungen
- `npm run build`: erfolgreich
- `git diff --check`: keine Whitespace-Fehler

Nachkorrektur am 29. Juli 2026:

- Nach der Premium-Erweiterung trat beim Aufruf eines Firmenprofils ohne Galeriebilder ein Browserfehler auf, während alle Directus-Anfragen erfolgreich beantwortet wurden.
- Zur robusten Behandlung des virtuellen Galeriefelds wird die Galerie jetzt erst nach der bestätigten Organisationszugehörigkeit über den abgesicherten Serverweg geladen.
- Leere Galerie- und Social-Link-Werte werden zusätzlich zuverlässig als leere Listen normalisiert.
- `npm run lint` und `npm run build` sind nach der Korrektur erneut erfolgreich.

Lokaler Premium-Funktionstest am 29. Juli 2026:

- Für die lokale Testorganisation `Webpixels` wurde nach ausdrücklicher Freigabe ein aktives Premium-Testabo angelegt.
- Das Testabo verwendet die im Datenmodell hinterlegten Standardwerte (monatlich, CHF 9.90), löst keine externe Zahlung aus und läuft bis 29. August 2026.
- Die Organisation enthält unter anderem das veröffentlichte Testprofil `JAZU Webdesign`.
- Nach der Anmeldung werden Logo, Galerie, Öffnungszeiten und Social-Media-Links im Bearbeitungsformular korrekt entsperrt dargestellt.

Korrekturen nach dem ersten Premium-Test:

- Ein altes Rücksprungziel zur administrativen Prüfseite führte Firmenkonten ohne Prüfungsrechte nach der Anmeldung auf eine 404-Seite.
- Benutzer ohne Prüfungsrechte werden von der Prüfübersicht und deren Detailseiten jetzt stattdessen sicher zum Dashboard weitergeleitet.
- Der beim Logo-Upload angezeigte Eigentümerfehler wurde nicht durch die Organisationsmitgliedschaft verursacht. Die Mitgliedschaft und Eigentümerrolle waren korrekt.
- Ursache war ein fehlender Zugriff des technischen Kontos `Findelio Server` auf die Directus-Systemsammlungen für den öffentlichen Dateiordner und dessen Bildmetadaten.
- Nach ausdrücklicher Freigabe besitzt die `Findelio Server Policy` Lesezugriff ausschliesslich auf den vorhandenen Ordner `Public`, Lesezugriff auf die benötigten Metadaten der dortigen Dateien und Erstellungszugriff für Bilder in diesem Ordner.
- Datei-Update, Datei-Löschung sowie das Erstellen, Ändern oder Löschen von Ordnern bleiben gesperrt. Admin-Zugriff bleibt deaktiviert.
- Der für Directus-Systemsammlungen notwendige App-Access-Schalter ist für diese technische Policy aktiviert.
- Der alte Berechtigungsstand wurde aus dem lokalen Redis-Cache entfernt.
- Die wirksamen Directus-Rechte wurden über die API bestätigt: Public-Ordner und Public-Dateimetadaten liefern HTTP 200; die Policy meldet Datei-Erstellung als freigegeben und Update/Löschen weiterhin als gesperrt.
- Technische Directus-Fehler während eines Bild-Uploads werden nicht mehr fälschlich als fehlende Eigentümerschaft ausgegeben.
- `npm run lint` und `npm run build` sind nach den Korrekturen erfolgreich.

Nachkorrektur der öffentlichen Premium-Abfrage:

- Nach dem erfolgreichen Speichern eines Premium-Änderungsantrags stürzte die öffentliche Unternehmensliste beim Zugriff auf `listing.organization.id` ab.
- Alle veröffentlichten Datensätze besitzen eine gültige Organisation; die Organisation wurde lediglich durch die technische Server-Policy aus der API-Antwort ausgeblendet.
- Die `Findelio Server Policy` darf bei veröffentlichten Listings jetzt zusätzlich die reine Organisations-ID lesen.
- Für die öffentliche Premium-Freischaltung darf sie ausschliesslich aktive Abos mit `plan=premium` und den Feldern Status, Plan, Organisation und Periodenende lesen.
- Die Abfragen verwenden nur die Organisations-ID und benötigen deshalb kein zusätzliches Leserecht auf die Organisationssammlung.
- Fehlende Organisationswerte werden im Code defensiv behandelt und können die öffentliche Seite nicht mehr zum Absturz bringen.
- Die öffentliche Unternehmensliste und das Detailprofil `JAZU Webdesign` liefern nach der Korrektur HTTP 200.
- Das neu hochgeladene Logo befindet sich korrekt in einer offenen `pending`-Revision und wird erst nach der Freigabe in den veröffentlichten Eintrag übernommen.
- Der offene Prüfungsantrag enthält zusätzlich zwei Galeriebilder sowie Öffnungszeiten von Montag bis Freitag, jeweils 09:00–17:00.
- `verification_status=unverified` ist ein vom Veröffentlichungs- und Premiumstatus unabhängiger Zustand und wurde nicht automatisch verändert.
- `npm run lint` und `npm run build` sind nach der Korrektur erfolgreich.
- Ein danach angezeigter Turbopack-HMR-Chunkfehler wurde durch den parallel zum Entwicklungsserver ausgeführten Produktions-Build verursacht.
- Der lokale Next.js-Entwicklungsserver wurde sauber neu gestartet. Die Unternehmensliste lädt anschliessend ohne Browser-Warnungen oder Fehler.

Nachkorrektur der Prüfbenachrichtigung:

- Der Empfänger der administrativen Prüfbenachrichtigung ist korrekt auf `info@findelio.ch` gesetzt und der Mail-Transport ist aktiv.
- Beim ersten Einreichen des bestehenden Prüfungsantrags wurde der Mail-Endpunkt erfolgreich aufgerufen.
- Spätere inhaltliche Änderungen an einem bereits wartenden Antrag aktualisierten bisher nur die Revision, ohne eine neue Benachrichtigung auszulösen.
- Neue Änderungen an einer bereits `pending` gesetzten Revision lösen jetzt erneut eine Prüfmail aus.
- Ein unveränderter erneuter Speichervorgang erzeugt keine doppelte Benachrichtigung.
- Die Premium-Felder erscheinen in der Benachrichtigung als `Firmenlogo`, `Bildergalerie`, `Öffnungszeiten` und `Social-Media-Links` statt mit technischen Feldnamen.
- Die Benachrichtigung für den aktuell offenen Antrag von `JAZU Webdesign` wurde einmalig erneut ausgelöst und vom Directus-Mail-Endpunkt mit HTTP 204 bestätigt.
- `npm run lint` und `npx tsc --noEmit` sind nach der Korrektur erfolgreich.

## Kundenbenachrichtigung nach Prüfentscheidung

Am 29. Juli 2026 umgesetzt:

- Nach einer erfolgreich gespeicherten Prüfentscheidung erhält die Person, die den Eintrag zur Prüfung eingereicht hat, eine E-Mail.
- Bei einer Bestätigung führt der Button direkt zum veröffentlichten Firmeneintrag.
- Bei einer Ablehnung enthält die Mail die Begründung und einen direkten Link zurück zur Bearbeitungsseite.
- Bei einer Sperrung enthält die Mail ebenfalls die Begründung und einen Link zu den Firmeneinträgen im Dashboard.
- Die Mail verwendet das vorhandene Findelio-Layout mit zentriertem Logo und Findelio-Absenderdarstellung.
- Der Benachrichtigungsendpunkt prüft, dass die aufrufende Person die Revision selbst geprüft hat und dass Entscheidung, Revisionsstatus und Eintragsstatus zusammenpassen.
- Die Empfängeradresse sowie Begründungen für Ablehnung und Sperrung werden serverseitig aus der geprüften Revision gelesen. Ein freiwilliger Hinweis bei einer Bestätigung wird aus der authentifizierten Admin-Prüfaktion übernommen, auf höchstens 2000 Zeichen begrenzt und ebenfalls in der Kundenmail angezeigt.
- Ein Fehler beim nachgelagerten Mailversand ändert die bereits erfolgreich gespeicherte Prüfentscheidung nicht; er wird serverseitig protokolliert.
- Eine endgültige Löschaktion existiert im aktuellen Prüfworkflow nicht. Der vorhandene Zustand heisst korrekt `suspended` beziehungsweise „gesperrt“ und wird in der Mail nicht als Löschung bezeichnet.
- `npm run lint`, `npx tsc --noEmit` sowie die Syntaxprüfung aller geänderten Directus-Erweiterungen sind erfolgreich.
- Directus wurde mit der Erweiterung neu gestartet; der neue, nicht öffentlich zugängliche Entscheidungsendpunkt antwortet ohne Anmeldung erwartungsgemäss mit HTTP 401.

## Begriffsumstellung auf Firmeneinträge

Am 29. Juli 2026 umgesetzt:

- Die verwalteten Listings heissen in der sichtbaren Dashboard-Oberfläche jetzt konsequent `Firmeneinträge` statt `Firmenprofile`.
- Die Hierarchie lautet damit verständlich: Benutzerkonto → Organisation → ein oder mehrere Firmeneinträge.
- Navigation, Übersichten, Erstellen, Bearbeiten, Premium-Bereich, Fehlermeldungen und Prüfbereich verwenden die neue Begriffswelt.
- Öffentliche Formulierungen wie `Profil ansehen` sowie Bezeichnungen für Social-Media-Profile bleiben erhalten, weil sie tatsächlich die öffentliche Profilansicht beziehungsweise externe Profile beschreiben.
- Technische Routen wie `/dashboard/firmenprofile` und interne Datenfeldnamen bleiben unverändert; dadurch war keine Migration oder URL-Weiterleitung nötig.
- Die Terminologie wurde sprachgerecht in allen neun unterstützten Sprachen angepasst.
- Die deutschen Dashboard- und Bearbeitungsseiten wurden im Browser geprüft. Die längeren Bezeichnungen passen ohne Layoutprobleme, und die Browserkonsole bleibt fehlerfrei.
- JSON-Prüfung aller Sprachdateien, `npm run lint` und `npx tsc --noEmit` sind erfolgreich.

## Lightbox für die öffentliche Bildergalerie

Am 29. Juli 2026 umgesetzt:

- Galeriebilder öffnen sich auf öffentlichen Firmenprofilen nicht mehr in einem neuen Browserfenster, sondern in einer grossformatigen Lightbox über der aktuellen Seite.
- Die Lightbox bietet Vor-/Zurück-Navigation, einen Bildzähler und einen gut sichtbaren Schliessen-Button.
- Sie lässt sich zusätzlich mit Escape sowie durch einen Klick ausserhalb des Bildbereichs schliessen.
- Die Pfeiltasten links und rechts wechseln zwischen den Bildern.
- Während die Lightbox geöffnet ist, wird das Scrollen der Hintergrundseite unterbunden.
- Nach dem Schliessen kehrt der Tastaturfokus zum zuletzt geöffneten Galeriebild zurück.
- Bedienungstexte und barrierefreie Bildbeschriftungen sind in allen neun unterstützten Sprachen vorhanden.
- Die Funktion wurde am öffentlichen Profil `JAZU Webdesign` mit zwei Bildern geprüft. Öffnen, Navigation, Schliessen, Fokuswiederherstellung und Scroll-Freigabe funktionieren; die Browserkonsole bleibt fehlerfrei.
- JSON-Prüfung aller Sprachdateien, `npm run lint` und `npx tsc --noEmit` sind erfolgreich.

## Klickbare Branchen auf öffentlichen Seiten

Am 29. Juli 2026 umgesetzt:

- Die primäre Branche ist auf den Karten der Unternehmenssuche sowie auf der öffentlichen Detailseite anklickbar.
- Der Branchenlink führt zur bestehenden Unternehmenssuche und setzt den passenden Branchenfilter über den stabilen Branchencode.
- Der klassische Suchfilter bleibt oberhalb der Trefferliste sichtbar und zeigt die angeklickte Branche als aktive Auswahl an.
- Die Formularfelder werden bei einer Navigation über Branchenlinks mit den aktuellen URL-Filtern synchronisiert, damit Auswahl, URL und Trefferliste immer übereinstimmen.
- Im Browser wurde der Link `Gastronomie` geprüft: Die Suche zeigte die aktive Auswahl und genau den passenden Eintrag. Auch der Link `Computer & IT` auf der Detailseite wurde verifiziert.
- `npm run lint`, `npx tsc --noEmit` und `git diff --check` sind erfolgreich.

## Kontakt, Impressum und Datenschutz

Am 29. Juli 2026 umgesetzt:

- Die neue öffentliche Seite `/[locale]/kontakt` enthält ein responsives Kontaktformular mit Name, E-Mail, optionalem Telefon, Themenauswahl, Nachricht und verpflichtender Datenschutzbestätigung.
- Das Formular besitzt serverseitige Validierung, Herkunftsprüfung, Honeypot-Spamschutz und eine IP-basierte Ratenbegrenzung von fünf Anfragen pro 15 Minuten.
- Kontaktanfragen werden über einen authentifizierten Next.js-Serverweg an den eigenen Directus-Maildienst weitergegeben und an `info@findelio.ch` gesendet. Antworten auf die Benachrichtigung werden an die E-Mail-Adresse der anfragenden Person adressiert.
- Die Benachrichtigung verwendet das vorhandene Findelio-Maillayout und escaped alle Formulareingaben in der HTML-Vorlage.
- Die Kontaktseite enthält bewusst keine Karte und weist darauf hin, dass Findelio digital betrieben wird und keine persönlichen Besuche an der Geschäftsadresse vorgesehen sind.
- Das Impressum nennt `Webpixels`, Inhaber Jan Cabanik, Kirchgasse 13, 8532 Warth, Schweiz, als Betreiber von Findelio. Ergänzt wurden Kontaktangaben, Inhaltsverantwortung, Haftung, externe Links und Urheberrecht.
- Die Datenschutzerklärung beschreibt Verantwortlichen, bearbeitete Daten, Zwecke und Grundlagen, Cookies, Dienstleister, Aufbewahrung, Sicherheit, Betroffenenrechte, externe Inhalte und künftige Änderungen.
- Es wird transparent festgehalten, dass aktuell keine Werbe-, Marketing- oder Analyse-Cookies und keine eingebettete Karte verwendet werden. Der E-Mail-Versand über Infomaniak Network SA in der Schweiz ist benannt.
- Kontakt, Impressum und Datenschutz sind vollständig in allen neun unterstützten Sprachen vorhanden. Der Kontaktlink wurde in der Fusszeile und die Kontaktseite in der Sitemap ergänzt.
- Alle 27 Kombinationen aus neun Sprachen und drei Seiten antworten lokal mit HTTP 200. Die deutsche Kontaktseite, das deutsche Impressum und die englische Datenschutzseite wurden zusätzlich im Browser geprüft.
- Formularablauf mit Spamschutz, mobile Darstellung ohne horizontalen Überlauf, fehlende Karteneinbettung und fehlerfreie Browserkonsole wurden verifiziert. Es wurde dabei bewusst keine echte Testmail versendet.
- JSON-Prüfung aller Sprachdateien, `npm run lint`, `npx tsc --noEmit`, `npm run build` und `git diff --check` sind erfolgreich.

## Premium-Abos pro Firmeneintrag und Stripe-Vorbereitung

Am 30. Juli 2026 umgesetzt:

- Premium-Abos gelten neu pro Firmeneintrag statt für eine gesamte Organisation.
- Das bestehende lokale Premium-Testabo wurde ausdrücklich dem Eintrag `Webpixels Schweiz aus Thurgau` zugeordnet. `JAZU Webdesign` verwendet dadurch das Free-Paket; dessen vorhandene Premium-Daten bleiben gespeichert, sind aber gesperrt und öffentlich ausgeblendet.
- Die Sammlung `subscriptions` besitzt neu eine verpflichtende Beziehung zum jeweiligen Firmeneintrag. Organisation und Eintrag bleiben gemeinsam gespeichert, damit Eigentümerschaft, Abrechnung und Stripe-Synchronisierung eindeutig geprüft werden können.
- Die Premium-Prüfung im Dashboard und auf öffentlichen Seiten verwendet ausschliesslich die Eintrags-ID. Ein Premium-Abo schaltet keine weiteren Einträge derselben Organisation frei.
- Nach der Konto- und Organisationserstellung wird direkt zum ersten Firmeneintrag weitergeleitet. Beim Anlegen jedes Eintrags kann zwischen Free und Premium gewählt werden.
- Premium kostet CHF 9.90 monatlich oder CHF 99.00 jährlich. Es gibt keine kostenlose Testphase. Die Kündigung wirkt auf das Ende der laufenden Zahlungsperiode.
- Jeder Firmeneintrag besitzt eine eigene Abo-Seite mit Paketstatus, Zahlungsperiode, nächster Verlängerung beziehungsweise Zugangsende sowie Einstieg in Stripe Checkout oder das Stripe-Kundenportal.
- Stripe Checkout verwendet ausschliesslich serverseitig konfigurierte Preis-IDs. Die Checkout- und Portal-Endpunkte prüfen Anmeldung, Organisationsmitgliedschaft, Eintragszugehörigkeit und Anfrageherkunft.
- Der Stripe-Webhook prüft die Signatur des unveränderten Request-Bodys. Er verarbeitet abgeschlossene Checkouts, Abo-Änderungen, Kündigungen, erfolgreiche Rechnungen und fehlgeschlagene Zahlungen.
- Bei einer fehlgeschlagenen Zahlung wird die Kündigung zum Periodenende geplant. Der bereits bezahlte Premium-Zugang bleibt bis dahin aktiv. Bei einer erfolgreichen Nachzahlung wird nur diese automatisch geplante Kündigung wieder aufgehoben.
- Die technische `Findelio Server Policy` darf Stripe-Abos lesen, erstellen und ihre Abrechnungsfelder aktualisieren. Validierung begrenzt die Datensätze auf Stripe, Premium, CHF, die beiden Preise und bekannte Statuswerte. Löschrechte bleiben gesperrt.
- Firmenkunden können weiterhin nur Abo-Daten ihrer eigenen Organisation lesen und besitzen keine Abo-Schreibrechte.
- Die reproduzierbaren Directus-Migrationen befinden sich unter `infra/directus/migrations`.
- Eine beim Anlegen gewählte monatliche oder jährliche Premium-Option wird jetzt am Entwurf vorgemerkt. Premium-Entwürfe können Logo, Galerie, Öffnungszeiten, Social-Media-Links und weitere Premium-Angaben bereits vor der Zahlung vollständig vorbereiten; öffentlich sichtbar werden diese Inhalte weiterhin erst mit aktivem Abo.
- Der Abo-Abschluss ist technisch und in der Oberfläche gesperrt, solange ein Firmeneintrag nicht veröffentlicht ist. Entwürfe führen zuerst in den Editor, eingereichte Einträge zeigen den laufenden Prüfstatus.
- Nach der administrativen Freigabe führt die Kundenmail bei einer vorgemerkten Premium-Option direkt zur Abo-Seite mit der zuvor gewählten Abrechnungsperiode. Erst dort wird die Zahlung gestartet.
- Die Migration `20260802_premium_checkout_after_approval.sql` ergänzt dafür das verborgene Feld `requested_billing_interval` und die minimal nötigen Rechte. Der vorhandene lokale Jahresabo-Entwurf wurde auf `yearly` nachgeführt.
- Beim späteren Premium-Abschluss eines ursprünglich kostenlosen Eintrags wird eine gespeicherte Zahlungs-Kunden-ID vor der Wiederverwendung geprüft. Gelöschte oder in der aktuellen Sandbox nicht mehr vorhandene Kunden werden verworfen; der Checkout kann dadurch automatisch einen neuen Kunden anlegen.
- Statusmails zu Firmeneinträgen gehen an die E-Mail-Adresse des einreichenden Kontos und bei einer abweichenden öffentlichen Firmenadresse zusätzlich an diese zweite Adresse. Doppelte Empfänger werden entfernt; Directus protokolliert den erfolgreichen Versand mit der Empfängeranzahl.
- Premium-Badges verwenden eine gemeinsame Komponente mit fester Höhe und optisch korrigierter vertikaler Textzentrierung.
- Firmenlogos werden anhand ihrer gespeicherten Bildabmessungen adaptiv dargestellt: quadratische Logos bleiben kreisförmig und flächig, breite Wortmarken erhalten in Suchkarten und Detailprofilen einen breiteren abgerundeten Rahmen und werden vollständig angezeigt. Die Migration `20260802_adaptive_company_logos.sql` ergänzt dafür nur die technischen Lesefelder `width` und `height`.
- Die sichtbaren Paket-, Status-, Preis- und Fehlermeldungen sind in allen neun unterstützten Sprachen vorhanden.
- Im Browser wurden JAZU als Free, Webpixels als Premium, die gesperrten beziehungsweise freigeschalteten Editorfelder, die Abo-Seiten sowie Monats- und Jahresauswahl geprüft. Die Browserkonsole bleibt fehlerfrei.
- Ohne lokale Stripe-Schlüssel erscheint eine verständliche Konfigurationsmeldung. Die Sandbox-Schlüssel, beide Preis-IDs und das lokale Webhook-Geheimnis sind inzwischen ausschliesslich in `.env.local` konfiguriert; Geheimnisse wurden nicht in Git aufgenommen.
- JSON-Prüfung aller Sprachdateien, `npm run lint`, `npx tsc --noEmit`, `npm run build` und `git diff --check` sind erfolgreich.

Am 1. August 2026 zusätzlich geprüft:

- Monats- und Jahresabo wurden vollständig in der Sandbox bezahlt und mit den korrekten Preisen CHF 9.90 beziehungsweise CHF 99.00 angelegt.
- Das Jahresabo von `Well & Wow Kitchen by Marina` wurde zunächst nicht nach Directus synchronisiert, weil der lokale Webhook-Listener während der Zahlung nicht lief. Nach dem Neustart des Listeners wurde ein echtes Abo-Aktualisierungsereignis mit HTTP 200 verarbeitet; Directus führt den Eintrag nun mit aktivem Jahresabo bis 1. August 2027.
- Für weitere lokale Zahlungs-, Kündigungs- und Portaltests muss der Stripe-CLI-Listener aktiv bleiben. Im Livebetrieb übernimmt ein dauerhaft konfigurierter öffentlicher Webhook-Endpunkt diese Aufgabe.
- Sämtliche sichtbaren Abo-, Zahlungs-, Portal- und Fehlermeldungen nennen den technischen Zahlungsanbieter in keiner der neun unterstützten Sprachen. Interne Variablennamen, Serverlogs und Integrationscode bleiben technisch eindeutig benannt.
- Der Premium-Badge im Eintragseditor ist optisch mittig ausgerichtet. Beim Entfernen des Firmenlogos sowie bestehender oder neu ausgewählter Galeriebilder erscheint ein eigener Bestätigungsdialog mit Abbrechen- und Entfernen-Aktion; die Warntexte sind in allen neun Sprachen vorhanden.

Am 2. August 2026 ergänzt:

- Die Abo- und Zahlungsmittelverwaltung öffnet sich aus Findelio in einem neuen Browser-Tab. Der ursprüngliche Findelio-Tab bleibt geöffnet; falls der Browser das Öffnen blockiert, wird als Rückfall weiterhin im aktuellen Tab navigiert.
- Ein Hinweis unter dem Verwaltungsbutton erklärt dieses Verhalten in allen neun unterstützten Sprachen.
- Vom Kundenportal mit einem konkreten zukünftigen `cancel_at` geplante Kündigungen werden auch dann als Kündigung zum Periodenende synchronisiert, wenn Stripe `cancel_at_period_end` nicht setzt.
- Der bereits vorgemerkte Kündigungsstatus von `JAZU Webdesign` wurde mit Stripe abgeglichen und in Directus korrigiert. Premium bleibt bis 31. August 2026 aktiv; auf der Abo-Seite wird nun das Zugangsende statt einer nächsten Verlängerung angezeigt.

## Premium-Wachstumsfunktionen

Am 1. August 2026 umgesetzt:

- Premium-Firmeneinträge besitzen neu einen frei beschriftbaren Aktionsbutton mit geprüftem Ziel als Web-, E-Mail- oder Telefonlink. Die beiden Felder laufen bei veröffentlichten Einträgen durch den bestehenden Freigabeprozess.
- Premium-Kunden können Neuigkeiten, Aktionen und Veranstaltungen mit Bild, Zeitraum, Beschreibung und optionalem Aktionsbutton als Entwurf speichern oder zur Prüfung einreichen.
- Bestehende Beiträge können im Dashboard bearbeitet werden. Bei Änderungen an einer veröffentlichten Fassung bleibt das Original öffentlich sichtbar; eine verknüpfte neue Fassung durchläuft erneut die Prüfung und ersetzt das Original erst nach der Freigabe. Entwürfe, wartende und abgelehnte Fassungen werden direkt weiterbearbeitet. Das Kundendashboard fasst diese technischen Versionen zu einem logischen Beitrag zusammen und blendet archivierte Vorgänger aus.
- Der Bild-Upload für Beiträge verwendet statt der nativen Dateieingabe einen einheitlichen, zentrierten Findelio-Button mit separat angezeigtem Dateinamen. Darunter wird passend zur öffentlichen 16:9-Darstellung `1200 × 675 px` empfohlen. Button, Leerstatus und Bildhinweis sind in allen neun Sprachen übersetzt.
- Ausstehende Premium-Beiträge erscheinen im internen Findelio-Prüfbereich mit Beitragsart, vollständiger Beschreibung, Bildvorschau, Beginn, Ende sowie Beschriftung und Ziel des Aktionsbuttons. Fehlende optionale Angaben sind klar als leer erkennbar. Die Beiträge können dort freigegeben oder mit Begründung abgelehnt werden. Nur veröffentlichte und noch aktuelle Beiträge erscheinen auf dem öffentlichen Firmenprofil.
- Beiträge verwenden wie Firmeneinträge nur noch eine vollständige Beschreibung. Das alte Kurztextfeld bleibt aus Kompatibilitätsgründen verborgen bestehen und wird weder im Formular noch öffentlich abgefragt. Die Migration `20260802_listing_posts_single_description.sql` übernimmt vorhandene Kurztexte verlustfrei in die Beschreibung, falls diese bisher leer war.
- Passende Premium-Einträge werden in der Suche vor Free-Einträgen angezeigt und deutlich als Premium gekennzeichnet. Mehrere Premium-Einträge werden anhand eines täglich wechselnden, stabilen Werts fair angeordnet.
- Für aktive Premium-Einträge werden Such-Einblendungen, Profilaufrufe sowie Klicks auf Website, Telefon, E-Mail, Social Media, individuellen Button und Beitragsbuttons als zusammengefasste Tageswerte gespeichert.
- Die Messung legt keine dauerhaften IP-Adressen, Besucherprofile oder Tracking-Cookies an. Die Datenschutzerklärung enthält einen eigenen Abschnitt zur Reichweitenmessung.
- Jeder Premium-Eintrag besitzt im Dashboard eine Statistikseite für 30, 90 oder 365 Tage.
- Eine neue Directus-Zeitplanerweiterung versendet am ersten Tag jedes Monats einen lokalisierten Bericht für den Vormonat an aktive Organisationsinhaber. Ein Versandprotokoll mit Eindeutigkeitsregel verhindert doppelte Berichte.
- Beim Einreichen eines Premium-Beitrags zur Prüfung erhält `info@findelio.ch` eine Findelio-Benachrichtigung mit direktem Link zum internen Prüfbereich. Nach Bestätigung oder Ablehnung erhält die einreichende Person eine Kundenmail mit öffentlichem Profillink beziehungsweise Begründung und Bearbeitungslink. Das Textfeld im Prüfbereich dient bei einer Freigabe als freiwillige Nachricht an den Kunden und bei einer Ablehnung als verpflichtende Begründung; der Inhalt wird in beiden Fällen in der E-Mail ausgegeben. Die zuvor ausgebliebenen Nachrichten für den Beitrag von `JAZU Webdesign` wurden erfolgreich nachgesendet.
- Archivierte Premium-Beiträge verschwinden nur aus dem öffentlichen Firmenprofil. Der jeweils aktuelle Beitragsstand bleibt mit verständlichem Archivhinweis im Firmen-Dashboard sichtbar, kann als Entwurf weiterbearbeitet und später erneut zur administrativen Prüfung eingereicht werden. Ein Bestätigungsdialog erklärt diese Folgen vor der Archivierung; automatisch ersetzte ältere Beitragsversionen bleiben ausgeblendet.
- Entscheidungsbenachrichtigungen für Eintragsänderungen können über den internen Serverzugang sicher nachgesendet werden. Die Bestätigung zur Spezialbutton-Änderung von `JAZU Webdesign` wurde am 2. August 2026 erneut an die in der Revision hinterlegte Kundenadresse übergeben; Directus bestätigte den Versand mit HTTP 204.
- Die reproduzierbare Migration `20260801_premium_growth_features.sql` legt Felder, Sammlungen, Beziehungen, Indizes und die minimalen technischen Directus-Rechte an.
- Die ergänzende Migration `20260802_listing_post_edits.sql` verknüpft neue Prüffassungen mit dem weiterhin veröffentlichten Original; sie wurde lokal erfolgreich angewendet und von Directus geladen.
- Die Migration `20260802_listing_posts_single_description.sql` wurde lokal angewendet; Directus und sein Schema-Cache wurden danach neu geladen.
- Directus lädt Tracking- und Berichtserweiterung fehlerfrei. Ein realer lokaler Tracking-Aufruf erhöhte den aggregierten Tageswert atomar. Suche, Premium-Profil, Beitragsverwaltung, Statistik und Button-Felder wurden im Browser geprüft; die Browserkonsole blieb fehlerfrei.
- JSON-Prüfung aller Sprachdateien, `npx tsc --noEmit`, `npm run lint` und `npm run build` sind erfolgreich.

## Globales Abstandsmaß

- Das Tailwind-v4-Theme und `:root` verwenden global `--spacing: 0.2rem`. Im gerenderten Frontend wurde der Wert als `.2rem` bestätigt; beispielsweise ergeben `p-6` und `gap-6` jeweils `19.2px`.

## Mehrsprachige Premium-Beschreibungen

Am 2. August 2026 umgesetzt:

- Die separate Kurzbeschreibung wurde aus dem Erstellen- und Bearbeiten-Formular sowie aus der öffentlichen Ausgabe entfernt. Das alte Directus-Feld bleibt aus Kompatibilitätsgründen verborgen bestehen und wird nicht mehr neu beschrieben.
- Falls ein bestehender Eintrag nur eine Kurzbeschreibung, aber keine vollständige Beschreibung besass, wurde der vorhandene Text bei der Migration verlustfrei in das Beschreibungsfeld übernommen.
- Suchkarten erzeugen ihren dreizeiligen Auszug jetzt automatisch aus der vollständigen Beschreibung. Die öffentliche Profilseite zeigt weiterhin den vollständigen Text.
- Premium-Einträge können zusätzlich zur deutschen Hauptbeschreibung eigene Fassungen für Englisch, Slowakisch, Tschechisch, Ungarisch, Polnisch, Russisch, Portugiesisch und Rumänisch speichern.
- Der Editor verwendet übersichtliche Sprachreiter. Leere Übersetzungen fallen auf der entsprechenden öffentlichen Sprachversion automatisch auf die deutsche Hauptbeschreibung zurück.
- Übersetzungsänderungen laufen durch denselben Entwurfs- und Prüfworkflow wie andere Änderungen am Firmeneintrag. Der interne Prüfbereich zeigt die Übersetzungen sprachweise lesbar an.
- Die Übersetzungen werden nur bei aktivem Premium-Abo öffentlich verwendet; gespeicherte Übersetzungen bleiben bei einem abgelaufenen Abo erhalten, werden dann jedoch nicht ausgespielt.
- Paketdarstellung, Editorhinweise und Prüffeldbezeichnungen wurden in allen neun unterstützten UI-Sprachen ergänzt.
- Die reproduzierbare Directus-Migration `20260802_multilingual_listing_descriptions.sql` wurde lokal erfolgreich angewendet. Directus wurde danach neu gestartet und lädt alle Erweiterungen fehlerfrei.
- Die öffentliche Firmensuche wurde im Browser geprüft: Alle vorhandenen Karten zeigen ihren Auszug aus der vollständigen Beschreibung und Directus liefert das neue Übersetzungsfeld mit HTTP 200 aus.
- JSON-Prüfung aller Sprachdateien, `npx tsc --noEmit`, `npm run lint`, `npm run build` und `git diff --check` sind erfolgreich.
- Ein nach der Migration aufgetretener Directus-403 auf öffentlichen Profilseiten wurde behoben: Die eingebettete Galerie wird nun getrennt vom Firmeneintrag geladen, weil Directus die kombinierte Detailabfrage trotz einzeln erlaubter Felder ablehnte. Dafür wurden keine Rechte erweitert. Das öffentliche Profil `JAZU Webdesign` lädt danach wieder vollständig inklusive Galerie, Beschreibung, Beiträgen, Kontakt und Öffnungszeiten.
- Ein weiterer 403 im angemeldeten Eigentümer-Editor wurde auf einen veralteten Directus-Schema-Cache in Redis zurückgeführt. Nach dem Leeren des technischen Cache und einem Directus-Neustart erkennt Directus `description_translations` als reguläres Feld. Der Editor von `JAZU Webdesign` wurde anschliessend als Eigentümer vollständig und ohne 404 oder Feldfehler im Browser geöffnet. Die öffentlichen oder internen Rechte mussten dafür nicht erweitert werden.

## Öffentliche Inhalte, Navigation, Teilen und SEO

Am 3. August 2026 umgesetzt und geprüft:

- Die AGB und die Seite `So funktioniert Findelio für Firmen` sind in allen neun unterstützten Sprachen vorhanden. Beide erklären den Prüfprozess, Free und Premium sowie die optionale Verifizierung anhand offizieller Unternehmensnachweise.
- Das neue horizontale Findelio-Logo wird im Header und in den Findelio-Mailvorlagen verwendet.
- Die Logo-Darstellung in den Mailvorlagen verwendet passend zur Quelldatei mit `656 × 196 px` das exakt proportionale Anzeigemass `164 × 49 px`. Identische HTML- und Inline-CSS-Masse verhindern, dass Mailprogramme das Logo durch widersprüchliche Breiten- und Höhenangaben verzerren.
- `npm run check:email-logo` liest die tatsächlichen PNG-Masse direkt aus der Datei und vergleicht sie mit den HTML- und CSS-Angaben der Mailvorlage. Der Produktions-Build führt diese Prüfung automatisch aus und bricht bei einer künftigen Verzerrung ab.
- Für die Absenderdarstellung in unterstützten Mailübersichten ist zusätzlich ein quadratisches, BIMI-konformes Findelio-Logo als SVG Tiny PS unter `public/bimi-logo.svg` vorbereitet. SPF und DMARC (`p=reject`) sind für `findelio.ch` bereits öffentlich vorhanden; die Aktivierung benötigt nach dem Deployment noch die Markenzertifizierung und den BIMI-Eintrag im Infomaniak Manager.
- Der Header besitzt einen eigenen Startseitenlink, eine flackerfreie serverseitige Anmeldeanzeige und einen animierten Wechsel des mobilen Menüsymbols zwischen Hamburger und Schliessen.
- Öffentliche Seiten und Firmeneinträge können über die Web-Share-Funktion beziehungsweise durch Kopieren des Links geteilt werden.
- Alle öffentlichen Seiten besitzen Canonical-URLs und Sprachalternativen für neun Sprachen plus `x-default`.
- Startseite, Firmensuche, Registrierung, Kontakt, Rechtseiten, Firmenanleitung und Firmeneinträge liefern passende Titel, Beschreibungen sowie Open-Graph- und Twitter-Daten.
- Für jede Sprache wird ein eigenes Findelio-Vorschaubild im Format `1200 × 630 px` erzeugt.
- Strukturierte Daten beschreiben Findelio als Organisation und Website sowie veröffentlichte Einträge als `LocalBusiness` mit Breadcrumbs. Die gewählte Adresssichtbarkeit wird respektiert.
- Gefilterte Suchseiten sowie Dashboard, Login, Bestätigungs- und Einrichtungsseiten werden nicht indexiert.
- `robots.txt` schliesst interne Bereiche und API-Endpunkte aus. Die Sitemap enthält nur öffentliche Seiten, alle Sprachalternativen und die bekannten Veröffentlichungsdaten der Einträge.
- `npx tsc --noEmit`, `npm run lint`, `npm run build`, Browserprüfung der Metadaten und `git diff --check` sind erfolgreich.

## Teamverwaltung und Einladungen

Am 4. August 2026 abgeschlossen und nach einem unterbrochenen lokalen Lauf repariert:

- Inhaber können Administratoren und Bearbeiter per E-Mail zu einer Organisation einladen; Administratoren können Bearbeiter einladen.
- Einladungen sind sieben Tage gültig, an die eingeladene E-Mail-Adresse gebunden und lassen sich vor der Annahme zurückziehen.
- Der Einladungslink führt neue Teammitglieder direkt zu einer eigenen Registrierungsansicht mit fest vorgegebener eingeladener E-Mail-Adresse. Bestehende Konten können stattdessen zur Anmeldung wechseln.
- Nach der E-Mail-Bestätigung werden Kontoaktivierung, Einladungsannahme, aktive Organisationsmitgliedschaft und Findelio-Sitzung atomar abgeschlossen. Danach öffnet sich ohne erneute Anmeldung und ohne Organisations-Onboarding direkt die Übersicht der Firmeneinträge.
- Inhaber können die Rollen von Administratoren und Bearbeitern ändern und beide Rollen entfernen. Administratoren können Bearbeiter entfernen.
- Entfernte Mitgliedschaften bleiben für eine spätere sichere Reaktivierung gespeichert, erscheinen aber nicht mehr als aktive Teammitglieder.
- Teamübersicht, Einladungsseite, Statusmeldungen und E-Mail-Inhalte sind in allen neun unterstützten Sprachen vorhanden.
- Der Next.js-Endpunkt prüft Sitzung, Anfrageherkunft und Eingaben; der Directus-Endpunkt prüft Organisationsmitgliedschaft und Rollen bei jeder Aktion erneut.
- Die Migration `20260803_team_management.sql` wurde lokal angewendet. Directus lädt die Team-Erweiterung, die neue Sammlung und deren Indizes fehlerfrei.
- Ein vollständiger Test mit temporärem unbestätigtem Konto, echtem Directus-Bestätigungstoken und offener Einladung bestätigte Mitgliedschaft, Zugriffstoken, erneuerbare Sitzung und den direkten HTTP-200-Zugriff auf die Firmeneinträge ohne Einrichtungsumleitung. Sämtliche Testdaten und Sitzungen wurden danach vollständig entfernt, ohne eine E-Mail auszulösen.
- Desktop- und Mobilansicht besitzen genau eine Fusszeile, keinen horizontalen Überlauf und keine Browserkonsolenfehler.

## Löschanfragen für Firmeneinträge und Organisationen

Am 4. August 2026 umgesetzt und geprüft:

- Aktive Organisationsmitglieder können für einen Firmeneintrag eine Löschanfrage stellen; für eine ganze Organisation ist dies ausschliesslich dem Inhaber erlaubt.
- Die Anfrage archiviert oder versteckt Inhalte nicht sofort. Offene Anfragen erscheinen direkt beim betroffenen Eintrag beziehungsweise bei der Organisation und lassen sich über den bewusst als Textbutton gestalteten Link `Anfrage zurückziehen` widerrufen.
- Ein aktives Premium-Abo muss vor der Anfrage fristgerecht zur Kündigung vorgemerkt sein. Eine bereits vorgemerkte Kündigung erlaubt die Anfrage, die administrative Archivierung bleibt jedoch bis zum Ende der bezahlten Laufzeit gesperrt.
- Findelio-Administratoren sehen offene Löschanfragen im bestehenden Prüfbereich mit Organisation, Ziel, anfragender Person, Datum und optionalem Grund. Ablehnungen benötigen eine Begründung.
- Bei jeder neuen Löschanfrage erhält die konfigurierte Findelio-Administrator-Adresse eine gebrandete E-Mail mit Typ, Organisation, betroffenem Inhalt, anfragender Person, optionalem Grund und einem direkten Link zum Prüfbereich.
- Die Löschanfragen-Mail bindet das aktuelle horizontale Findelio-PNG wie alle übrigen Findelio-Mailvorlagen per Content-ID ein. Der zuvor fehlende Vorlagenname im zentralen Mail-Hook wurde ergänzt, sodass Mailprogramme nicht mehr nur den Alternativtext anzeigen.
- Falls die Administrator-Benachrichtigung nicht versendet werden kann, bleibt keine unbemerkte offene Anfrage bestehen: Der neue Datensatz wird sofort zurückgezogen und im Kundendashboard erscheint eine lokalisierte Fehlermeldung mit der Aufforderung, die Anfrage erneut zu senden.
- Eine bestätigte Eintragsanfrage archiviert den Firmeneintrag sowie noch offene Revisionen und Beiträge. Eine bestätigte Organisationsanfrage archiviert die Organisation und sämtliche zugehörigen Einträge; Datensätze werden nicht physisch gelöscht.
- Archivierte Firmeneinträge werden aus sämtlichen Firmenkonto-Übersichten und deren Zählern entfernt. Auch ein direkter Aufruf der Bearbeitungs-, Abo-, Beitrags- oder Statistikseite liefert für ein archiviertes Profil keinen Firmenkonto-Zugriff mehr.
- Firmenkonten besitzen weiterhin keinerlei direkte Lösch- oder Archivierungsrechte. Sämtliche Rollen-, Eigentums-, Status- und Abo-Prüfungen erfolgen bei jeder Aktion erneut in der abgesicherten Directus-Extension.
- Die reproduzierbare Migration `20260804_deletion_requests.sql` wurde lokal angewendet. Directus lädt `directus-extension-findelio-deletion-requests` fehlerfrei.
- Ein isolierter End-to-End-Test bestätigte Bearbeiter-Anfrage, Rückzug, Premium-Kündigungspflicht, Sperre während der bezahlten Laufzeit, Admin-Ablehnung, Eintragsarchivierung, reine Inhaberberechtigung für Organisationen und Organisationsarchivierung. Sämtliche temporären Daten wurden danach entfernt.
- Ein zusätzlicher realer Versandtest wurde vom konfigurierten Mailserver angenommen. Die dafür angelegte, klar als Versandtest bezeichnete Löschanfrage sowie alle übrigen temporären Datensätze wurden anschliessend vollständig entfernt.
- Desktop- und Mobilansicht sowie der administrative Prüfbereich wurden im Browser geprüft. Die Mobilansicht besitzt keinen horizontalen Überlauf. Sämtliche Texte sind in allen neun unterstützten Sprachen vorhanden.
- Sämtliche Lösch-, Entfernen-, Rückzugs- und Archivierungsaktionen werden visuell als Buttons dargestellt. Eine gemeinsame barrierearme Gefahren-Buttondarstellung vereinheitlicht Kunden-Dashboard, Teamverwaltung, Premium-Medien, Öffnungszeiten, Social Links, Beiträge und administrative Löschbestätigungen; endgültige Bestätigungen bleiben als rote Vollflächen-Buttons klar hervorgehoben.

## Cookie-Hinweis und Cookie-Unterseite

Am 5. August 2026 umgesetzt und geprüft:

- Beim ersten Besuch erscheint ein ruhiger, barrierearm beschrifteter Hinweis, dass Findelio ausschliesslich technisch notwendige Cookies für Anmeldung, sichere Sitzungen und Sprachwahl verwendet und keine Werbe- oder Analyse-Cookies setzt.
- Da keine einwilligungspflichtigen Cookies eingesetzt werden, verlangt der Hinweis keine irreführende Zustimmung. Die Aktion `Verstanden` schliesst ihn; die Bestätigung wird für höchstens zwölf Monate im lokalen Browserspeicher hinterlegt.
- Die neue öffentliche Seite `/[locale]/cookies` dokumentiert die beiden Findelio-Anmelde-Cookies, das Sprach-Cookie, den lokalen Eintrag für den Hinweis, ihre Zwecke, Speicherdauern und die Verwaltung über den Browser.
- Die Cookie-Seite ist im Footer und in der Sitemap verlinkt, besitzt lokalisierte Metadaten und ist vollständig in allen neun unterstützten Sprachen vorhanden.
- Schliessen, Navigation, deutscher und englischer Inhalt sowie das responsive Layout wurden im Browser geprüft. `npm run lint`, `npx tsc --noEmit`, Übersetzungsparität, `npm run build` und der anschliessende HTTP-200-Aufruf im neu gestarteten Entwicklungsserver sind erfolgreich.

## Produktionsbetrieb und spätere Aktualisierungen

Am 5. August 2026 vorbereitet und lokal geprüft:

- Eine eigenständige Produktionsumgebung bündelt Next.js, Directus, PostgreSQL, Redis und Caddy in `compose.production.yaml`. Nur Caddy veröffentlicht HTTP und HTTPS; Datenbank, Cache und interne Dienstverbindungen bleiben in einem abgeschotteten Docker-Netz.
- Caddy übernimmt automatische TLS-Zertifikate, die Weiterleitung der `www`-Adresse, Kompression, Sicherheitsheader und getrennte Zugänge für Website und Directus.
- Das Next.js-Image wird mehrstufig und als schlankes Standalone-Image gebaut, läuft ohne Root-Rechte und besitzt einen Healthcheck, der auch die Erreichbarkeit von Directus prüft.
- `.env.production.example` dokumentiert sämtliche benötigten Produktionsvariablen, enthält aber bewusst keine echten Geheimnisse. Ein Prüfskript verhindert Starts mit fehlenden Werten oder offensichtlichen Platzhaltern.
- Wiederholbare Skripte decken Deployment, vorgängiges Datenbank- und Upload-Backup, nachvollziehbare SQL-Migrationen mit Prüfsummen und Rollback ab. Backups enthalten keine Umgebungsdateien oder Geheimnisse und werden nicht automatisch gelöscht.
- Da das bisherige Basisschema und die Directus-Rechte nicht vollständig aus SQL-Migrationen rekonstruiert werden können, ist für die erste Liveschaltung eine einmalige, beaufsichtigte Übertragung der bestehenden PostgreSQL-Datenbank und Directus-Uploads vorgesehen. Diese Übertragung wurde noch nicht ausgeführt.
- `DEPLOYMENT.md` beschreibt DNS, Servervorbereitung, ersten Datenumzug, reguläre Updates, Sicherungen, Wiederherstellung und Rollback. Damit können spätere Änderungen nach Git-Push mit einem reproduzierbaren Deploy-Befehl eingespielt werden.
- Next.js und `eslint-config-next` wurden gemeinsam auf die stabile Version 16.3.0 aktualisiert. Die dadurch aktualisierten PostCSS-, Sharp- und Entwicklungsabhängigkeiten ergeben bei `npm audit` keine bekannten Sicherheitswarnungen.
- Compose-Auflösung, Caddy-Konfiguration, Shell-Syntax der Betriebsskripte, ESLint, TypeScript und der vollständige Docker-Produktionsbuild sind erfolgreich.

## Blog und redaktionelle Ratgeberartikel

Am 5. August 2026 vorbereitet und geprüft:

- Die neuen öffentlichen Routen `/[locale]/blog` und `/[locale]/blog/[slug]` bieten eine ruhige Ratgeberübersicht, hervorgehobene Beiträge, gut lesbare Artikelseiten, Lesezeit, Teilen-Funktion, verwandte Beiträge und einen passenden Übergang zur Firmensuche.
- Header, mobiles Menü und Footer verlinken den Blog. Die gesamte Blog-Oberfläche, leere Zustände, Metadaten und Handlungsaufforderungen sind in allen neun Findelio-Sprachen vorhanden.
- Veröffentlichte Beiträge erhalten Canonical-URL, Open-Graph- und Twitter-Metadaten sowie strukturierte Daten als `BlogPosting`, Breadcrumbs und eine Sammlungsliste. Sprachspezifische Artikel erzeugen keine falschen Sprachalternativen.
- Die Sitemap enthält die Blogübersicht in jeder Sprache und ergänzt automatisch jeden veröffentlichten, datierten Artikel in seiner tatsächlichen Sprache.
- Die Directus-Migration `20260805_blog_posts.sql` legt eine redaktionelle Sammlung mit Entwurf-, Veröffentlicht- und Archivstatus, Sprache, URL-Kennung, Markdown-Inhalt, Kategorie, Autor, Titelbild, Bildalternative, Hervorhebung und optionalen SEO-Feldern an. Sie wurde nach einer lokalen Datenbanksicherung erfolgreich angewendet.
- Die ergänzende Migration `20260805_blog_server_access.sql` erlaubt dem technischen Website-Konto ausschliesslich das Lesen veröffentlichter und bereits terminlich freigegebener Artikel. Titelbilder werden im bestehenden öffentlichen Directus-Dateiordner ausgewählt; Entwürfe bleiben für die Website unsichtbar.
- Die Migration `20260805_blog_status_publication.sql` setzt beim Wechsel auf `Veröffentlicht` automatisch das Veröffentlichungsdatum, sofern kein Termin vorgegeben wurde. Damit genügt der verständliche Statuswechsel für eine sofortige Veröffentlichung; ein zukünftiges Datum bleibt für geplante Beiträge möglich.
- Drei vollständige deutschsprachige Artikel zu mehrsprachiger Kundschaft, lokaler Online-Sichtbarkeit und vertrauenswürdigen Firmenprofilen wurden aus `content/blog-import-de-ch.json` importiert, mit Veröffentlichungsdaten versehen und veröffentlicht.
- `content/blog-import-translations.json` ergänzt diese drei Grundlagen als 24 direkt importierbare Entwürfe in den übrigen acht Findelio-Sprachen. Titel, Slugs, Kategorien, Bildalternativen und SEO-Felder sind lokalisiert; die bestehenden Directus-Titelbilder werden wiederverwendet. JSON-Syntax, Schema-Feldlängen, Sprachverteilung und eindeutige URL-Kennungen sind geprüft.
- Drei zusammengehörige, textfreie 16:9-Titelbilder wurden generiert, im Projekt unter `public/blog/` gesichert, in den öffentlichen Directus-Dateiordner geladen und inklusive beschreibender Bildalternativen den Beiträgen zugeordnet.
- Die in Directus gepflegten Kategorien sind im Blogarchiv als URL-basierte Filter verfügbar. Kategorien auf Blogkarten und Artikelseiten verlinken direkt zum passenden Filter; neue Kategorien erscheinen automatisch. Auswahlzustand, Tastaturzugänglichkeit und umbrechende Darstellung wurden auf Desktop und Mobilgerät geprüft.
- Der Rücklink am Artikelende und die Links `Artikel lesen` in Übersicht, Archiv sowie verwandten Beiträgen unterstreichen nur noch den eigentlichen Linktext. Die Pfeile bleiben bewusst ohne Unterstreichung, wodurch die zuvor sichtbaren Linienunterbrüche entfallen. Unterstreichung und Farbwechsel verhalten sich im Normal- und Hoverzustand auf allen Blogflächen identisch.
- `BLOG.md` beschreibt Erstellung, JSON-Import, Mehrsprachigkeit, Titelbilder, Veröffentlichung und einen kurzen SEO-Qualitätscheck. Importierte Dateien können direkt in Directus bearbeitet werden; Binärbilder werden separat hochgeladen.
- Markdown wird ohne ausführbares eingebettetes HTML gerendert. Überschriften, Listen, Links, Zitate, Tabellen und Code besitzen eine responsive Findelio-Darstellung.
- Alle neun Sprachdateien und der JSON-Import sind syntaktisch gültig und besitzen identische Blog-Schlüssel. ESLint, TypeScript, `npm audit` und der vollständige Next.js-Produktionsbuild mit 199 statisch vorbereiteten Seiten sind erfolgreich. Die aktuelle Browserprüfung bestätigt drei veröffentlichte Beiträge, drei öffentlich ladbare Titelbilder, den korrigierten Rücklink sowie eine saubere Darstellung auf Desktop und Mobilgerät.

## Release-Vorbereitung

Am 9. August 2026 abschliessend geprüft:

- Der Einladungsabschluss lässt den einmal gestarteten Bestätigungsaufruf auch während der React-Entwicklungsprüfung weiterlaufen und verhindert gleichzeitig eine doppelte Verwendung des einmaligen Tokens. Der zuvor endlose Ladezustand ist behoben.
- Die Suchfelder besitzen auf Startseite und Firmenverzeichnis einen etwas grösseren, einheitlichen Abstand. Desktop- und Mobilansicht wurden im Browser kontrolliert.
- Zwei neu gemeldete Sicherheitsprobleme in indirekten Build-Abhängigkeiten wurden durch reine Patch-Updates von `js-yaml` und `nanoid` geschlossen. `npm audit` meldet keine bekannten Schwachstellen.
- ESLint, TypeScript, JSON- und Übersetzungsdateien, Directus-Erweiterungen, Shell-Skripte, Produktions-Compose-Auflösung, Next.js-Produktionsbuild mit 199 Seiten und das vollständige Produktions-Docker-Image sind erfolgreich geprüft.
- Ein aktuelles lokales PostgreSQL- und Directus-Upload-Backup für den ersten Serverumzug wurde mit SHA-256-Prüfsummen erstellt. Datenbank-Dump und Upload-Archiv sind lesbar; das Backup bleibt ausserhalb von Git.
- Für die Liveschaltung fehlen noch die konkrete Server-IP samt SSH-Zugang, die DNS-Zuweisung der drei Webdomains und die Stripe-Livewerte.

## Git- und Arbeitsstand

- Branch: `agent/premium-listing-workflows`
- Ausgangscommit dieses Sicherungsstands: `8badc05` (`feat: complete premium listing workflows`)
- Der aktuelle Gesamtstand umfasst zusätzlich AGB, Firmenanleitung, aktualisiertes Branding, Navigation, Share-Funktion und den technischen SEO-Abschluss.
- `SKILLS.md` und `PROJECT_STATUS.md` dokumentieren Arbeitsregeln und Projektstand; Geheimnisse bleiben ausgeschlossen.
