# Findelio-Blog in Directus

Der Blog wird in der Directus-Sammlung `blog_posts` gepflegt. Beiträge können dort einzeln erstellt oder als JSON beziehungsweise CSV importiert werden.

## Einen Beitrag erstellen

1. In Directus **Inhalte → Blogbeiträge** öffnen.
2. Einen neuen Eintrag anlegen und zunächst den Status **Entwurf** verwenden.
3. Sprache, Titel, URL-Kennung, Zusammenfassung und Artikeltext ausfüllen.
4. Optional Kategorie, Titelbild, Bildbeschreibung sowie eigene SEO-Angaben ergänzen.
5. Den Status auf **Veröffentlicht** ändern. Das Veröffentlichungsdatum wird dabei automatisch gesetzt; für eine geplante Veröffentlichung kann vorher ein zukünftiger Zeitpunkt eingetragen werden.

Die URL-Kennung darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten, zum Beispiel `lokale-sichtbarkeit-fuer-kmu`.

Der Artikeltext verwendet Markdown. Unterstützt werden unter anderem Zwischenüberschriften, Listen, Links, Zitate, Tabellen sowie fett und kursiv gesetzter Text. Eingebettetes HTML wird auf der Website nicht ausgeführt.

## Kategorien

Jede in Directus eingetragene Kategorie wird automatisch als Filter im Blogarchiv angezeigt. Der Kategoriename auf einer Blogkarte und im Artikelkopf führt ebenfalls direkt zu diesem gefilterten Archiv. Neue Kategorien benötigen deshalb keine zusätzliche Konfiguration; wichtig ist lediglich eine einheitliche Schreibweise in den Beiträgen.

## Vorbereitete Artikel

Die Datei [`content/blog-import-de-ch.json`](content/blog-import-de-ch.json) enthält drei deutschsprachige Entwürfe:

- Mehrsprachige Kundschaft in der Schweiz erreichen
- Lokale Online-Sichtbarkeit für Schweizer KMU
- Firmenprofil optimieren und Vertrauen schaffen

Die drei Artikel sind in der lokalen Directus-Umgebung bereits importiert und veröffentlicht. Die JSON-Datei bleibt als reproduzierbare Importvorlage für eine andere Umgebung erhalten. Dort in Directus die Sammlung **Blogbeiträge** öffnen, **Importieren/Exportieren** wählen und die Datei importieren. Neue Importe werden nicht automatisch veröffentlicht. Titelbilder müssen separat in die Directus-Dateiverwaltung hochgeladen und beim jeweiligen Artikel ausgewählt werden. Das Bildfeld verwendet automatisch den Ordner **Public**, damit ein veröffentlichtes Titelbild auch auf der öffentlichen Website geladen werden kann.

## Titelbilder

Die drei generierten 16:9-Originale liegen zusätzlich unter `public/blog/` und sind in Directus den passenden Beiträgen inklusive Bildbeschreibung zugeordnet:

- `mehrsprachige-kundschaft-schweiz.png`
- `lokale-online-sichtbarkeit-schweizer-kmu.png`
- `firmenprofil-vertrauen.png`

Die Bildserie verwendet eine gemeinsame ruhige, redaktionelle Bildsprache in Dunkelblau, Findelio-Blau, Weiss und hellem Blau. Sie enthält keine Schriftzüge, Marken oder Wasserzeichen.

## Mehrsprachige Artikel

Jede Sprachfassung ist ein eigener Beitrag. Dadurch können Titel, URL-Kennung, Inhalt und Suchmaschinenangaben natürlich für die jeweilige Sprache formuliert werden. Beim Import muss das Feld `locale` einen dieser Werte enthalten:

`de-ch`, `en`, `sk`, `cs`, `hu`, `pl`, `ru`, `pt-pt` oder `ro`.

## SEO-Kurzcheck vor der Veröffentlichung

- Der Titel beschreibt eine konkrete Frage oder einen klaren Nutzen.
- Die Zusammenfassung ist eigenständig verständlich und ungefähr ein bis zwei Sätze lang.
- Der Artikel besitzt sinnvolle Zwischenüberschriften und beantwortet die Suchabsicht vollständig.
- Das Titelbild hat eine beschreibende Bildalternative.
- SEO-Titel und SEO-Beschreibung sind optional; ohne eigene Werte werden Titel und Zusammenfassung verwendet.
- Interne Aussagen, Preise und Produktfunktionen sind aktuell.

Veröffentlichte Beiträge erscheinen automatisch auf `/[sprache]/blog`, in der Sitemap und – bei direktem Aufruf – mit Artikel-Metadaten und strukturierten Daten.
