# Kundenbewertungen

Bewertungen erscheinen im Unternehmensprofil unter `#reviews`. Die Zusammenfassung
unter dem Titel und in den Suchkarten verlinkt dorthin. Nur freigegebene Bewertungen
zählen zum Durchschnitt. Die Liste lädt jeweils 20 Bewertungen.

Angemeldete, aktive Directus-Nutzer können pro veröffentlichtem Listing eine
Bewertung mit 1–5 ganzen Sternen und 10–3000 Zeichen einreichen. Die bestehende
E-Mail-Verifizierung aktiviert registrierte Konten. Aktive Mitglieder der zugehörigen
Organisation dürfen ihr eigenes Unternehmen nicht bewerten. Öffentlich wird nur der
Vorname angezeigt, keine E-Mail-Adresse oder Nutzer-ID.

Unter `/dashboard/bewertungen` sehen Directus-Administratoren ausstehende Bewertungen
und können sie freigeben oder ablehnen. Unternehmensmitglieder sehen dort freigegebene
Bewertungen ihrer Organisationen und können eine Antwort schreiben oder bearbeiten.
Antworten werden direkt veröffentlicht. Adminrechte allein erlauben keine Antwort
im Namen eines Unternehmens.

Änderungen durch den Autor versetzen die gesamte Bewertung wieder in den Status
`pending` und löschen eine bestehende Unternehmensantwort. Bis zur neuen Freigabe
ist die Bewertung unsichtbar und zählt nicht zum Durchschnitt. Versionsprüfungen
verhindern die Freigabe eines inzwischen geänderten Texts und das Überschreiben
veralteter Antworten. Eine identische erneute Einreichung erzeugt keine weitere Mail.

## Deployment und Betrieb

Die Migration `20261101_customer_reviews.sql` wird vom normalen Deployment angewendet.
Die Tabelle ist intern; es werden keine öffentlichen Directus-Items-Berechtigungen
vergeben. Alle Zugriffe laufen durch die geprüften Endpunkte der vorhandenen
`findelio-review-notification`-Erweiterung. Ihre `src`-Dateien werden mit
`node scripts/build-security-extensions.mjs` nach `dist` kopiert.

`ADMIN_NOTIFICATION_EMAIL` und `FINDELIO_SITE_URL` sowie funktionierendes SMTP sind
Voraussetzung für Einreichungen. Die Mail enthält Text, Sterne und einen Link zur
Freigabeliste. Scheitert die SMTP-Übergabe, wird die Datenbankänderung zurückgerollt;
der Nutzer kann erneut versuchen. SMTP-Annahme bestätigt keine Zustellung im Postfach.
Ein Prozessabbruch nach SMTP-Annahme vor Datenbank-Commit kann zu einer doppelten Mail
beim erneuten Versuch führen. Einreichungen sind auf zehn Versuche pro Stunde und
Nutzer begrenzt; Moderation/Antworten auf 120 Aktionen.

## Prüfung

`node --test tests/customer-reviews.test.mjs` prüft die echten Endpoint-Handler mit
einem Speicheradapter (keine echte Datenbank/SMTP): Validierung, eigene Unternehmen,
Freigabe, Versionskonflikte, Sichtbarkeit, Antworten, erneute Prüfung, Mailfehler,
Rate-Limits, inaktive Konten und Übersetzungen. Die normalen Regressionstests prüfen
zusätzlich, dass die ausgelieferten Erweiterungen dem Quellcode entsprechen.

Vor Produktionsfreigabe mit einer Testdatenbank und Testpostfach prüfen: registrieren
und E-Mail bestätigen, Bewertung einreichen, Adminmail öffnen, freigeben/ablehnen,
Sternedurchschnitt kontrollieren, als Unternehmensmitglied antworten, Bewertung
ändern und erneut freigeben. Auch zwei gleichzeitig geöffnete Moderationsseiten
prüfen: die zweite Aktion muss einen Versionskonflikt melden.

## Besucherkonten

Migration `20261102_visitor_accounts.sql` legt die Rolle „Besucher“ mit einer eigenen
minimalen Policy an: eigenes Nutzerprofil lesen, Rollenname lesen, kein CMS-Zugang
und keine Firmenverwaltung. `/registrieren` registriert explizit Besucher über
`/findelio-referrals/register-visitor`. Rollen-ID und Status sind serverseitig fest:
immer `unverified`, unabhängig von der Einstellung für Firmenregistrierungen.
Der bestehende signierte Directus-Bestätigungslink aktiviert das Konto. Vorher ist
keine Anmeldung möglich; auch die Bewertungsendpunkte prüfen `status = active`.

Bestehende Konten werden weder umgestuft noch überschrieben. Unbestätigte Besucher
können durch erneutes Absenden eine Bestätigungsmail anfordern (bestehendes Limit:
maximal drei Versuche pro Tag und mindestens 60 Sekunden Abstand). Zusätzlich ist
die Besucherregistrierung nach IP limitiert. Hinter dem Frontend-Proxy teilen sich
Registrierungen dessen vom CMS erkannte IP und damit das Limit von 30 pro Stunde.

Besucher gelangen auf `/konto`; der Header zeigt „Mein Konto“. Firmen-Dashboards
leiten Besucher zur Kontoseite weiter. Favoriten sind noch nicht implementiert.
`tests/visitor-registration.test.mjs` prüft Rollen-/Statusmanipulation, vorhandene
Konten, Bestätigungsmail und Eingabevalidierung. Ein Test mit realem Directus,
Datenbankmigration und Bestätigungslink ist vor dem Release weiterhin erforderlich.
