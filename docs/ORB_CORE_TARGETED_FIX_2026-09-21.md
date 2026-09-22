# ORB CORE – TARGETED BUG FIX 01

**Datum:** 2026-09-21
**Modus:** CONTROLLED REPAIR · keine neuen Fähigkeiten · keine Architekturerweiterung · **kein Deployment**
**Umfang:** genau drei nachgewiesene Problemgruppen (Impulse/Energy, Topic-Klassifizierung, Autonomous Observability)

---

## 1. AUSGANGSBEFUNDE

| # | Befund | Klassifikation | Quelle |
|---|--------|----------------|--------|
| 1 | `decideImpulse()` prüft keine Energie; ein Impuls `SPEAK` überstimmt eine Curiosity-`WAIT`-Entscheidung, die wegen `energy < CURIOSITY_MIN_ENERGY (0.15)` entstand. Produktionsbeweis: drei gestellte autonome Fragen bei Energy 0.0895 / 0.0898 / 0.0 | A – ECHTER LOGIKFEHLER | CODE + RUNTIME (Produktionsdaten `orb_messages.state_snapshot`) |
| 2 | Topic-Zuordnung liefert reproduzierbar falsche Themen. Zwei getrennte Mechanismen: **A)** bidirektionaler Präfixvergleich `t.startsWith(k) \|\| k.startsWith(t)` („wand“ → reisen), **B)** zu kurze/mehrdeutige Keywords, die im Vorwärtsvergleich greifen („rechn“ → hardware, „band“ → musik). 15 Fälle reproduziert | A – ECHTER DETERMINISTISCHER FEHLKLASSIFIZIERUNGSFEHLER | CODE (Reproduktion mit dem echten `topicOf()`) |
| 3 | 26 serverseitige + 10 clientseitige stille Abbruchstellen (36); keine hinterlässt eine Spur. Ein autonomer Versuch kann intern stattfinden, abgelehnt werden und danach nicht rekonstruierbar sein | B – OBSERVABILITY-PROBLEM | CODE |

Nicht als Bug behandelt (unverändert): die Herkunft erfolgreicher autonomer Fragen (Klasse D – aus `orb_messages.state_snapshot.impulse` + `question_id` rekonstruierbar, 13 von 13 Produktionsfragen eindeutig zuordenbar). **Es wurde deshalb kein neues `source`-Feld in der Datenbank eingeführt.**

---

## 2. FIX A – IMPULSE ENERGY

**ROOT CAUSE:** In `askProactively()` wurden Curiosity- und Impulse-Zweig getrennt ausgewertet. Die Energieprüfung lag ausschliesslich in `decideCuriosity()`. Existierte ein Impuls, wurde die Curiosity-Entscheidung gar nicht mehr geprüft – die Energiegrenze war damit umgehbar.

**CHANGE:**
- **Neu:** `src/orb-core/autonomy.ts` – reine Logik, keine Datenbank, kein Netzwerk.
  - `AUTONOMY_MIN_ENERGY = CURIOSITY_MIN_ENERGY` (0.15) – **keine neue Schwelle**, die bestehende wird weiterverwendet.
  - `finalAutonomyGate({ energy, curiosity, impulse })` prüft in fester Reihenfolge: `suppressed` → `no_candidate` → `energy` → `pass`. Ergebnis: `{ allowed, gate, action, reason, source }`.
- **Geändert:** `src/orb-core/engine.server.ts`, Funktion `askProactively()` – die Freigabe wird **nach** der Kandidatenberechnung und **vor** `formulateQuestion()` aufgerufen. Curiosity-Ergebnis, Impuls-Ergebnis, Score, Reason, Gap und Impuls-Metadaten bleiben vollständig erhalten.

**VORHER:** Energy 0.09 + Curiosity `WAIT` (Energie) + Impulse `SPEAK` → Frage wurde formuliert, gespeichert, gesendet, Energie um 0.03 reduziert.
**NACHHER:** dieselbe Lage → `action: "WAIT"`, `gate: "energy"`, keine Formulierung, kein `orb_questions`-Eintrag, keine `orb_messages`-Zeile, kein `orb_state`-Update, kein `orb_metrics`-Eintrag, **keine Energiekosten**. Energy ≥ 0.15 + Impulse `SPEAK` verhält sich unverändert.

**TEST:** `tests/orb-autonomy-gate.test.ts` (16 Fälle), u. a. A1 (Energie-WAIT schlägt Impuls-SPEAK), A1b (Energy 0), A2 (≥ 0.15 spricht weiter), A3 (Curiosity ASK ohne Energie → WAIT), A4 (Reihenfolgevertrag: Gate vor Formulierung und vor jeder Persistenz; der Abzug `energy - 0.03` existiert genau einmal und nur im Erfolgspfad).
**RESULT:** 16/16 grün.

---

## 3. FIX B – TOPIC-KLASSIFIZIERUNG

**ROOT CAUSE (zwei Mechanismen):**
- **B-A** `k.startsWith(t)`: der kurze Stamm „wand“ wurde als Präfix des Keywords „wander“ akzeptiert → reisen.
- **B-B** Vorwärtsvergleich mit zu kurzen Keywords: „rechnung“ beginnt mit „rechn“ → hardware; „bandage“, „bandbreite“, „bandscheibe“, „bandnudeln“, „bandana“ beginnen mit „band“ → musik; „reis“/„reisszwecke“ → reisen.

**CHANGE:** nur `src/orb-core/memory.ts`. `startsWith()` bleibt erhalten, wird aber begrenzt:
- `contentTokenPairs()` liefert je Wort `{ word, stem }` – der Vergleich kennt jetzt auch das geschriebene Wort.
- `matchesKeyword()`: exakter Stamm-Treffer gilt immer (ausser bei mehrdeutigen Keywords); sonst Präfixtreffer nur, wenn das Keyword mindestens `TOPIC_MIN_PREFIX = 4` Zeichen hat **und** der Rest maximal `TOPIC_MAX_SUFFIX = 2` Zeichen beträgt (echte Beugung statt Zufallsüberschneidung).
- `AMBIGUOUS_TOPIC_KEYWORDS = { "reis" }`: greift nur über das geschriebene Wort, ein exakter Stamm „reis“ bleibt neutral.
- Die Rückwärtsrichtung (`k.startsWith(t)`) entfällt damit als Treffergrund; die Fallback-Logik (erstes Inhaltswort) ist unverändert.
- **Kein LLM** – die Zuordnung bleibt vollständig deterministisch.

**VORHER / NACHHER (Auszug):** „Wand“ reisen → neutral · „Rechnung“ hardware → neutral · „Bandage“ musik → neutral · „Reis“ reisen → neutral · „Spielzeugauto“ gaming → neutral · „Waldbrand“ natur → neutral. Erhalten: „wandern“, „reise“, „Urlaub“, „Flug“, „Hotel“, „Berge“, „Strand“ → reisen; „Band“, „Musik“, „Album“ → musik; „Rechner“, „Grafikkarte“, „GPU“, „RTX 5070“, „Radeon“ → hardware; „Konsole“ → gaming; „Pizza“ → essen.

**TEST:** `tests/orb-topic-classification.test.ts` (22 Fälle): alle 15 bekannten Fehlzuordnungen als Regression (jeweils korrektes Thema **oder** neutral), gültige Reisen-/Musik-/Hardware-Begriffe, unbekannte Begriffe bleiben neutral. Bestehende Topic-Tests in `tests/orb-memory.test.ts` und `tests/orb-memory-recall-fix.test.ts` unverändert grün.
**RESULT:** 22/22 grün.

---

## 4. FIX C – AUTONOMOUS OBSERVABILITY

**ROOT CAUSE:** Jede Ablehnung verliess `askProactively()` über eine eigene `return`-Anweisung ohne Datensatz und ohne Protokolleintrag. Nichts unterschied „nie geprüft“ von „geprüft und abgelehnt“.

**CHANGE (minimal-invasiv, keine neue Datenbankstruktur):**
- `OrbAutonomyAttempt` in `src/orb-core/autonomy.ts`: `at`, `result` (`asked` | `silent`), `curiosityAction`, `impulseAction`, `gate`, `reason`, `energy`, `curiosity`, `score`, `source`, `duplicate`, `topic`.
- `src/orb-core/engine.server.ts`: `OrbProactiveResult` enthält `attempt: OrbAutonomyAttempt | null`. Ein zentraler `silent(reason, over?)`-Helfer erzeugt den Datensatz, schreibt **genau eine** Zeile `console.info("[orb.autonomy]", …)` pro echtem Serverversuch und gibt ihn zurück; der Erfolgspfad erzeugt denselben Datensatz mit `result: "asked"`, `gate: "pass"`. Sonderfälle mit eigenem Gate: `formulation` (Sprachschicht nicht verfügbar) und `duplicate` (Frage schon gestellt).
- `src/integrations/y-dude-orb/use-orb-presence.ts`: `filterLog` (max. `PRESENCE_FILTER_LOG_MAX = 20` Einträge, nur Arbeitsspeicher) hält fest, welcher Browser-Vorfilter einen Serveraufruf verhindert hat. `appendFilterEntry()` schreibt **nur bei Wechsel des Grundes** – kein Eintrag je 5-Sekunden-Takt, kein Log-Sturm.
- `source` wird ausschliesslich gesetzt, wenn der Entscheidungsweg sie eindeutig ergibt (`impulse` bei Impuls-SPEAK, sonst `curiosity`); die bestehende Rekonstruierbarkeit über `state_snapshot.impulse` bleibt unverändert erhalten.

**TEST:** `tests/orb-autonomy-gate.test.ts`, Abschnitt C: Attempt-Datensatz für Curiosity WAIT / DO_NOTHING, Impulse STAY_SILENT / SPEAK, Suppression, offene Frage, Cooldown, Energy Gate, Score Gate, Duplicate Gate, LLM-Ausfall, Erfolgsfall; Vertragsprüfung, dass der Ablehnungspfad keine der vier Tabellen berührt; Browser-Vorfilter-Verlauf (Entprellung und Obergrenze).
**RESULT:** grün.

---

## 5. EXAKT GEÄNDERTE DATEIEN

| Datei | Art | Inhalt |
|-------|-----|--------|
| `src/orb-core/autonomy.ts` | **neu** | `AUTONOMY_MIN_ENERGY`, `finalAutonomyGate()`, `OrbAutonomyAttempt`, Gate-Typen |
| `src/orb-core/memory.ts` | geändert | `TOPIC_MIN_PREFIX`, `TOPIC_MAX_SUFFIX`, `AMBIGUOUS_TOPIC_KEYWORDS`, `contentTokenPairs()`, `matchesKeyword()`, `topicOf()`, `topicsOf()` |
| `src/orb-core/engine.server.ts` | geändert | `OrbProactiveResult.attempt`; in `askProactively()`: Gate-Aufruf, `attemptOf()`, `silent()`, Gates `formulation`/`duplicate`, Attempt im Erfolgspfad |
| `src/integrations/y-dude-orb/use-orb-presence.ts` | geändert | `PresenceFilterEntry`, `PRESENCE_FILTER_LOG_MAX`, `appendFilterEntry()`, `filterLog` im Rückgabewert |
| `tests/orb-autonomy-gate.test.ts` | **neu** | 16 Tests (Fix A + Fix C) |
| `tests/orb-topic-classification.test.ts` | **neu** | 22 Tests (Fix B) |

Keine Datenbankmigration, kein Schemaeingriff, keine RLS-Änderung, kein Deployment.

---

## 6. TESTRESULTATE

| Lauf | Ergebnis |
|------|----------|
| Neue Tests (`orb-autonomy-gate`, `orb-topic-classification`) | 38/38 grün |
| Vollständige Logik-Suite (`bunx vitest run`) | **1133/1133 grün**, 73 Dateien (vorher 1095 – 38 neue) |
| DB-/Security-Suite (`vitest.integration.config.ts`) | **77/77 grün**, inkl. `db-orb-security` (RLS, Rechte, 0..1-Grenzen) |
| Typecheck (`bunx tsgo --noEmit`) | 0 Fehler |
| Lint (geänderte Dateien) | 0 Fehler |
| Build | `build OK` |

---

## 7. MÖGLICHE NEBENWIRKUNGEN

1. **Weniger autonome Fragen bei niedriger Energie** – beabsichtigt: Energie wirkt nun als gemeinsame Ressource. Bisher „gelungene“ Impulse unter 0.15 entfallen.
2. **Themenzuordnung wird strenger** – vormals falsch als reisen/musik/hardware abgelegte Inhalte landen künftig neutral. Bereits gespeicherte Altknoten behalten ihr falsches Thema; es wurde **nichts** in der Datenbank verändert oder gelöscht.
3. **`OrbProactiveResult` hat ein neues Feld** (`attempt`, nullbar). Additive Änderung an der SDK-Grenze; bestehende Leser bleiben funktionsfähig.
4. **Zusätzliche Protokollzeilen** – genau eine pro echtem Serverversuch, nicht pro Takt.
5. `filterLog` lebt nur im Arbeitsspeicher des Browsers und ist nach einem Neuladen leer.

---

## 8. VERBLEIBENDE OFFENE PUNKTE

- Der Attempt-Datensatz ist nachvollziehbar (Rückgabewert + Serverprotokoll), aber **nicht dauerhaft gespeichert**. Eine dauerhafte Spur bräuchte eine neue Tabelle – bewusst nicht umgesetzt (keine neue Datenbankstruktur ohne Freigabe).
- Die vier Schreibschritte des Erfolgspfads (`orb_questions` → `orb_messages` → `orb_state` → `orb_metrics`) laufen weiterhin ohne gemeinsame Transaktion. Unverändert, ausserhalb dieses Auftrags.
- Historische Falschthemen in bestehenden Knoten sind nicht korrigiert (keine Datenmigration).
- Kein Deployment. Die Produktionsfreigabe steht ausdrücklich noch aus.

---

## 9. OUT OF SCOPE – ZUSÄTZLICHE BEFUNDE (nur dokumentiert, NICHT repariert)

1. **Reihenfolgeabhängigkeit von `topicOf()`**: bei mehreren Treffern entscheidet die Reihenfolge der Keyword-Liste, nicht die Trefferstärke. Beispiel: „Ich spiele Gitarre“ → `gaming` (über „spiel“), obwohl `musik` ebenfalls zutrifft; `topicsOf()` enthält beide. Vorbestehendes Verhalten, unverändert.
2. **`hasCandidate: true` im Browser-Takt** (`use-orb-presence.ts`): der Browser kennt keinen Kandidaten und nimmt ihn an; die echte Prüfung erfolgt serverseitig. Führt zu Serveraufrufen, die sicher still enden. Unverändert.
3. Zwei bekannte Sicherheitswarnungen ausserhalb des ORB-Bereichs (`moderation_actions.internal_note`, `reports.review_note`) bestehen weiter.
