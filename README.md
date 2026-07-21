# Findelio

Lauffähiges Next.js-Frontend für das mehrsprachige Schweizer Firmenverzeichnis Findelio.

## Enthalten

- Next.js 16, TypeScript und Tailwind CSS
- Mehrsprachigkeit mit `next-intl`
- Sprachen: de-CH, EN, SK, CS, HU, PL, RU, PT-PT und RO
- Startseite mit funktionierender Suche
- Ergebnisliste mit Demodaten
- Firmenprofile
- Seite „Firma eintragen“
- Login-Oberfläche
- Impressum und Datenschutz als Platzhalter
- Responsive Header, Footer und Sprachumschalter
- Dockerfile und Docker Compose

## Lokal starten

```bash
npm install
npm run dev
```

Danach öffnen:

```text
http://localhost:3000
```

## Wichtig

Die Suche funktioniert aktuell mit zentralen Demodaten aus `data/companies.ts`.
Login und Firmenformular sind als vollständige Oberfläche vorbereitet, speichern aber noch nicht dauerhaft. Als nächster technischer Schritt kann Directus/PostgreSQL angebunden werden.

Vor dem Livegang müssen Impressum und Datenschutzerklärung mit den echten Betreiberangaben ergänzt werden.
