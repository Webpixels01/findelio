# Lokaler Patch für braces 3.0.3

Quelle: https://github.com/micromatch/braces/tree/3.0.3 (MIT, siehe LICENSE).

Für [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
ist am 20.10.2026 keine korrigierte Upstream-Version veröffentlicht.
Diese Kopie ersetzt ausschließlich die indirekte Entwicklungsabhängigkeit
über `overrides` in package.json.

Änderungen gegenüber 3.0.3:

- Der Parser erlaubt höchstens 128 ineinander verschachtelte Blöcke
  (geschweifte Klammern und Klammerausdrücke).
- Compile, Expand und Stringify prüfen auch direkt übergebene ASTs iterativ
  auf Tiefe, Zyklen und Anzahl der Knoten, bevor rekursive Walker starten.
- Paketversion ist `3.0.3-findelio.1`; Entwicklungs-/Release-Skripte entfernt.

Regressionen: `tests/braces-security.test.mjs`. Sobald Upstream einen
getesteten Fix veröffentlicht, die Kopie und das Override entfernen und die
Lockdatei aktualisieren. Die lokale Versionsnummer ist keine Aussage über
einen offiziellen Upstream-Fix.
