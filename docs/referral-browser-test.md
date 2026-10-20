# Browser-Test vom 12.09.2026

## Ergaenzung vom 16.09.2026: vollstaendige Auswahl im lokalen Test

Nach dem manuellen Premium-Test wurden ausschliesslich die Verzeichnis-Stammdaten
aus dem zentralen Directus gelesen: 26 Kantone, 39 Branchen und 26 Sprachen samt
Uebersetzungen. Der bereinigte Snapshot `tests/fixtures/referral-directory.json`
enthaelt nur Codes, Namen, Uebersetzungen und Quellen-/Zeitangabe, keine
Produktiv-IDs, Firmen, Benutzer oder Zugangsdaten. Es gab keine Schreibzugriffe
auf die zentrale Instanz.

`tests/referral-directory-setup.mjs` ergaenzt diesen Snapshot nur in der
abgesicherten Wegwerf-Testdatenbank. Bestehende Optionen und IDs bleiben erhalten,
einschliesslich der bereits ausgewaehlten synthetischen IT-Branche. Lokal stehen
deshalb 40 Branchen zur Auswahl. Der Backend-Runner mit `--browser-fixture`
uebernimmt diese Ergaenzung kuenftig automatisch.

Der Import wurde gegen die laufende lokale Directus-/Postgres-Umgebung geprueft:
Ein wiederholter Lauf erzeugt keine doppelten Optionen oder Uebersetzungen.
Eintraege, Revisionen, Branchen-/Sprachzuordnung, Referral-Einloesungen und
Premium-Grants blieben vor und nach beiden Laeufen identisch. Die geaenderten
JavaScript-Dateien wurden mit ESLint geprueft. Die Auswahl im Bearbeitungsformular
mit den ergaenzten Stammdaten wurde in diesem Schritt nicht erneut manuell getestet.

## Ergaenzung vom 16.09.2026: oeffentliches Verzeichnis nach Freigabe

Der manuelle Test erreichte die Freigabe und den automatisch aktivierten
Referral-Grant. Anschliessend scheiterte die oeffentliche Firmenuebersicht in
`localizeListing`, weil das synthetische Testschema die Rueckverknuepfungen
`listings.industries` und `listings.spoken_languages` nicht definiert hatte.
Directus lieferte die angefragten Listen deshalb nicht zurueck. Die Fremdschluessel
der Zwischentabellen allein genuegten fuer diese Abfrage nicht.

`tests/fixtures/referral-browser.sql` definiert nun beide Alias-Felder und die
zugehoerigen Directus-Relationen. Die Detailabfrage benoetigt ausserdem das
optionale Feld `location`; im Test dient dafuer ein leerer JSON-Platzhalter.
Dies ist keine Aussage ueber den produktiven Geodatentyp und kein Geodatentest.
Nur diese fehlenden Schemaelemente wurden in der laufenden lokalen Testdatenbank
ergaenzt; bestehende Konten, Eintraege, Revisionen und Grants blieben erhalten.

Geprueft mit der echten lokalen Directus-API und im Browser:

- Die vollstaendige Detailabfrage liefert HTTP 200, Branche IT und beide
  gewaehlten Sprachen DE/EN.
- Der kombinierte Branchen-/Sprachfilter findet den veroeffentlichten Eintrag.
- Firmenuebersicht zeigt den Eintrag samt Premium-Kennzeichnung; die
  Firmendetailseite zeigt Name, Branche und Sprachen ohne Fehlerseite.
- Der bereits aktivierte Referral-Grant und sein Testende blieben unveraendert.

Die damaligen kleinen Stammdatenlisten (ZH, IT, DE/EN) waren synthetisch. Der
Anwendungscode in `lib/directus.ts`, die Produktion und die Favicons wurden
hierfuer nicht veraendert. Kein Commit oder Push.

## Ergaenzung vom 16.09.2026: Bestaetigungsanzeige nach Registrierung

Beim manuellen Test erschien kurz die erfolgreiche E-Mail-Bestaetigung und
danach eine Fehlermeldung. Das Testkonto war bereits aktiv. Das lokale Protokoll
zeigte einen erfolgreichen Bestaetigungs-POST und anschliessend einen Seitenaufruf
ohne Token. Die URL-Bereinigung innerhalb der Bestaetigungs-Komponente konnte
dadurch die Erfolgsmeldung durch den Fehlerzustand fuer fehlende Tokens ersetzen.

Die Komponente navigiert nach erfolgreicher Bestaetigung jetzt vollstaendig auf
`/{locale}/registrierung-bestaetigt`. Diese reine Ergebnisseite fuehrt keine
erneute Verifikation aus. Nach Team-Einladungen wird stattdessen weiterhin das
vom Server vorgegebene Dashboard geoeffnet; die volle Navigation liest die neue
Sitzung. Fehler entfernen den Token und bleiben als Fehler sichtbar.

Der gezielte Browserlauf mit einem frischen lokalen Testkonto ist bestanden:

- Registrierung mit `BROWSERTEST`, echte Mail im lokalen Mailpit und Aufruf
  ihres Bestaetigungslinks in einem einzelnen Browser-Tab.
- Genau ein erfolgreicher Bestaetigungs-POST; Konto danach `active` und genau
  eine Empfehlungseinloesung mit `pending_organization`.
- Gruene Erfolgsanzeige bleibt stehen und nach einem expliziten Neuladen erhalten.
  Das Neuladen erzeugt keinen weiteren Bestaetigungs-POST.
- Die bewusste Wiederverwendung desselben Einmallinks in einem zweiten Tab
  liefert korrekt HTTP 400 und die Fehlermeldung; die Token-URL wird bereinigt.

Zusaetzlich bestanden die fuenf gezielten Tests in
`tests/registration-verification.test.mjs`, ESLint, App-TypeScript und
`git diff --check`. Der Einladungszweig wurde in diesem Schritt nur im gezielten
Komponententest geprueft, nicht erneut mit einer echten Team-Einladung.
Die Testumgebung bleibt fuer den manuellen Test des Nutzers aktiv. Produktion,
Favicons und Git-Branch unveraendert; kein Commit oder Push.

## Ergaenzung vom 13.09.2026: vollstaendiger Profilablauf bestanden

Der zuvor fehlende Ablauf wurde mit ergaenzten synthetischen Stammdaten im
Browser durchgefuehrt: neue Registrierung mit Code, E-Mail-Bestaetigung,
Anmeldung, Organisationserstellung, Free-Firmenprofil erstellen, Branche und
zwei Sprachen auswaehlen, zur Pruefung einreichen und ueber Pruefuebersicht und
Detailmaske freigeben. Listing und Revision wurden diesmal durch die regulaeren
Formulare erstellt, nicht direkt als Datenbank-Fixture angelegt.

Die Freigabe erzeugte automatisch genau einen Referral-Grant. Anzeige in der
Empfehlungsverwaltung: 13.09.2026 bis 13.12.2026, jeweils gleiche Schweizer
Uhrzeit. Die UTC-Verschiebung durch die Zeitumstellung wurde beruecksichtigt.
Die Datenbank bestaetigte das veroeffentlichte Listing, den korrekten Grant,
den Zeitraum und null Subscriptions. Es gab keinen Checkout.

Nach Rueckkehr zur Firmenkonto-Rolle waren die Premium-Bereiche bedienbar.
Englische Beschreibung und individueller Aktionsbutton liessen sich speichern;
die Werte wurden korrekt als neue Revision zur Pruefung angenommen. Die erste
Veroeffentlichung und der bestehende Grant blieben erhalten. Auch die lokale
Freigabe-Mail enthielt das richtige Testende und keinen Checkout-Link.

Zum Wechsel zwischen Firmenkonto und Moderation wurde wie im ersten Browserlauf
nur die Rolle des Wegwerf-Testbenutzers geaendert und neu angemeldet. Dies ist
eine Testvorrichtung, kein vorgesehener Kundenablauf. Die Firmenrechte sind
synthetische Test-Policies und keine Bestaetigung der produktiven Berechtigungen.
Datei-Uploads und Zahlungsabwicklung waren nicht Teil dieses Tests.

Die ergaenzten Fixtures liegen in `tests/fixtures/referral-browser.sql` und
`tests/referral-browser-setup.mjs`. Der isolierte Backend-Runner kann sie mit
`node scripts/test-referral-directus.mjs --isolated --browser-fixture` mitpruefen.
Dieser Befehl ist ein Backend-/Fixture-Test; er wiederholt nicht automatisch
die manuellen Browserinteraktionen. Das Produkt bleibt standardmaessig aus.

Der erneute Runner-Durchlauf mit `--browser-fixture` war erfolgreich, ebenso
ESLint, App-TypeScript, Referral-TypeScript und `git diff --check`. Beide
Testumgebungen, die temporaere Next-Kopie und private Testlogs wurden entfernt.
Alle drei vorhandenen Favicons blieben bytegleich. Keine Produktivmigration,
kein Commit, Push oder Branch-Wechsel.

Die folgenden Abschnitte dokumentieren den frueheren Lauf vom 12.09.; dessen
Einschraenkung zur Firmenprofil-Erfassung ist durch den heutigen Test erledigt.

Getestet mit der echten Next-Anwendung in einer temporaeren Quellkopie,
Directus 11.17.4, PostgreSQL und lokalem Mailpit. Keine Projekt-.env-Dateien
kopiert; keine Verbindung zur zentralen Directus-Instanz. Backend und Datenbank
blieben in einem internen Docker-Netz. Ein ausschliesslich an localhost
gebundener Proxy erlaubte dem separaten Next-Prozess den Zugriff.

## Im Browser bestanden

- Empfehlungscode wird aus dem Registrierungslink vorausgefuellt.
- Sprachwechsel Deutsch → Englisch erhaelt den Code.
- Ungueltiger Code zeigt die passende Fehlermeldung; anschliessend kann mit
  gueltigem Code erfolgreich registriert werden.
- Registrierungsformular zeigt den Hinweis auf die Bestaetigungs-Mail.
- Echte Next-Bestaetigungsseite akzeptiert den Token aus der lokalen Testmail.
- Anmeldung des bestaetigten Kontos und Organisationserstellung funktionieren.
  Die gespeicherte Einloesung ist mit genau dieser Organisation verknuepft.
- Admin-Uebersicht zeigt Organisation, Code und Status korrekt an.
- Partner anlegen, erzeugten Link anzeigen, bearbeiten und deaktivieren funktionieren.
  Bei Bearbeitung bleibt der Code unveraenderlich.
- Filter nach Empfehlungsgeber zeigt die passende Registrierung.
- Ein kontrolliert fehlgeschlagener Grant bleibt als ausstehende Aktivierung
  sichtbar. Der Retry-Knopf nutzt die echte Next-API und aktiviert Premium.
  Start und Ende bleiben gegenueber der Reservierung unveraendert.

## Testaufbau und Grenzen

Das minimale Backend-Testschema wurde fuer den Browserlauf um Leserechte fuer
das eigene Benutzerprofil inklusive Avatar/Rolle, eigene Mitgliedschaften und
Organisationen ergaenzt. Ohne diese Testrechte lieferte Directus bei `/users/me`
nur die Benutzer-ID; dies war eine Luecke im Testaufbau. Die produktiven Rechte
wurden nicht gelesen oder veraendert.

Nach der Organisationszuordnung wurde das Wegwerf-Benutzerkonto fuer den
Admin-Oberflaechentest zur Test-Adminrolle umgestellt und erneut angemeldet.
Das ist ein Testfixture-Schritt, kein Produktablauf.

Die Firmenprofil-Erfassung wurde nicht vollstaendig im Browser durchlaufen:
Dem minimalen Schema fehlen Verzeichnis-Stammdaten, insbesondere `cantons`.
Fuer den Retry-Test wurden Listing und Revision als Fixture angelegt und ueber
den echten Freigabe-Endpunkt freigegeben. Ein temporaerer Datenbank-Trigger
simulierte dabei einen Grant-Fehler und wurde vor dem Browser-Retry entfernt.
Der Test belegt deshalb die Browser-Registrierung bis zur Organisationszuordnung
und die Empfehlungsverwaltung, keinen lueckenlosen Browserlauf durch alle
bestehenden Firmenprofil- und Moderationsmasken.

Produktive Serverversion, vollstaendiges Schema und produktive Policies bleiben
vor Auslieferung gesondert zu pruefen. Das Feature wurde nicht live aktiviert.
Keine Anwendungsdateien fuer diesen Browserlauf geaendert; nur diese Ergebnisse
und der Teststatus dokumentiert. Keine Commits oder Pushes.
