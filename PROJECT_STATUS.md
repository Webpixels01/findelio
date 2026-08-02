# Findelio – Projektstatus

Stand: 29. Juli 2026

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
- Die Empfängeradresse und die Begründung werden serverseitig aus der geprüften Revision gelesen und nicht aus dem Browser übernommen.
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
- Ausstehende Premium-Beiträge erscheinen im internen Findelio-Prüfbereich und können dort freigegeben oder mit Begründung abgelehnt werden. Nur veröffentlichte und noch aktuelle Beiträge erscheinen auf dem öffentlichen Firmenprofil.
- Passende Premium-Einträge werden in der Suche vor Free-Einträgen angezeigt und deutlich als Premium gekennzeichnet. Mehrere Premium-Einträge werden anhand eines täglich wechselnden, stabilen Werts fair angeordnet.
- Für aktive Premium-Einträge werden Such-Einblendungen, Profilaufrufe sowie Klicks auf Website, Telefon, E-Mail, Social Media, individuellen Button und Beitragsbuttons als zusammengefasste Tageswerte gespeichert.
- Die Messung legt keine dauerhaften IP-Adressen, Besucherprofile oder Tracking-Cookies an. Die Datenschutzerklärung enthält einen eigenen Abschnitt zur Reichweitenmessung.
- Jeder Premium-Eintrag besitzt im Dashboard eine Statistikseite für 30, 90 oder 365 Tage.
- Eine neue Directus-Zeitplanerweiterung versendet am ersten Tag jedes Monats einen lokalisierten Bericht für den Vormonat an aktive Organisationsinhaber. Ein Versandprotokoll mit Eindeutigkeitsregel verhindert doppelte Berichte.
- Beim Einreichen eines Premium-Beitrags zur Prüfung erhält `info@findelio.ch` eine Findelio-Benachrichtigung mit direktem Link zum internen Prüfbereich. Nach Bestätigung oder Ablehnung erhält die einreichende Person eine Kundenmail mit öffentlichem Profillink beziehungsweise Begründung und Bearbeitungslink. Die zuvor ausgebliebenen Nachrichten für den Beitrag von `JAZU Webdesign` wurden erfolgreich nachgesendet.
- Entscheidungsbenachrichtigungen für Eintragsänderungen können über den internen Serverzugang sicher nachgesendet werden. Die Bestätigung zur Spezialbutton-Änderung von `JAZU Webdesign` wurde am 2. August 2026 erneut an die in der Revision hinterlegte Kundenadresse übergeben; Directus bestätigte den Versand mit HTTP 204.
- Die reproduzierbare Migration `20260801_premium_growth_features.sql` legt Felder, Sammlungen, Beziehungen, Indizes und die minimalen technischen Directus-Rechte an.
- Die ergänzende Migration `20260802_listing_post_edits.sql` verknüpft neue Prüffassungen mit dem weiterhin veröffentlichten Original; sie wurde lokal erfolgreich angewendet und von Directus geladen.
- Directus lädt Tracking- und Berichtserweiterung fehlerfrei. Ein realer lokaler Tracking-Aufruf erhöhte den aggregierten Tageswert atomar. Suche, Premium-Profil, Beitragsverwaltung, Statistik und Button-Felder wurden im Browser geprüft; die Browserkonsole blieb fehlerfrei.
- JSON-Prüfung aller Sprachdateien, `npx tsc --noEmit`, `npm run lint` und `npm run build` sind erfolgreich.

## Globales Abstandsmaß

- Das Tailwind-v4-Theme und `:root` verwenden global `--spacing: 0.2rem`. Im gerenderten Frontend wurde der Wert als `.2rem` bestätigt; beispielsweise ergeben `p-6` und `gap-6` jeweils `19.2px`.

## Git- und Arbeitsstand

- Branch: `main`
- Aktueller lokaler Sicherungs-Commit mit der Stripe-Erweiterung: `8515165` (`feat: add per-listing Stripe subscriptions`)
- Der aktuelle Gesamtstand mit Registrierung, Onboarding, Premium-Funktionen, Prüfworkflow, E-Mail-Vorlagen, öffentlichen Verzeichnisfunktionen sowie Kontakt- und Rechtseiten ist in einem lokalen Git-Commit gesichert.
- `SKILLS.md` und `PROJECT_STATUS.md` wurden am 28. Juli 2026 zur Projektdokumentation angelegt.
- Es wurde kein Push ausgeführt.
