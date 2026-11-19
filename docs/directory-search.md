# Stichwortsuche im Firmenverzeichnis

Das optionale Feld `q` durchsucht veröffentlichte Firmennamen, Branchen sowie
sichtbare Beschreibungen. Alle Wörter müssen vorkommen; Grossschreibung und
Akzente werden ignoriert. Branchenübersetzungen der aktuellen Seitensprache
werden berücksichtigt. Übersetzte Beschreibungen bleiben wie die Profilanzeige
an einen aktiven Premium-Zugang gebunden.

Die bisherigen Filter für Sprache, Branche, Kanton und Ort gelten zusätzlich.
Exakte Namen, Namensanfänge und weitere Namenstreffer stehen vor sonstigen
Treffern. Innerhalb derselben Relevanzgruppe werden Premium-Firmen bevorzugt;
Name und ID sorgen für eine stabile Seitennavigation. Ohne Stichwort bleibt
der bisherige Suchablauf unverändert.

Vorschläge erscheinen nach zwei Zeichen und 300 ms Eingabepause, mit maximal
sechs Firmen. Sie berücksichtigen die Filter und lassen sich mit Pfeiltasten,
Enter oder Klick auswählen. Eine Auswahl startet die Suche mit dem Firmennamen.
Das reguläre Suchformular funktioniert auch ohne Vorschläge beziehungsweise
JavaScript. Bei fehlenden Treffern kann man die weiteren Filter entfernen und
den Suchbegriff behalten. Synonyme und Tippfehlertoleranz sind nicht enthalten.

## Deployment und Prüfung

Der reguläre Deployment-Ablauf aktiviert mit
`20261115_directory_search.sql` die PostgreSQL-Erweiterung `unaccent` und lädt
die neue Suchroute der bestehenden Directus-Erweiterung. Es werden keine
Firmeninhalte oder Rollenberechtigungen geändert. Ein reines Frontend-Deployment
reicht für diese Änderung nicht aus.

Der CMS-Endpunkt ist auf die bestehende Rolle `Findelio Server` beschränkt.
Die öffentliche Vorschlagsroute gibt ausschliesslich ID, Firmenname und Ort
zurück. Suchwerte werden als SQL-Parameter gebunden; Seitengrösse, Eingabelänge
und Abfragedauer sind begrenzt.

```bash
node --test tests/directory-search.test.mjs tests/directory-search-render.test.mjs tests/listing-pagination.test.mjs
node tests/directory-search.postgres.mjs --isolated
```

Der zweite Befehl verwendet nur einen temporären PostgreSQL-17-Container ohne
Netzwerk, Produktionsdaten oder Directus-Lizenz und entfernt ihn anschliessend.
