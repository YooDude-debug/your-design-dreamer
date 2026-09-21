# ORB CORE – CAUSALITY EVIDENCE MAP

**Datum:** 2026-09-21 · **Modus:** READ-ONLY (keine Code-, DB-, Test-, Konfigurations- oder Deployment-Änderung)
**Zweck:** Minimaler Beweissatz, mit dem ORB die im `ORB_CORE_FORENSIC_MASTER_REPORT_2026-09-21.md` als
**KAUSAL BEWIESEN** markierten Ketten selbstständig gegen die Primärimplementierung prüfen (oder widerlegen) kann.

## 0. Beweisregeln

- Der Forensic Master Report ist **keine Primärquelle**. Er ist ausschließlich die zu prüfende Behauptung.
- Primärbeweise: (1) Quellcode, (2) Datenbankschema/Trigger/RPC, (3) Tests, (4) konkrete Laufzeit-/DB-Daten.
- Evidenzarten je Kette:
  - **CODE-CAUSALITY** – Ursache→Wirkung ist im Quellcode deterministisch nachvollziehbar.
  - **DB-CAUSALITY** – benötigt Schema/Trigger/RPC-Verhalten der Datenbank.
  - **RUNTIME-CAUSALITY** – benötigt tatsächliche Laufzeitwerte (Produktionsdatensätze, Zeitstempel).
  - **TEST-CAUSALITY** – ein ausführbarer Test reproduziert die Kette deterministisch.
- „Notwendige Kombination" nennt das Minimum. Zusätzliche Evidenz ist erlaubt, aber nicht erforderlich.

## 0.1 Minimaler Gesamt-Dateisatz (Union über A–I)

Quellcode (6 Dateien):

| Datei | Warum nötig |
|---|---|
| `src/orb-core/core.ts` | `recoverEnergy`, `nextState`, `clamp01`, Energie-Konstanten |
| `src/orb-core/engine.server.ts` (nur 3 Ausschnitte, s. u.) | Lesen/Berechnen/Persistieren von `orb_state` |
| `src/orb-core/curiosity.ts` | Gates der eigenen Fragen inkl. Energieschwelle |
| `src/orb-core/presence.ts` | Idle-/Cooldown-Gates |
| `src/orb-core/memory.ts` | `TOPIC_KEYWORDS`, `topicOf`, Relevanz/Recall |
| `src/routes/_authenticated/channels.orb.tsx` (nur Zeilen 220–265) | UI-Abschluss des Denk-Zustands |

Tests (6 Dateien): `tests/orb-energy-recovery.test.ts`, `tests/orb-energy-message-reset.test.ts`,
`tests/orb-curiosity.test.ts`, `tests/orb-presence.test.ts`, `tests/orb-memory.test.ts`,
`tests/orb-memory-recall-fix.test.ts`.

DB (nur Metadaten, keine Inhalte): Triggerliste auf `orb_*`, Definition von `public.set_updated_at()`,
Spalten von `orb_state`, `orb_questions`, `orb_messages`, `orb_nodes`.

Laufzeit-Evidenz (4 Abfragen, siehe Anhang A).

Nicht nötig: LLM-Provider, Voice, Feed, Messenger, Market, Translation, Graph-UI, Remotion, alle
Backups unter `.lovable/backup/` und `backups/`.

---

## A) Energy-Zeitanker / Energy-Reset

1. **Kausalkette:** Schreibvorgang auf `orb_state` → Trigger setzt `updated_at = now()` → `recoverEnergy` rechnet ab `updated_at` → Ruhezeit = 0 → gespeicherter (niedriger) Energiewert bleibt niedrig → Nachrichtenkosten auf nicht erholten Wert → Anzeige 0.
2. **Behauptete Ursache:** `orb_state`-Updates ohne Spalte `energy` (Snapshot-Schreibvorgang, Lernereignis) verschieben den Zeitanker.
3. **Behauptete Wirkung:** Sichtbare Energie fällt sofort auf 0, obwohl kein Energieverbrauch stattfand.
4. **Primärdateien:** `src/orb-core/engine.server.ts`, `src/orb-core/core.ts`
5. **Funktionen:** `toState` (Z. 258–268), `ensureState` (Z. 272 ff.), Snapshot-Schreibvorgang (Z. ~410–420, `energy: toState(stateRow).energy` in Z. 417), Lern-Schreibvorgang (Z. ~1730–1742, Z. 1739), `processInput`-Persistenz (Z. 1500); `recoverEnergy` (core.ts Z. 165–170), `clamp01` (Z. 57), `nextState` (Z. 188).
6. **Konstanten:** `ENERGY_RECOVERY_PER_MIN = 0.02`, `ENERGY_RECOVERY_CAP = 0.25` (core.ts Z. 152/154); Nachrichtenkosten `-0.03 - 0.04 * importance` (core.ts Z. 188).
7. **DB-Trigger/RPC:** Trigger `orb_state_updated_at` auf `public.orb_state` → Funktion `public.set_updated_at()`. Kein RPC beteiligt. **Es gibt keine eigene Spalte für den Zeitanker** – `updated_at` IST der Anker.
8. **Testdateien:** `tests/orb-energy-message-reset.test.ts` (6 Fälle, u. a. Vertragstest: jeder `orb_state`-Update-Block im Kern schreibt auch `energy`), `tests/orb-energy-recovery.test.ts`.
9. **Laufzeit-/DB-Evidenz:** `orb_state.energy` + `updated_at` desselben Nutzers vor/nach einer Nachricht; Energie-Snapshots in `orb_messages` (belegte Reihe 0.00696 → 0.19096 → 0.18070 → 0.21162 am 21.09.).
10. **Kleinster Codeausschnitt:** core.ts Z. 150–172 + Z. 180–190; engine.server.ts Z. 255–285, Z. 405–420, Z. 1490–1505, Z. 1730–1742; Triggerliste + `set_updated_at()`-Definition.
11. **Beweisbar:** dass der Zeitanker ausschließlich `updated_at` ist; dass ein Update ohne `energy` die Ruhezeit nullt; dass die heutige Fassung bei beiden Schreibpfaden den erholten Wert mitschreibt.
12. **Nicht beweisbar:** dass es in der Vergangenheit keine weiteren Schreibpfade gab (dazu bräuchte es Historie); dass kein anderer Dienst außerhalb des Kerns `orb_state` schreibt (nur per Repository-weiter Suche prüfbar, nicht aus diesem Satz).
- **CODE-CAUSALITY:** ja · **DB-CAUSALITY:** ja (zwingend, Trigger) · **RUNTIME-CAUSALITY:** bestätigend · **TEST-CAUSALITY:** ja
- **Notwendige Kombination:** CODE + DB + TEST. RUNTIME nur zur Live-Bestätigung.

---

## B) Energy < 0.15 → WAIT

1. **Kausalkette:** berechnete Energie < Schwelle → Gate liefert `WAIT` → keine eigene Frage.
2. **Ursache:** Energie unter `CURIOSITY_MIN_ENERGY`.
3. **Wirkung:** Entscheidung `WAIT` mit Begründung „Zu wenig Energie – ORB wartet."
4. **Primärdatei:** `src/orb-core/curiosity.ts`
5. **Funktion:** Entscheidungsfunktion mit Gate-Reihenfolge, Z. 244–303 (Energie-Gate Z. 285–287).
6. **Konstanten:** `CURIOSITY_MIN_ENERGY = 0.15` (Z. 150), `CURIOSITY_ASK_THRESHOLD = 0.2` (Z. 147), `IMPULSE_MIN_SCORE = 0.2` (`impulse.ts` Z. 58).
7. **DB:** keine.
8. **Tests:** `tests/orb-curiosity.test.ts`, `tests/orb-energy-recovery.test.ts` (Fall „0.149 nicht / 0.150 möglich").
9. **Runtime:** nicht erforderlich (reine Funktion).
10. **Ausschnitt:** curiosity.ts Z. 140–160 + Z. 244–303.
11. **Beweisbar:** exakte Schwelle, Reihenfolge der Gates, Determinismus ohne DB/LLM.
12. **Nicht beweisbar:** dass der Aufrufer den berechneten (erholten) statt gespeicherten Wert übergibt – das gehört zu A.
- **CODE:** ja · **DB:** nein · **RUNTIME:** nein · **TEST:** ja
- **Notwendige Kombination:** CODE + TEST.

---

## C) Energy Recovery +0.02/min, Cap 0.25

1. **Kausalkette:** verstrichene Zeit seit `updated_at` → `+0.02` je Minute → gedeckelt bei `0.25`.
2. **Ursache:** vergangene Ruhezeit (Zeitdifferenz), nicht Aufruf-/Renderhäufigkeit.
3. **Wirkung:** monotone Erholung bis zur Obergrenze.
4. **Primärdatei:** `src/orb-core/core.ts`
5. **Funktion:** `recoverEnergy(stored, updatedAtMs, nowMs)` Z. 165–170; Anwendung in `toState` (engine.server.ts Z. 267).
6. **Konstanten:** `ENERGY_RECOVERY_PER_MIN = 0.02`, `ENERGY_RECOVERY_CAP = 0.25`.
7. **DB:** `updated_at` als Zeitquelle (Trigger, siehe A).
8. **Tests:** `tests/orb-energy-recovery.test.ts` (Rate, Cap, Monotonie, Aufrufunabhängigkeit, negative Zeitdifferenzen, Parameterschutz).
9. **Runtime:** zwei Messungen desselben `orb_state`-Datensatzes mit Zeitabstand; Snapshot-Reihe in `orb_messages`.
10. **Ausschnitt:** core.ts Z. 150–172; engine.server.ts Z. 258–268.
11. **Beweisbar:** Rate, Deckel, Zeit- statt Aufrufabhängigkeit.
12. **Nicht beweisbar:** ob der Zeitanker im Betrieb korrekt bleibt (→ A); ob ein Hintergrundjob existiert (es gibt keinen – nachweisbar nur durch Suche über das gesamte Repository).
- **CODE:** ja · **DB:** ja (Zeitanker) · **RUNTIME:** bestätigend · **TEST:** ja
- **Notwendige Kombination:** CODE + TEST; DB nur für den Anker.

---

## D) LISTEN ist nicht Ursache der autonomen Blockade

1. **Kausalkette (Gegenbeweis):** „Zuhören" ist ein Gesprächsmodus für die Antwortformulierung; der autonome Weg liest diesen Modus nicht → er kann ihn nicht blockieren.
2. **Behauptete Ursache:** nicht LISTEN, sondern die Gates in `curiosity.ts`/`presence.ts`.
3. **Wirkung:** Ausbleiben eigener Fragen wird durch Idle/Cooldown/Energie/Score erklärt.
4. **Primärdateien:** `src/orb-core/conversation.ts` (Modus „listen"), `src/orb-core/curiosity.ts`, `src/orb-core/presence.ts`, `src/orb-core/engine.server.ts` (Z. 2199–2363, `askProactively`).
5. **Funktionen:** Modusplanung in `conversation.ts`; `shouldAskProactively` (presence.ts Z. 102–125); Curiosity-Gate; `askProactively`.
6. **Konstanten:** `PROACTIVE_MIN_IDLE_MS = 40_000`, `PROACTIVE_MAX_IDLE_MS = 900_000`, `PROACTIVE_COOLDOWN_MS` (presence.ts Z. 24/30/55).
7. **DB:** keine.
8. **Tests:** `tests/orb-presence.test.ts`, `tests/orb-conversation-decision.test.ts`.
9. **Runtime:** nicht erforderlich.
10. **Ausschnitt:** presence.ts Z. 20–130; engine.server.ts Z. 2199–2363; plus Suchnachweis, dass im autonomen Pfad kein Bezug auf den Gesprächsmodus vorkommt.
11. **Beweisbar:** Abwesenheit einer Abhängigkeit (negativer Nachweis) innerhalb dieser Dateien.
12. **Nicht beweisbar:** eine Abwesenheit im **gesamten** System – dafür ist eine repository-weite Suche nötig, nicht ein Dateiausschnitt. Ein Teilsatz kann Abwesenheit nie vollständig belegen.
- **CODE:** ja (mit Suchnachweis) · **DB:** nein · **RUNTIME:** nein · **TEST:** teilweise
- **Notwendige Kombination:** CODE (vollständiger Pfad) + repository-weiter Suchnachweis.

---

## E) wandern → Stamm „wand" → Schlüsselwort „wander" → Thema „reisen"

1. **Kausalkette:** Tokenisierung erzeugt Stamm; `topicOf` vergleicht **bidirektional** per `startsWith`; `keys` von `reisen` enthalten `wander`; daher Treffer und Thema `reisen`.
2. **Ursache:** bidirektionaler Präfixvergleich (`t.startsWith(k) || k.startsWith(t)`).
3. **Wirkung:** falsches Thema bereits **beim Speichern** der Erinnerung, nicht erst in der Sprachschicht.
4. **Primärdatei:** `src/orb-core/memory.ts`
5. **Funktionen:** `contentTokens`, `topicOf` (Z. 418–428), `topicsOf` (Z. 431 ff.).
6. **Konstanten:** `TOPIC_KEYWORDS` (Z. 342 ff.), insbesondere `reisen: [... "wander"]` (Z. 408).
7. **DB:** `orb_nodes.topic` (gespeichertes Ergebnis), `created_at` als Entstehungszeit.
8. **Tests:** `tests/orb-memory.test.ts` (Z. 80–82), `tests/orb-memory-recall-fix.test.ts` (Z. 31–41, Z. 92 nutzt genau den Satz „… war letzte Woche wandern.").
9. **Runtime:** Knoten `1dfb5e07-d518-42e3-b01d-7194b475e638` (`topic = reisen`, `created_at` 19.09.) und die zwei Fragen mit `topic = reisen` vom 21.09. 08:45:33 / 08:54:30.
10. **Ausschnitt:** memory.ts Z. 330–345 (Tokenisierung), Z. 400–430; ein einzeiliger Aufruf `topicOf("Der Nutzer war letzte Woche wandern.")` reicht zur Reproduktion.
11. **Beweisbar:** die vollständige Kette deterministisch und ohne LLM; Entstehungszeitpunkt beim Ingest.
12. **Nicht beweisbar:** dass **dieser** Produktionsknoten aus genau diesem Satz entstand (Originaltext unterliegt Inhaltszugriff); nur Thema + Zeitstempel sind belegt.
- **CODE:** ja · **DB:** ja (Thema/Zeitstempel des Knotens) · **RUNTIME:** ja (für den konkreten Fall) · **TEST:** ja
- **Notwendige Kombination:** CODE + TEST für den Mechanismus; DB + RUNTIME zusätzlich für den Einzelfall.

---

## F) Long-Term-Memory Retrieval

1. **Kausalkette:** gespeicherter Knoten → Abruf nach Gewicht × Wichtigkeit × Textähnlichkeit → Rangfolge → Aufnahme in den Antwortkontext.
2. **Ursache:** Relevanzberechnung über gespeicherte Knoten (nicht das Gesprächsfenster).
3. **Wirkung:** Bezug auf Inhalte früherer Tage.
4. **Primärdateien:** `src/orb-core/memory.ts`, `src/orb-core/recall.ts`, `src/orb-core/core.ts`, `src/orb-core/context.ts`
5. **Funktionen:** `memoryRelevance`, `similarity`, `topicOf`; `relevanceScore` (core.ts Z. 259), `currentWeight`/`recoverEnergy`-Analogon `currentWeight` (core.ts Z. 65–71); Abruf in `recall.ts`.
6. **Konstanten:** `W_MIN = 0.05`, `W_MAX = 1`, `STRONG_THRESHOLD = 0.5` (core.ts), Wichtigkeitsschwelle `0.35` (`shouldPersist`).
7. **DB:** Tabellen `orb_nodes`, `orb_connections` (+ deren `set_updated_at`-Trigger); keine RPC.
8. **Tests:** `tests/orb-memory.test.ts`, `tests/orb-memory-recall-fix.test.ts`, `tests/orb-memory-quality.test.ts`, `tests/orb-core.test.ts`.
9. **Runtime:** `orb_nodes`-Zeile mit `created_at` 19.09. und `activation_count`/`importance`; Frage vom 21.09. mit demselben Knotenbezug.
10. **Ausschnitt:** core.ts Z. 55–90 + Z. 255–262; memory.ts Relevanzblock ab Z. 440; recall.ts vollständig (klein).
11. **Beweisbar:** Rangfolge ist deterministisch und trennt Langzeitgedächtnis von Gesprächsfenster und Graph-Anzeige.
12. **Nicht beweisbar:** dass die Sprachschicht die abgerufene Erinnerung tatsächlich verwendet hat – das ist Modellverhalten, dafür braucht es Prompt-Protokolle, die nicht persistiert werden.
- **CODE:** ja · **DB:** ja (Existenz/Alter des Knotens) · **RUNTIME:** ja · **TEST:** ja
- **Notwendige Kombination:** CODE + TEST + DB. RUNTIME für den Einzelfall.

---

## G) Drei autonome Fragen über CURIOSITY (21.09. 08:45:33 / 08:54:30 / 09:00:01)

1. **Kausalkette:** Leerlauf → Server-Auswertung → Curiosity-Gate `ASK` → Formulierung → Dublettenprüfung → Persistenz in `orb_questions` und `orb_messages` (`proactive: true`).
2. **Ursache:** Curiosity-Zweig (nicht Impuls-Zweig).
3. **Wirkung:** drei persistierte, beantwortete eigene Fragen.
4. **Primärdateien:** `src/orb-core/engine.server.ts` (`askProactively`, Z. 2199–2363), `src/orb-core/curiosity.ts`, `src/orb-core/presence.ts`, `src/orb-core/impulse.ts`
5. **Funktionen:** `askProactively`, Curiosity-Entscheidung, `shouldAskProactively`, Impuls-Bewertung.
6. **Konstanten:** `CURIOSITY_ASK_THRESHOLD = 0.2`, `CURIOSITY_MIN_ENERGY = 0.15`, `QUESTION_DUPLICATE_SIMILARITY = 0.6`, `IMPULSE_MIN_SCORE = 0.2`.
7. **DB:** Tabellen `orb_questions` (Spalten `topic`, `kind`, `score`, `answered`, `created_at`), `orb_messages` (`proactive`); Trigger nur `set_updated_at`-Familie.
8. **Tests:** `tests/orb-curiosity.test.ts`, `tests/orb-proactive-impulse.test.ts`, `tests/orb-presence.test.ts`.
9. **Runtime (belegt):** `orb_questions` – 08:45:33 `reisen` 0.6424741708086891 · 08:54:30 `reisen` 0.680561 · 09:00:01 `hardware` 0.5994581904407817.
10. **Ausschnitt:** engine.server.ts Z. 2199–2363; curiosity.ts Z. 244–303; plus die drei DB-Zeilen.
11. **Beweisbar:** dass die Fragen existieren, welche Werte sie hatten und dass diese Werte über der Curiosity-Schwelle liegen.
12. **Nicht beweisbar:** dass **kein** Impuls beteiligt war – die Zweigherkunft wird nicht persistiert; das ist aus Code plausibel, aber nicht aus Daten belegt (Status: nicht kausal, nur beobachtet).
- **CODE:** ja · **DB:** ja · **RUNTIME:** ja (zwingend) · **TEST:** ja
- **Notwendige Kombination:** CODE + RUNTIME + DB. Für die Zweigherkunft: **derzeit nicht ausreichend**.

---

## H) „ORB denkt …" endet korrekt bei `asked = false`

1. **Kausalkette:** Denk-Anzeige = abgeleiteter Zustand der laufenden Anfrage (`isPending`) → Anfrage endet (Erfolg oder Fehler) → Anzeige endet; bei `asked = false` frühzeitiger Ausstieg ohne sichtbare Ausgabe.
2. **Ursache:** Ableitung aus dem Anfragezustand statt eigenem Schalter.
3. **Wirkung:** kein hängender Denk-Zustand; stattdessen absichtliches Schweigen.
4. **Primärdatei:** `src/routes/_authenticated/channels.orb.tsx` (Z. 220–265: Speicherung von `asked`/`reason` Z. 229–231, früher Ausstieg Z. 236, Ableitung `pending` Z. 262, Weitergabe Z. 553), `src/components/orb/OrbChat.tsx` (Anzeigetext), `src/integrations/y-dude-orb/use-orb-presence.ts` (5-s-Intervall).
5. **Funktionen:** Mutations-Callback des Neugier-Aufrufs, `pending`-Ableitung, Intervall-Beobachter.
6. **Konstanten:** Intervall 5 s; Zeitlimit der Sprachschicht (`AbortSignal.timeout` in `src/orb-core/llm/openai.server.ts` Z. 76).
7. **DB:** keine.
8. **Tests:** `tests/orb-presence-wait-fix.test.ts`, `tests/orb-chat-scroll.test.ts` (nur UI-Teilaspekte). **Es existiert kein Test, der das Ende des Denk-Zustands bei `asked = false` direkt prüft.**
9. **Runtime:** nur flüchtig – die Versuchsanzeige wird nicht persistiert.
10. **Ausschnitt:** channels.orb.tsx Z. 220–265; OrbChat.tsx-Abschnitt mit dem Denk-Text.
11. **Beweisbar:** dass es keinen separaten Schalter gibt, der offen bleiben könnte; dass `asked = false` ohne sichtbare Meldung endet.
12. **Nicht beweisbar:** dass in einem konkreten Live-Fall genau dieser Pfad lief – Versuche werden nicht gespeichert (OFFEN).
- **CODE:** ja · **DB:** nein · **RUNTIME:** nein (nicht persistiert) · **TEST:** Lücke
- **Notwendige Kombination:** CODE allein reicht für den Mechanismus; für Einzelfälle fehlt Persistenz.

---

## I) 24/25 stille Ablehnungspunkte

1. **Kausalkette:** Der autonome Weg hat viele Rückgabepunkte; nur einer erzeugt eine sichtbare Ausgabe.
2. **Ursache:** Gates geben Begründungen zurück, die nicht in die Anzeige und nicht in die Datenbank gelangen.
3. **Wirkung:** Ablehnungen sind von außen nicht unterscheidbar.
4. **Primärdateien:** `src/orb-core/curiosity.ts`, `src/orb-core/presence.ts`, `src/orb-core/impulse.ts`, `src/orb-core/engine.server.ts` (`askProactively`), `src/routes/_authenticated/channels.orb.tsx`
5. **Funktionen:** alle Gate-Funktionen mit frühzeitiger Rückgabe.
6. **Konstanten:** identisch zu B/G.
7. **DB:** relevant ist die **Abwesenheit** einer Tabelle/Spalte für Versuche (`orb_questions` enthält nur gestellte Fragen).
8. **Tests:** keiner zählt Rückgabepunkte.
9. **Runtime:** keine – genau das ist der Befund.
10. **Ausschnitt:** vollständige Gate-Abschnitte der vier Dateien (Zählung erfordert Vollständigkeit, nicht Ausschnitte). Messbare Teilzahlen im aktuellen Stand: 5 Ablehnungsrückgaben in `curiosity.ts`, 10 in `presence.ts`.
11. **Beweisbar:** dass Ablehnungen nicht persistiert werden und dass es je Datei mehrere stille Ausstiege gibt.
12. **Nicht beweisbar:** die exakte Zahl **24/25** aus einem minimalen Satz – eine Zählbehauptung ist nur gegen die vollständigen vier Dateien prüfbar und hängt von der Zählregel ab (Gate vs. Rückgabeanweisung). Status daher: Struktur bewiesen, Zahl OFFEN.
- **CODE:** ja (Struktur) · **DB:** ja (negativer Nachweis) · **RUNTIME:** nein · **TEST:** nein
- **Notwendige Kombination:** CODE (vollständige vier Dateien) + Zählregel. Ohne definierte Zählregel ist die Zahl nicht entscheidbar.

---

## Anhang A – Laufzeit-/DB-Abfragen für den Beweissatz (nur lesend)

1. Trigger-Nachweis:
   `select t.tgname, c.relname, p.proname from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_proc p on p.oid=t.tgfoid where c.relname like 'orb%' and not t.tgisinternal;`
   → belegt `orb_state_updated_at → set_updated_at` (A, C).
2. Definition: `select pg_get_functiondef(p.oid) from pg_proc p where p.proname='set_updated_at';` (A).
3. Energie-Zustand: `select energy, updated_at from orb_state;` – zweimal mit Zeitabstand (A, C).
4. Eigene Fragen: `select topic, kind, score, answered, created_at from orb_questions order by created_at desc limit 10;` (G, E).

Keine dieser Abfragen liest Nachrichteninhalte.

## Anhang B – Was ORB ausdrücklich **nicht** erhält und warum

| Bereich | Grund |
|---|---|
| LLM-Provider/Prompts (`src/orb-core/llm/*`) | Für A–I nicht kausal; Prompts werden nicht protokolliert, Selbstkorrektur ist Modellverhalten |
| Sprachein-/ausgabe, Feed, Messenger, Market, Translation, Graph-UI, Remotion | Keine der Ketten berührt sie |
| `.lovable/backup/*`, `backups/*`, `release/*` | Alte Kopien; würden widersprüchliche Belege erzeugen |
| Nachrichteninhalte aus `orb_messages`/`orb_nodes` | Für die Ketten genügen Thema, Kennzahl, Zeitstempel |

## Abschluss

Files changed in application: 0 · Database changes: 0 · Migrations: 0 · Deployments: 0 · Configuration changes: 0 · Tests changed: 0 · New documents: 1 (`docs/ORB_CAUSALITY_EVIDENCE_MAP_2026-09-21.md`)
