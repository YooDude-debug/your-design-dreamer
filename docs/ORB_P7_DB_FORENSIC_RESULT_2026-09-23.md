# ORB Core – P7 DB-Forensik / Messphase (2026-09-23)

Status: READ-ONLY abgeschlossen. Kein Produktionscode geändert. Keine Optimierung.
Referenz: `docs/ORB_P6_CORRECTION_SNAPSHOT_OPTIMIZATION_RESULT_2026-09-23.md`

Alle Befunde sind als **BEWIESEN**, **WAHRSCHEINLICH** oder **UNBEKANNT** gekennzeichnet.

---

## 1. P6-Baseline

P6 hat im Korrekturpfad die nachweislich verworfene Momentaufnahme entfernt
(`applyFeedback` statt `recordFeedback`). Diese Fassung ist die P7-Baseline;
sie wurde in P7 nicht verändert.

## 2. Untersuchungsumfang

Gemessen mit einem lokalen, temporären Messwerkzeug (`scripts/orb-p7-measure.ts`,
nach der Messung entfernt) über den Attrappen-Datenbankclient
`tests/helpers/fake-supabase.ts`. Kein Zugriff auf die Produktionsdatenbank;
Produktionszahlen ausschliesslich lesend aus `orb_metrics`.

Untersucht: Momentaufnahme am Zugende, die zwei Vorschlags-Abfragen, Umfang und
Consumer der Momentaufnahme, Korrekturpfad (0/1/2/4 Erinnerungen),
Mengen-Skalierung, Produktions-Ausreisser 40/43.

## 3. Vollständige DB-Operationszählung

**BEWIESEN** – bisherige Statistik (`db_queries`) und tatsächliche Operationen
weichen systematisch ab; der Abstand ist konstant 10 Operationen
(= 9 Reads + 1 bedingter `orb_state`-Write der Momentaufnahme):

| Szenario | tatsächlich | Reads | Writes | gemeldet (`db_queries`) | Differenz |
| --- | --- | --- | --- | --- | --- |
| Momentaufnahme allein (0 Verbindungen) | 9 | 9 | 0 | – | – |
| Momentaufnahme allein (1 Verbindung) | 10 | 9 | 1 | – | – |
| normale Nachricht (leerer Graph) | 24 | 20 | 4 | 14 | 10 |
| normale Nachricht (4 Erinnerungen) | 38 | 25 | 13 | 27 | 11 |
| mengenstark (6 Knoten/12 Verb./10 Fäden) | 38 | 22 | 16 | 27 | 11 |
| Korrektur, 0 betroffene Erinnerungen | 28 | 21 | 7 | 18 | 10 |
| Korrektur, 1 betroffene Erinnerung | 31 | 22 | 9 | 21 | 10 |
| Korrektur, 2 betroffene Erinnerungen | 33 | 22 | 11 | 23 | 10 |
| Korrektur, 4 betroffene Erinnerungen | 37 | 22 | 15 | 27 | 10 |

Der Zähler (`QueryCounter`) wird im Korrekturpfad/Rückmeldepfad und in der
Momentaufnahme nicht mitgeführt; die Momentaufnahme am Zugende ist deshalb in
`orb_metrics.db_queries` grundsätzlich nicht enthalten. RPCs: 0 in allen Pfaden.

## 4. Analyse der End-of-Turn-Momentaufnahme

**BEWIESEN** – Auslöser: `processInput` → `snapshot: await getSnapshot(db, userId, perf)`
(engine.server.ts:1694). Reihenfolge der Operationen:

1. `orb_state.select` (`ensureState`; Insert nur beim ersten Besuch)
2–9 parallel (`Promise.all`):
2. `orb_nodes.select` (limit GRAPH_LIMIT, sortiert)
3. `orb_connections.select` (limit GRAPH_LIMIT)
4. `orb_messages.select` (id, role, body, decision; limit 40)
5. `orb_interests.select` (limit 20)
6. `orb_suggestions.select` (Liste inkl. `posts(title)`, limit 20)
7. `orb_suggestions.select` (nur `status`, accepted/rejected, limit 500)
8. `orb_threads.select` (limit 12)
9. `orb_style.select` (maybeSingle)
10. `orb_state.update` – nur wenn Verbindungen vorhanden sind: schreibt
    `decay_computations` und den zum Lesezeitpunkt erholten `energy`-Wert.

Alle acht Leseergebnisse werden im Rückgabewert verwendet (Consumer siehe 6);
die Momentaufnahme enthält keinen ungenutzten Read. Der `orb_state.update`
ist ein Side Effect (Zählwert Verfallsberechnungen + Energie-Erhalt) –
**BEWIESEN**, damit ist die Momentaufnahme nicht nebenwirkungsfrei.

**BEWIESEN** – Doppellesungen innerhalb desselben Zuges: `orb_state`, `orb_nodes`,
`orb_messages`, `orb_interests`, `orb_threads`, `orb_style` werden bereits früher
im Zug gelesen. In jedem dieser Fälle liegen dazwischen Schreibvorgänge desselben
Datenbestands (`orb_state.update`, `orb_messages.insert`, `orb_style.insert`,
`orb_nodes.update/insert`, `orb_interests.upsert`, `orb_threads.insert/update`):
Muster **READ → WRITE → READ**, also kein Fall von nachweisbarer Redundanz.
`orb_connections` und `orb_suggestions` werden im leeren Fall ausschliesslich in
der Momentaufnahme gelesen (READ → READ existiert dort nicht).

## 5. Analyse der zwei Vorschlags-Abfragen

**BEWIESEN** für beide:

| | Abfrage 6 | Abfrage 7 |
| --- | --- | --- |
| Query | `orb_suggestions` select `id, post_id, topic, reason, relevance, status, posts(title)`, `eq user_id`, order relevance, limit 20 | `orb_suggestions` select `status`, `eq user_id`, `in status [accepted,rejected]`, limit 500 |
| Auslöser | `getSnapshot` (Promise.all) | `getSnapshot` (Promise.all) |
| Zeitpunkt | Zugende, parallel | Zugende, parallel |
| gelesene Daten | offene/alle Vorschläge inkl. Beitragstitel (Join) | nur Statuswerte entschiedener Vorschläge |
| Consumer | `snapshot.suggestions` → `OrbSuggestions` (sichtbare Vorschlagsleiste) | `snapshot.metrics.suggestionsAccepted/Rejected` → nur `OrbDevPanel` (Diagnose-Abschnitt der ORB-Seite) |
| tatsächliche Verwendung | ja, sichtbar | ja, aber ausschliesslich als zwei Diagnosezahlen |
| Abhängigkeiten | Join auf `posts` | keine |
| Zusammenhang | gleiche Tabelle, gleicher `user_id`-Filter, unterschiedliche Filter/Spalten/Limits | dito |

**WAHRSCHEINLICH** – Optimierungspotenzial besteht: die zweite Abfrage liest bis
zu 500 Zeilen für zwei Diagnosezahlen und ist mit der ersten nicht filtergleich,
könnte aber durch eine Zählung (count) oder eine Bedarfsabfrage ersetzt werden.
Nicht bewiesen ist, dass dies ohne Verhaltensänderung der Anzeige möglich ist.
In P7 wurde nichts verändert oder zusammengelegt.

## 6. Consumer-Analyse (nach Codepfad, nicht nach Namen)

| Bestandteil | Consumer | Zweck |
| --- | --- | --- |
| `state`, `cracks`, `goals` | ORB-Seite (Energie/Zustandsanzeige), Gesichtsdarstellung, `OrbDevPanel` | sichtbare Antwortumgebung |
| `nodes`, `connections` | `OrbGraph`, Erinnerungsliste, `metrics` | sichtbare Graph-/Memory-Anzeige |
| `messages` | Chatverlauf der ORB-Seite; ausserdem intern `conversationTopics` für die Faden-Relevanz | sichtbar + interne Relevanzberechnung |
| `interests` | `OrbInterests`, `OrbDevPanel`; intern Eingabe der Faden-Relevanz | sichtbar + intern |
| `threads` | Abschnitt „Gedankenfäden", `OrbDevPanel` | sichtbar |
| `suggestions` | `OrbSuggestions` | sichtbar |
| `style` | `OrbDevPanel` (Stilmuster) | Diagnose |
| `metrics.*` | ausschliesslich `OrbDevPanel` | Diagnose |
| `perf` | Diagnose/Beobachtbarkeit | Diagnose |

**BEWIESEN** – kein Bestandteil der Momentaufnahme fliesst in Memory-, Graph-,
Curiosity-, Energy- oder Autonomie-Entscheidungen zurück: die Momentaufnahme
entsteht erst nach allen Entscheidungen und Schreibvorgängen des Zuges. Einzige
Ausnahme mit interner Wirkung ist der Side Effect in `orb_state`
(Verfallszähler/Energie-Erhalt).

**WAHRSCHEINLICH** – `style` und `metrics` (inkl. der zweiten Vorschlags-Abfrage)
werden nur im Diagnoseabschnitt angezeigt. Ob dieser Abschnitt für alle Nutzer
sichtbar ist, wurde in P7 nicht bewertet.

## 7. Analyse der 40/43-Fälle

Mengen-Skalierung (Attrappe, identischer Text, wachsende Datenmenge):

| Knoten / Verbindungen / Fäden | tatsächlich | gemeldet | Knoten-Updates | Verbindungs-Writes |
| --- | --- | --- | --- | --- |
| 1 / 2 / 1 | 32 | 21 | 1 | 1 |
| 2 / 4 / 2 | 34 | 23 | 2 | 2 |
| 4 / 8 / 4 | 38 | 27 | 4 | 4 |
| 6 / 12 / 6 | 38 | 27 | 4 | 4 |
| 8 / 16 / 8 | 38 | 27 | 4 | 4 |
| 12 / 24 / 12 | 38 | 27 | 4 | 4 |

**BEWIESEN** – die Last steigt mit der Zahl *betroffener* Erinnerungen und läuft
danach in ein Plateau (gemeldet 27 / tatsächlich 38): die Zahl gleichzeitig
verarbeiteter Erinnerungen ist begrenzt, grössere Graphen erzeugen keine
weiteren Schleifendurchläufe. Ein unbegrenztes mengenabhängiges Wachstum ist
damit nicht belegt.

Produktionsdaten (lesend, `orb_metrics`, letzte 4 Tage, `db_queries >= 34`):
je ein Fall mit 43 (25 Knoten / 60 Verbindungen geladen) und 40 (15 / 60),
dazu 5 Fälle mit 38, 6 mit 37, 6 mit 35, 6 mit 34. Tagesmittel 11,8–16,0,
p95 24–37.

**UNBEKANNT** – die konkreten Fälle mit 40 und 43 gemeldeten Abfragen konnten mit
der P6-Baseline nicht reproduziert werden; das Plateau der Messung liegt bei 27
gemeldeten Abfragen. Die in P5 vermutete Ursache (mengenabhängige Schleifen
desselben Pfades) ist damit **nicht bewiesen** und in Teilen sogar
messtechnisch nicht bestätigt. Diese Produktionsfälle bleiben ausdrücklich
**nicht eindeutig zuordenbar** (keine Ereignis-IDs in den historischen Zeilen,
keine Kennzeichnung des Pfades in `orb_metrics`).

## 8. Korrekturpfad-Messung (P6 unverändert)

| betroffene Erinnerungen | tatsächlich | gemeldet | Momentaufnahmen | Knoten-Updates |
| --- | --- | --- | --- | --- |
| 0 | 28 | 18 | 1 | 0 |
| 1 | 31 | 21 | 1 | 1 |
| 2 | 33 | 23 | 1 | 2 |
| 4 | 37 | 27 | 1 | 4 |

**BEWIESEN** – die P6-Wirkung hält unter allen gemessenen Mengen: genau eine
Momentaufnahme je Zug, unabhängig von der Zahl der Rückmeldungen. Der Zuwachs
je betroffener Erinnerung beträgt jetzt ~2 Operationen (Knoten-Update +
Verbindungs-/Interessen-Write), nicht mehr ~12.

## 9. Vergleich der DB-Lasten

- Grundlast eines Zuges ohne Treffer: 24 Operationen tatsächlich (14 gemeldet),
  davon 10 in der Momentaufnahme (41 %).
- Zug mit Treffern: 31–38 tatsächlich, Anteil der Momentaufnahme 26–32 %.
- Korrekturpfad: 28–37 tatsächlich – vor P6 bis 139 bei 4 Rückmeldungen.
- Produktion (Mittel ~14 gemeldet) entspricht rechnerisch ~24 tatsächlichen
  Operationen je Zug (**WAHRSCHEINLICH**, da die Produktionszeilen keinen
  vollständigen Zähler enthalten).

## 10. Nachweisbare Redundanzen (BEWIESEN)

Keine. In P7 wurde keine Operation gefunden, deren Ergebnis unbenutzt bleibt
und die nicht durch einen dazwischenliegenden Schreibvorgang begründet ist.
Die einzige bekannte verworfene Momentaufnahme wurde in P6 entfernt.

Bewiesen ist lediglich der Messfehler: `db_queries` untererfasst jeden Zug um
10–11 Operationen.

## 11. Lediglich potenzielle Redundanzen (WAHRSCHEINLICH)

1. Zweite Vorschlags-Abfrage: bis 500 Zeilen für zwei Diagnosezahlen.
2. Umfang der Momentaufnahme: `style` und `metrics` dienen nur der Diagnose;
   ob sie in jedem Zug benötigt werden, ist unbewiesen.
3. Doppellesungen (`orb_nodes`, `orb_messages`, `orb_threads`, `orb_interests`,
   `orb_state`, `orb_style`) sind wegen der dazwischen liegenden Writes
   semantisch begründet; ein Aufbau der Momentaufnahme aus bereits bekannten
   Daten wäre denkbar, würde aber Schreib-/Leseordnung berühren – nicht bewertet.

## 12. Weiterhin unbekannte Punkte (UNBEKANNT)

- Produktionsfälle mit 40/43 Abfragen: nicht eindeutig zuordenbar.
- Anteil/Häufigkeit des Korrekturpfads in der Produktion.
- Sichtbarkeit des Diagnoseabschnitts für Endnutzer.
- 134 historische Modellaufrufe (aus P2) weiterhin ungeklärt; Zeitraum der
  Verbrauchsanzeige unbekannt.

## 13. Tests

Nach Entfernen des Messwerkzeugs: Logic-Tests, DB-/Security-Tests, Typecheck,
Lint und Build ausgeführt – Ergebnis siehe Abschlussmeldung. Produktionscode
nach P7 unverändert (keine Datei in `src/` geändert).

## 14. Kosten der Messung

Die Messungen liefen über den Attrappen-Client; Datenbanklast entstand nur durch
vier lesende Produktionsabfragen auf `orb_metrics`/Katalog.

**Offen deklariert:** Der erste Messlauf wurde versehentlich mit gesetzten
Modellschlüsseln gestartet. Dabei entstanden 7 echte Aufrufe an die
Sprachschicht (je Zug ein fehlgeschlagener Erstversuch mit HTTP 429 und ein
erfolgreicher Aufruf über das Lovable-Gateway mit `openai/gpt-6-astra`).
Alle weiteren Läufe wurden ohne Schlüssel ausgeführt (`model_calls: 0`,
keine Credits). Die Messwerte der DB-Operationen sind davon unberührt.

## 15. Mögliche spätere Optimierungsansätze (nur Vorschlag, nicht freigegeben)

1. Zählung vervollständigen: Momentaufnahme und Rückmeldepfad in `db_queries`
   erfassen, damit Produktionswerte vergleichbar werden (Messfrage, keine
   Optimierung).
2. Zweite Vorschlags-Abfrage: durch eine Zählabfrage ersetzen.
3. Diagnoseanteile der Momentaufnahme (`style`, `metrics`) nur bei Bedarf laden.
4. Pfadkennzeichnung in `orb_metrics`, damit künftige Ausreisser zuordenbar sind.

**STOPP** – keine Optimierung implementiert, keine Migration, kein Deployment,
keine ChatBridge. P8 nur nach ausdrücklicher Freigabe.
