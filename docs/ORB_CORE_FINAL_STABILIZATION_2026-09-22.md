# ORB CORE – FINAL STABILIZATION & REPAIR PASS

**Datum:** 2026-09-22
**Modus:** CONTROLLED IMPLEMENTATION · KEINE NEUEN FEATURES
**Deployment:** KEIN Production Deployment. Status am Ende: READY FOR MANUAL REVIEW.

Primärquellen: aktueller Quellcode, aktueller Datenbankstand (Produktionslesezugriff),
vorhandene Tests, Produktionsbelege, die Audits vom 2026-09-21 und 2026-09-22.
Frühere Formulierungen wurden nicht als Beweis verwendet.

---

## 1. Ausgangsbefunde

| Nr | Befund | Klassifikation | Quelle |
|----|--------|----------------|--------|
| 1 | Impulse-Zweig prüfte die Energy-Schwelle nicht und konnte Curiosity-WAIT überstimmen | ECHTER LOGIKFEHLER | CODE + RUNTIME-BEWIESEN (Produktion: Energy 0.0895 / 0.0898 / 0.0) |
| 2 | Topic-Klassifizierung erzeugte reproduzierbare Fehlzuordnungen (wand→reisen, rechn→hardware, band→musik + 12 weitere) | ECHTER DETERMINISTISCHER FEHLER | CODE-BEWIESEN, reproduziert |
| 3 | 26 serverseitige Ablehnungspunkte + 10 clientseitige Nicht-Ausführungsstellen = 36, keine hinterließ eine Spur | OBSERVABILITY-PROBLEM | CODE-BEWIESEN |
| 4 | K5: vier Persistenzschritte ohne Transaktion – Abbruch nach `orb_questions` hinterlässt eine unsichtbare, blockierende offene Frage | ECHTER KONSISTENZFEHLER im Fehlerpfad | CODE-BEWIESEN (Consistency Audit Kap. 11) |

Die Reparaturen 1–3 wurden im Targeted Fix 01 (2026-09-21) implementiert; dieser Durchlauf
hat sie gegen die Primärquellen verifiziert und die verbliebenen Punkte ergänzt.

---

## 2. Tatsächlich reparierte Probleme

### Reparatur 1 – IMPULSE ENERGY

**ROOT CAUSE:** `decideImpulse()` besitzt kein Energy-Feld; in `askProactively()` wurde die
Curiosity-Entscheidung nur dann als WAIT ausgewertet, wenn kein Impuls vorlag. Ein Impuls
umging damit die Energiesperre.

**FIX:** Ein gemeinsames finales Gate `finalAutonomyGate({ energy, curiosity, impulse })` in
`src/orb-core/autonomy.ts` (`AUTONOMY_MIN_ENERGY = CURIOSITY_MIN_ENERGY = 0.15`), aufgerufen in
`askProactively()` **vor** `formulateQuestion()`. Reihenfolge: suppressed → no_candidate →
energy → pass. Curiosity- und Impulse-Logik selbst unverändert; Curiosity-Result, Impulse-Result,
score, reason, gap und Impulse-Metadaten bleiben erhalten.

**REGRESSION TEST:** `tests/orb-autonomy-gate.test.ts` – A1 (Curiosity WAIT wegen Energy +
Impulse SPEAK → FINAL WAIT), A1b (Energy 0), A2 (Energy ≥ 0.15 + Impulse SPEAK → SPEAK bleibt
möglich), A3 (Energy < 0.15 + Curiosity ASK + Impulse SILENT → WAIT), A4 (Gate liegt vor
Formulierung und vor jeder Persistenz – Quellordnungsprüfung).

**RESULT:** 19/19 grün. Kein LLM-Aufruf, kein `orb_questions`-, kein `orb_messages`-INSERT,
kein Energy- und kein Curiosity-Verbrauch bei einer nicht gestellten Frage.

### Reparatur 2 – TOPIC CLASSIFICATION

**ROOT CAUSE:** Zwei getrennte Mechanismen, nicht einer:
A) bidirektionaler Präfixvergleich `t.startsWith(k) || k.startsWith(t)` – nur hierdurch
entstand `wand → reisen` (Stamm kürzer als Keyword `wander`);
B) zu kurze/mehrdeutige Keywords – `rechn → hardware` und `band → musik` entstanden in der
Vorwärtsrichtung.

**FIX (kleinste deterministische Änderung, `src/orb-core/memory.ts`):** `TOPIC_MIN_PREFIX = 4`,
`TOPIC_MAX_SUFFIX = 2`, Sonderliste `AMBIGUOUS_TOPIC_KEYWORDS` und die zentrale Prüfung
`matchesKeyword()`. Kein LLM, kein Umbau des Memory-Systems, `startsWith()` bleibt erhalten.

**REGRESSION TEST:** `tests/orb-topic-classification.test.ts` – alle 15 bekannten
Fehlzuordnungen, gültige Begriffe aus reisen, hardware, musik, gaming, essen sowie neu
programmierung, ki und sport, dazu unbekannte/mehrdeutige Begriffe.

**RESULT:** 25/25 grün. Jeder bekannte Fehlfall liefert nun das korrekte Topic oder neutral.
Dokumentierte bestehende Verhaltensweisen (keine Fehler): „Ich spiele Gitarre“ trifft zuerst
`gaming` (`topicsOf` enthält weiterhin `musik`); „neuronal“ trifft das Keyword „neural“
bewusst nicht und bleibt neutral – neutral statt falsch ist die gewünschte Richtung.

### Reparatur 3 – AUTONOMOUS OBSERVABILITY

**ROOT CAUSE:** Ablehnungen verließen `askProactively()` über einen stillen Rückgabepfad ohne
jeden Nachweis; Browser-Vorfilter verhinderten den Serveraufruf spurlos.

**FIX:** Bestehende Struktur erweitert, kein Parallelsystem.
- `OrbAutonomyAttempt` in `src/orb-core/autonomy.ts`: `at`, neu `side: "server"`, `result`,
  `gate`, `reason`, `energy`, `curiosityAction`, `impulseAction`, `score`, `topic`, `duplicate`.
- `askProactively()`: `attemptOf()`-Builder, `silent(reason, over?)` und der Erfolgspfad
  erzeugen je **tatsächlichem Serverversuch genau einen** Attempt-Record plus genau eine
  `[orb.autonomy]`-Logzeile. Kein Takt-Logging, keine Chatnachricht, keine neue Tabelle.
- `OrbProactiveResult.attempt` gibt den Record an den Aufrufer zurück.
- Browser: `PresenceFilterEntry` (`at`, neu `side: "client"`, `reason`, `idleMs`),
  `appendFilterEntry()` schreibt nur bei **Änderung** des Grundes, `PRESENCE_FILTER_LOG_MAX = 20`.

**REGRESSION TEST:** `tests/orb-autonomy-gate.test.ts` – Attempt-Records für Curiosity WAIT /
DO_NOTHING, Impulse SILENT / SPEAK, Suppression, Open Question, Cooldown, Energy Gate, Score
Gate, Duplicate, LLM-Fehler, erfolgreiche autonome Frage; zusätzlich Dedupe und Obergrenze des
Browser-Filterlogs sowie `side=server` / `side=client`.

**RESULT:** grün. Server-Ablehnung und Browser-Vorfilter bleiben über `side` klar getrennt.

### Reparatur 4 – PERSISTENZ-KOMPENSATION (K5, kleinste notwendige Reparatur)

**ROOT CAUSE:** Schlägt der `orb_messages`-INSERT nach erfolgreichem `orb_questions`-INSERT fehl,
bleibt eine offene Frage ohne sichtbare Nachricht zurück und blockiert künftige autonome Fragen
unsichtbar.

**FIX:** In `askProactively()` löscht der Fehlerpfad die gerade angelegte Frage
(`orb_questions.delete().eq("id", …).eq("user_id", …)`) und meldet danach den Fehler. Kein
Transaktionsumbau, keine Änderung der Reihenfolge der vier erfolgreichen Schritte.

**REGRESSION TEST:** `tests/orb-autonomy-gate.test.ts` – „ein fehlgeschlagener orb_messages
INSERT entfernt die zuvor angelegte Frage“ (Reihenfolge Cleanup vor `throw`).

**RESULT:** grün.

---

## 3. Nicht reparierte Befunde + Begründung

| Befund | Begründung |
|--------|------------|
| K1 – Reason `no_candidate` vor `energy` kann bei Impulswunsch irreführend sein | Nur der Grund, nicht die Aktion ist betroffen; Aktion ist korrekt WAIT. Kosmetik, kein Fehler. |
| K2 – Impulse-Cooldown nutzt `lastImpulseAt: ctx.lastQuestionAt` | Funktional korrekt (gleicher Zeitanker); nur der Name überzeichnet. Umbenennung wäre Refactor. |
| K3 – Client `presence.noteProactive()` ohne Argumente, `asked`-Liste bleibt leer | Eine Reparatur bräuchte einen `dimension`-Wert, den das autonome Ergebnis nicht führt – das wäre neue Logik. Bewusst offen. |
| K4 – Client-Cooldown nur bei Erfolg | Änderung des autonomen Taktverhaltens = konzeptionelle Entscheidung, nicht bestätigter Fehler. |
| K6 – Fallback-Topics („warum“, „korrekt“, „erzähle“) tragen echte Fragen | Vom Topic-Fix nicht abgedeckt; Behebung erfordert inhaltliche Entscheidung über die Fallback-Liste. |
| K7 – `orb_metrics`-INSERT ohne Fehlerprüfung | Rein metrisch, blockiert keine Frage und verfälscht keinen Zustand. |
| K8 – Duplicate-Check nach LLM-Formulierung | Absichtliche Designentscheidung (Textvergleich benötigt den Text). |
| K9 – Recovery-Cap 0.25 nur 0.10 über Schwelle 0.15 | Designfolge; laut Auftrag bleiben 0.02/min, Cap 0.25 und Minimum 0.15 unverändert. |
| Energy-Zeitanker / `orb_state.updated_at` | Der Consistency Audit weist hier keinen offenen Fehler nach (Fix vom 2026-09-21 wirksam). Keine Änderung. |
| Transaktionen über alle vier Schreibschritte | Über die Kompensation hinaus nicht notwendig; kein Umbau „aus Schönheit“. |
| End-to-End-Test Browser → Persistenz | Neuer Testtyp mit Infrastrukturbedarf; nicht Teil dieses Durchlaufs. |

**Widerlegte frühere Befunde – bewusst NICHT repariert:** Die Herkunft erfolgreicher autonomer
Fragen ist über `orb_messages.state_snapshot.impulse` + `question_id` rekonstruierbar (15 von 15
Produktionsfragen eindeutig zuordenbar). Es wurde **kein** zusätzliches Source-Feld eingeführt;
die Rekonstruierbarkeit bleibt unverändert erhalten.

---

## 4. Geänderte Dateien (Diff-Kontrolle)

| DATEI | FUNKTION | ALT | NEU | GRUND | TEST |
|-------|----------|-----|-----|-------|------|
| `src/orb-core/autonomy.ts` | `OrbAutonomyAttempt` | ohne Seitenangabe | Feld `side: "server"` | Server/Client trennbar (Anforderung 4) | „Serverversuche sind als side=server gekennzeichnet“ |
| `src/orb-core/engine.server.ts` | `attemptOf()` | Record ohne `side` | `side: "server"` | s. o. | dito |
| `src/orb-core/engine.server.ts` | `askProactively()` Fehlerpfad | `if (msg.error) throw …` | Frage wird kompensierend gelöscht, dann `throw` | K5 – keine unsichtbare blockierende Frage | „fehlgeschlagener orb_messages INSERT entfernt die Frage“ |
| `src/integrations/y-dude-orb/use-orb-presence.ts` | `PresenceFilterEntry`, Filter-Append | ohne Seitenangabe | `side: "client"` | Gegenstück zur Serverkennzeichnung | „Browser-Vorfilter sind als side=client gekennzeichnet“ |
| `tests/orb-topic-classification.test.ts` | – | 22 Fälle | + programmierung / ki / sport, präzisierte Neutralerwartung | Pflichtfälle aus Anforderung 3 | selbst |
| `tests/orb-autonomy-gate.test.ts` | – | 16 Fälle | + 3 Fälle (Kompensation, side-Kennzeichnung) | Absicherung Reparatur 3/4 | selbst |

Bereits im Targeted Fix 01 geändert und hier nur verifiziert: `src/orb-core/autonomy.ts` (neu),
`src/orb-core/memory.ts` (Topic-Matching), `src/orb-core/engine.server.ts` (finales Gate,
Attempt-Records), `src/integrations/y-dude-orb/use-orb-presence.ts` (Filterlog).

**Außerhalb des Scopes geändert:** nichts. Keine Migration, keine SQL-Änderung, kein
Refactoring, keine neuen Features, keine UI-Änderung, kein Modellwechsel.

---

## 5./6. Testfälle und Testergebnisse

| Bereich | Fälle | Ergebnis |
|---------|-------|----------|
| Energy/Autonomy-Gate (`tests/orb-autonomy-gate.test.ts`) | 19 | grün |
| Topic-Klassifizierung (`tests/orb-topic-classification.test.ts`) | 25 | grün |
| Energy-Reset/Recovery (`tests/orb-energy-message-reset.test.ts`, Energy-Tests) | vollständig | grün |
| ORB Core, Memory, Curiosity, Impulse, Presence, Recall, SDK Contract | vollständig | grün |

## 7. Regressionsergebnisse

- Logik-Suite: **1137 Tests in 73 Dateien – alle grün**
- DB/Security-Suite: **77 Tests in 9 Dateien – alle grün**
- Kein Test entfernt, kein Test abgeschwächt. Der einzige zwischenzeitliche Fehlschlag war eine
  falsche neue Testerwartung („neuronal“ → ki); Root Cause geprüft: das Verhalten des Codes ist
  korrekt, die Erwartung wurde berichtigt.

## 8. Build / Typecheck / Lint

- Typecheck (`tsgo --noEmit`): 0 Fehler
- Lint (eslint auf allen geänderten Dateien): 0 Fehler, 0 Warnungen
- Build: erfolgreich

## 9. Verbleibende Risiken

1. Fallback-Topics können weiterhin inhaltlich schwache autonome Fragen tragen (K6).
2. Abgelehnte Versuche sind nur im Prozesslog/Rückgabewert nachvollziehbar, nicht dauerhaft
   persistiert – bewusst, um keine neue öffentliche Datenstruktur einzuführen.
3. Der Recovery-Cap 0.25 liegt nur 0.10 über der autonomen Schwelle 0.15; autonome Fragen
   bleiben dadurch selten.
4. Kein End-to-End-Test von Browser bis Persistenz; die Kette ist nur über Produktionsdaten belegt.
5. Der Fehlerpfad ist kompensiert, aber nicht transaktional: ein Abbruch nach `orb_messages`
   belässt Nachricht und Frage konsistent, ohne State-Update.

## 10. Finale Architekturübersicht (tatsächlich vorhandene Komponenten)

```text
Browser  use-orb-presence.ts
         Vorfilter (10 Stellen) -> PresenceFilterEntry{side:"client"} (max 20, nur bei Änderung)
              | verdict.ask
              v
Server   orb.functions.ts -> engine.server.ts askProactively()
         Kontext laden (loadCuriosityContext)
              v
         decideCuriosity()            decideImpulse()
              \                          /
               v                        v
              finalAutonomyGate()  (autonomy.ts)
              suppressed -> no_candidate -> energy(0.15) -> pass
                 |                                   |
            silent(reason)                      formulateQuestion()  (LLM: nur WIE)
            Attempt{side:"server"}                   v
            keine Persistenz                    Duplicate-Check
                                                     v
                                     1 orb_questions  ->  2 orb_messages
                                        (Fehler: Frage wird kompensierend gelöscht)
                                                     v
                                     3 orb_state (curiosity -0.06, energy -0.03)
                                                     v
                                     4 orb_metrics    ->  Attempt{result:"asked"}
```

Energy: `recoverEnergy()` in `core.ts`, 0.02/min, Cap 0.25, `clamp01`, Zeitanker
`orb_state.updated_at`; unverändert.

---

## STATUS

**READY FOR MANUAL REVIEW** – kein Deployment durchgeführt, keine Migration, keine
Produktionsdaten verändert.
