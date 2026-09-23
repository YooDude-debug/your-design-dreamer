# ORB CORE – P15: Gezielter Patch der bewiesenen Informationsbereichs-Lücke

Referenzen: `docs/ORB_ARCHITECTURE_SELF_ANALYSIS_RESULT_2026-09-23.md`,
`docs/ORB_P14_PATCH_REVIEW_RESULT_2026-09-23.md`.
Zeitpunkt: 2026-09-23, 12:39–12:42 UTC. **Modellaufrufe: 0. Kosten: 0,00 €.
Kein Deployment, keine Migration, keine Veröffentlichung.**

## 1. Exakte Ursache

Zwei belegte, unabhängige Lücken (P14, Abschnitt 2):

1. **Primär:** `DOMAIN_PATTERNS` in `src/orb-core/recall.ts` kannte nur vier Bereiche
   (`hardware`, `projekte`, `beruf`, `essen`). „Alter“ und „Wohnort“ fehlten →
   `questionIntentOf("Wie alt bin ich?") = null` → `topicAffinity = 0` und
   `similarity = 0` → `overlap = 0.000` → der harte Filter `overlap > 0` verwirft die
   gespeicherte Erinnerung, bevor Bewertung, aktive Erinnerungen und Kontextzeile
   erreicht werden.
2. **Sekundär:** `contentTokenPairs` in `src/orb-core/memory.ts` filterte keine
   Fragewörter; der Fallback „erstes Inhaltswort“ in `topicOf` machte daraus das
   künstliche Thema `wie` / `wann` / `warum` / `wer`. Folge: eine Kandidatenabfrage auf
   `topic="wie"`, die nichts trifft, und ein verbrauchter Suchbegriff-Platz von drei.

## 2. Geänderte Dateien

- `src/orb-core/recall.ts` – zwei neue Einträge in `DOMAIN_PATTERNS`.
- `src/orb-core/memory.ts` – neue Menge `QUESTION_WORDS`, angewendet **ausschliesslich**
  in `contentTokenPairs` (Themenbestimmung).
- `tests/orb-p15-information-domain.test.ts` – **neu**, 13 Regressionstests (A–H).

Nichts anderes wurde berührt: keine Relevanzformel, keine Schwelle, kein
Memory-Scoring, keine Speicherung, kein Graph, keine Neugier, keine Energie, keine
Autonomie, kein Prompt, kein Modell, keine Chat-Brücke, kein Schema, keine Migration.

## 3. Exakte Änderung

`src/orb-core/recall.ts`, angefügt nach dem Bereich `essen` (Reihenfolge = Priorität,
bestehende Bereiche gewinnen weiterhin zuerst):

```ts
["alter", /\b(alt|alter|jahre|jahren|jahr|geburtstag|geboren|jahrgang|lebensjahr)\b/i],
["wohnort", /\b(wohne|wohnt|wohnst|wohnen|wohnort|lebe|lebt|lebst|leben|stadt|
              heimatstadt|adresse|umgezogen|zuhause)\b/i],
```

`src/orb-core/memory.ts`: `QUESTION_WORDS` (wie, was, wer, wen, wem, wann, wieso, warum,
weshalb, woher, wohin, womit, wozu, wieviel, welche/welcher/welches/welchen/welchem) und
in `contentTokenPairs` eine zusätzliche Bedingung
`|| QUESTION_WORDS.has(w)`. `contentTokens` bleibt **unverändert**.

## 4. Vorher/Nachher-Messung (dieselben Fälle wie P14)

| Frage | Erinnerung | Bereich vorher → nachher | Thema vorher → nachher | Overlap vorher → nachher | Filter | erreicht Modell |
|---|---|---|---|---|---|---|
| A „Wie alt bin ich?“ | „Ich bin 36 Jahre.“ | `null` → **`alter`** | `wie` → `alt` | **0.000 → 0.120** | verworfen → behalten | nein → **ja** |
| A2 „Wann habe ich Geburtstag?“ | „Ich bin 36 Jahre.“ | `null` → **`alter`** | `wann` → `geburtstag` | 0.000 → 0.120 | verworfen → behalten | nein → **ja** |
| B „Wo wohne ich?“ | „Der Nutzer wohnt in Leipzig.“ | `null` → **`wohnort`** | `wohne` → `wohne` | **0.000 → 0.120** | verworfen → behalten | nein → **ja** |
| C „Welche Grafikkarte habe ich?“ | „RTX 5070 OC“ | `hardware` → `hardware` | `hardware` → `hardware` | 0.120 → 0.120 | behalten | ja (unverändert) |
| D „Was esse ich gerne?“ | „Schnitzel und Brokkoli“ | `essen` → `essen` | `null` → `null` | 0.120 → 0.120 | behalten | ja (unverändert) |
| E Gegenprobe Altersfrage | „RTX 5070 OC“ / „war wandern“ | – | – | **0.000 → 0.000** | verworfen | **nein (korrekt)** |
| G ohne passende Erinnerung | „Welche Grafikkarte…“ × „war wandern“ | – | – | 0.000 → 0.000 | verworfen | nein (korrekt) |
| F „Wer bin ich?“ | – | `null` → `null` | `wer` → `null` | – | – | Inhaltsprüfung unverändert (`contentTokens` enthält weiter „wer“) |

Nebenbefund, dokumentiert: „Wie heißt mein Projekt?“ hat jetzt das Thema `heißt` statt
`wie`; der Bereich bleibt `projekte`, der Kandidatenkreis und das Ergebnis sind
unverändert.

## 5. Regressionstests

`tests/orb-p15-information-domain.test.ts` – 13 Tests, alle Fälle A–H:
A Altersfrage (Bereich, kein Fragewort-Thema, Overlap ≠ 0), B Wohnortfrage inkl. „wohnt“
und „lebt“, C Hardwarefrage unverändert, D Essensfrage unverändert, E fremde Bereiche
bleiben 0, F reine Fragen bleiben inhaltlich erkennbar, G ohne passende Erinnerung nichts
durchgelassen, H wörtliche Treffer ranken weiterhin höher als die Untergrenze.

## 6. Nachweis: Relevanzfilter unverändert

Im Test hart geprüft (Textnachweis gegen `src/orb-core/engine.server.ts`):
`.filter((c) => c.overlap > 0)` und
`Math.max(similarity(text, n.content), topicAffinity(text, n.content))` sind unverändert
vorhanden. `TOPIC_AFFINITY_FLOOR === 0.12`, `shouldPersist(0.25) === false`,
`shouldPersist(0.35) === true`, `memoryRelevance({ similarity: 0 }) === 0`.
Keine niedrigere Schwelle, keine Fallback-Relevanz, keine „Frage immer durchlassen“-Regel,
keine globale Ausnahme.

## 7. Nachweis: unpassende Erinnerungen bleiben verworfen

Gemessen und getestet: Altersfrage × Grafikkarte = 0.000, Altersfrage × „war wandern“ =
0.000, Wohnortfrage × Essen = 0.000, Hardwarefrage × Alter = 0.000 – jeweils verworfen.

## 8. Prüfung der sechs weiteren Wortzerlegungsstellen

`contentTokens` wird als Inhaltsprüfung verwendet in `presence.ts:202`, `gaps.ts:181`
und `:241`, `curiosity.ts:186`, `continuity.ts:85`/`:109`, `context.ts:137`.
**Ergebnis:** Der Fragewortfilter wurde bewusst **nicht** in `contentTokens` eingebaut,
sondern nur in der privaten `contentTokenPairs`, die ausschliesslich von `topicOf` und
`topicsOf` benutzt wird. Damit bleiben alle sechs Stellen bitgleich:
`contentTokens("Wer bin ich?")` enthält weiterhin „wer“, die Frage gilt nicht als
inhaltslos. Keine dieser Stellen wurde geändert, keine Refaktorierung.
Bestätigt durch grüne Tests in `orb-context`, `orb-curiosity`, Kontinuität/Lücken.

## 9. Prüfung der „wohnt“-Lücke

Relevant und behoben: „Wo wohne ich?“ ↔ „Der Nutzer **wohnt** in Leipzig.“ scheiterte mit
dem vorbereiteten Muster (nur `wohne|wohnst|lebe|lebst`). Das Muster enthält jetzt
zusätzlich `wohnt|wohnen|lebt|leben|zuhause`. Gemessen: 0.000 → 0.120, Erinnerung wird
gefunden. Keine neue Keyword-/NLP-Maschinerie – nur diese Wortliste.

## 10. Teststatus

- Zieltests (Abruf, Erinnerung, Qualität, Themen, Kontext, Neugier, P15): **137 grün**.
- Typprüfung `tsgo --noEmit`: **fehlerfrei**.
- Lint `src/orb-core/memory.ts`, `src/orb-core/recall.ts`, neuer Test: **sauber**.
- DB-/Sicherheitstests: **102 grün**.
- Volle Logik-Suite: **1405 grün, 10 rot** – ausschliesslich in
  `tests/orb-dev-sandbox-execution.test.ts` und `tests/orb-dev-rollout-execution.test.ts`.

**Befund zu den 10 roten Tests (unerwartet, nicht eigenständig erweitert):**
Diese Phase-3/4-Tests verwenden den Fehlerfall `ORB-DIAG-MEMORY-RECALL-AGE` als
Vorlage: `diagnoseMemoryRecallCase()` muss `ROOT_CAUSE_PROVEN` liefern, damit ein
Fix-Vorschlag erzeugt, in der Testumgebung angewendet und ausgerollt werden kann.
Da P15 genau diesen Fehler behebt, meldet die Diagnose korrekt
`ROOT_CAUSE_PLAUSIBLE` – der Vorschlag wird verweigert und die Vorlage fällt weg.
**Das ist kein Produktionsfehler und keine Regression der ORB-Logik**, sondern eine
Kopplung der Reparaturstrecken-Tests an den nun behobenen Fall. Die Behebung (Umstellung
dieser Tests auf einen noch offenen Diagnosefall bzw. Ausmusterung des vorbereiteten
Patch-Textes `src/orb-dev/fixes/memory-recall-age.patch.ts`) liegt **ausserhalb des
P15-Auftrags**: nicht durchgeführt, **wartet auf menschliche Freigabe**.

## 11. Risiken

- **R1 (offen, siehe Abschnitt 10):** Reparaturstrecken-Tests ohne gültige Fallvorlage.
- **R2:** `alter` greift auf das kurze Wort „alt“; steht es in einem anderen
  Zusammenhang („alter Rechner“), wird der Bereich `alter` erkannt. Wirkung begrenzt:
  nur die Untergrenze 0.12 und nur, wenn Frage **und** Erinnerung denselben Bereich
  haben; der harte Filter und die Relevanzformel bleiben unverändert. Bestehende
  Bereiche haben Vorrang (Reihenfolge).
- **R3:** Themen gespeicherter Knoten ändern sich nicht rückwirkend; neue Knoten erhalten
  genauere Themen. Keine Migration, bewusst geduldete Inkonsistenz.
- **R4:** DB-Operationen pro Nachricht unverändert (die Themenabfrage lief bereits, nur
  mit nutzlosem Thema); P6-/P9-Stand unberührt.
- **R5:** Alle weiteren Wissensgebiete (Familie, Haustiere, Sprache, Musik) bleiben ohne
  Bereich – unverändert offen, nicht Teil dieses Fixes.

## 12. Rollback

Zwei Quelldateien und eine Testdatei, kein Schema, keine Daten, keine Migration:
`DOMAIN_PATTERNS` um die zwei Einträge kürzen, `QUESTION_WORDS` samt der einen Bedingung
in `contentTokenPairs` entfernen, Testdatei löschen. Rücknahme über die vorhandene
Reparaturstrecke mit unveränderlichem Fingerabdruck und Testumgebung möglich.

**STOPP.** Kein Deployment, keine Veröffentlichung, keine weitere Optimierung.
Offen und freigabepflichtig: der Befund aus Abschnitt 10.
