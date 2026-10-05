# Arbeitsregeln für Findelio

## Projektkontext

- Projektordner: `C:\Webprojekte\findelio-website`
- Aktiver Branch: `main`
- Next.js-Projekt ohne `src`-Ordner
- Massgebende Compose-Datei für Directus, PostgreSQL und Redis: `infra/compose.yaml`
- Directus lokal: `http://localhost:8055`
- Next.js lokal: `http://localhost:3000`

## Verbindliche Arbeitsweise

- Vor Git-Schritten immer zuerst `git status` prüfen.
- Vor Änderungen die betroffenen Dateien und den tatsächlichen aktuellen Zustand lesen.
- Bestehende lokale Änderungen nicht überschreiben.
- Directus-Einstellungen, Feldnamen, Beziehungen und Berechtigungen nie erraten.
- Bei manuellen Directus-Schritten jeweils einen konkreten Schritt mit vollständigem UI-Pfad nennen und auf Bestätigung warten.
- Nur betroffene Dateien ändern und keine unnötigen Erklärkommentare in Code einfügen.
- Für einen technischen Gesamttest nicht jede der neun Sprachen einzeln testen, sofern dies keinen zusätzlichen Nutzen bringt.
- Vor einem Commit mindestens `npm run build` und, falls vorhanden, `npm run lint` ausführen.
- Nie `npm audit fix --force` ausführen.
- Keine Komplettprojekt-ZIPs erstellen. Falls eine ZIP erforderlich ist, nur geänderte Dateien mit korrekter Ordnerstruktur aufnehmen.
- In deutscher Sprache, Du-Form und Schweizer Schreibweise mit `ss` statt `ß` kommunizieren.
- `PROJECT_STATUS.md` nach jedem abgeschlossenen grösseren Schritt aktualisieren.

## Geheimnisse und ausgeschlossene Dateien

- Keine Passwörter, Tokens, App-Passwörter oder Inhalte aus `.env` und `.env.local` dokumentieren oder in Git aufnehmen.
- `.env`, `.env.local`, `.git`, `.next`, `node_modules`, Directus-Uploads und andere Geheimnisse nie in ZIPs oder Commits aufnehmen.

## Vorher nachfragen

- Unklare Directus-Berechtigungen oder Datenmodelländerungen
- Migrationen oder Löschung von Daten
- Änderungen an Rollen und Policies
- Änderungen an `.env`, `.env.local` oder geheimen Werten
- Grössere Architekturänderungen
- Git-Commit oder Push
- Unsichere oder mehrdeutige Anforderungen
