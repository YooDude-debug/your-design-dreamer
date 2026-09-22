# ORB CORE – "ORB DENKT …" OHNE AUTONOME FRAGE · FORENSIC

Datum: 2026-09-22 · Modus: **READ-ONLY** · 0 Codeänderungen · 0 SQL-Schreibzugriffe · 0 Migration · 0 Deployment

Klassifikation: **CODE-BEWIESEN**, **DB-BEWIESEN**, **RUNTIME-BEWIESEN** (erfasste Telemetrie des laufenden Chats), **WAHRSCHEINLICH**, **OFFEN**.

---

## 1. Ausgangslage

Beobachtung: Im Chat erscheint „ORB denkt nach …", danach folgt keine autonome Frage. Untersucht wird, warum die Anzeige startet, warum anschliessend manchmal keine Frage entsteht und an welcher Stelle der Ablauf endet.

Wichtiger Rahmen: Der Stabilization-Stand (finales Energy-Gate, Attempt-Nachweise, Kompensation) ist im Arbeitsstand vorhanden, aber **nicht veröffentlicht**. Aussagen über die veröffentlichte Umgebung sind daher **OFFEN**; die Runtime-Belege dieses Berichts stammen aus der laufenden Vorschau, die den aktuellen Code ausführt.

---

## 2. Ursprung von „ORB denkt …"

- Datei/Komponente: `src/components/orb/OrbChat.tsx:163–165` — `{pending && (<Shimmer …>ORB denkt nach …</Shimmer>)}`.
- Zusätzlich als Statuszeile: `src/routes/_authenticated/channels.orb.tsx` (`orbActivity`) → „ORB denkt nach".
- Bedingung in beiden Fällen identisch: `pending = sendMutation.isPending || curiosityMutation.isPending` (`channels.orb.tsx`, `OrbChat`-Prop und `orbActivity`). **Es gibt keine weitere Bedingung** — kein eigener Thinking-State, kein Timer, kein Server-Signal. CODE-BEWIESEN.
- Folge: Die Anzeige erscheint für **jeden** autonomen Serverversuch, auch für einen, der anschliessend korrekt abgelehnt wird. Sie ist eine Anzeige der laufenden Anfrage, keine Zusage einer Frage.

Lifecycle (CODE-BEWIESEN):

```text
IDLE (5-s-Takt, shouldAskProactively)
  → verdict.ask === true → lastProactiveRef = now (Client-Sperre) → onAsk()
  → curiosityMutation.mutate() → isPending = true  → "ORB denkt nach …"
  → requestOrbCuriosity → askProactively() (Server)
  → Antwort (asked true|false)
  → onSuccess: setLastAutonomyAttempt(...)
       asked === false ODER question === null → return
       sonst: Snapshot setzen, Antwort anzeigen, noteProactive(), Sprachausgabe
  → isPending = false → Anzeige verschwindet
onError: console.error, isPending = false
```

Beginn = Mutationsstart, Ende = Auflösung der Anfrage (Erfolg **oder** Fehler). Kein Timeout, kein AbortController, keine Cancellation im gesamten Client-Pfad (`channels.orb.tsx`, `orb.functions.ts` — geprüft, nur ein unbeteiligter `setTimeout` für das Gesichtsreset). CODE-BEWIESEN.

---

## 3. Client-Lifecycle – Forensik

| Prüfpunkt | Befund | Klasse |
|---|---|---|
| fetch/Request | Server-Funktion über `useServerFn`, React-Query-Mutation | CODE |
| AbortController / Timeout / Cancellation | existiert nicht | CODE |
| Component unmount | Mutation wird nicht abgebrochen; `isPending` verschwindet mit der Komponente | CODE |
| Stale State | `setLastAutonomyAttempt` ist unbedingt, auch bei `asked=false` | CODE |
| Response Parsing | typisiertes Ergebnis, kein manuelles Parsen | CODE |
| `asked === false` | `setLastAutonomyAttempt(...)` wird **vorher** ausgeführt, danach `return` | CODE |
| Error Handling | `onError: console.error` – bewusst still, keine Toast-Meldung | CODE |
| Swallowed Exceptions | nur diese eine Stelle; sie beendet `isPending` regulär | CODE |
| UI-State-Reset | React Query setzt `isPending` in beiden Ausgängen zurück | CODE |

Antwort auf die Kernfrage „Was passiert bei `asked = false`?": Der Attempt wird im Client-State festgehalten (nur im Testbereich sichtbar), die Anzeige endet, **es erscheint bewusst kein Hinweis im Chat**. Das ist der dokumentierte Entwurf („keine Chatnachricht für interne Ablehnungen"), nicht ein Fehler. CODE-BEWIESEN.

Browser-Vorfilter: `use-orb-presence.ts` setzt die Client-Sperre `lastProactiveRef.current = now` **beim Auslösen**, nicht erst bei Erfolg (Zeile im Takt-Block vor `onAsk()`). Damit entsteht pro Cooldown-Fenster höchstens ein Versuch. **KORREKTUR** gegenüber Befund K4 des Consistency Audits („Cooldown nur bei Erfolg") — im aktuellen Code trifft das nicht zu. CODE-BEWIESEN.

---

## 4. Server-Lifecycle (`askProactively`, `engine.server.ts:2208–2425`)

| Stufe | Input | Gate | Mögliche Resultate | Nächster Schritt |
|---|---|---|---|---|
| Kontext | `loadCuriosityContext()` (State, 12 Knoten, Nachrichten, Fragen, Lücken) | – | Kontext | Curiosity |
| Curiosity | curiosity, energy, gaps, lastQuestionAt, openQuestion | 9 Gates in `decideCuriosity()`; Energie < 0.15 → `WAIT` | ASK / WAIT / DO_NOTHING | Impulse |
| Impulse | detectedGaps, recentUserTexts, previousImpulses, openQuestion | `readUserControl()`, Priorität, Duplikate, Cooldown | SPEAK / STAY_SILENT (+ `suppressed`) | Merge |
| Merge/Final Gate | energy, curiosity-Entscheidung, impulse-Entscheidung | `finalAutonomyGate()`: 1. suppressed 2. no_candidate 3. energy < 0.15 4. pass | allowed true/false + gate + source | bei false: `silent(reason)` |
| Formulierung | ctx, gap, impulse | `formulateQuestion()` – **nur bei allowed** | ok / nicht ok | bei nicht ok: `silent(…, gate "formulation")` |
| Duplikat | formulierte Frage vs. frühere Fragen | `isDuplicateQuestion()` (0.6) | Duplikat / neu | bei Duplikat: `silent(…, gate "duplicate")` |
| Persistenz | Frage + Nachricht + State + Metrik | 1. `orb_questions` 2. `orb_messages` (Fehler → Kompensation: Löschen der Frage, dann Rethrow) 3. `orb_state` (−0.06 curiosity, −0.03 energy) 4. `orb_metrics` | asked | Antwort |
| Antwort | – | – | `{asked, action, reason, question, topic, kind, score, snapshot, perf, attempt}` | Client |

Jeder tatsächliche Serverversuch erzeugt genau einen Attempt-Datensatz und genau eine Logzeile `[orb.autonomy]`. CODE-BEWIESEN.

---

## 5. Alle „keine Frage"-Pfade (repository-weit geprüft)

**Browser-Vorfilter (kein Serveraufruf, kein Attempt):** `shouldAskProactively()` — Leerlauf zu kurz, Neugier zu gering (< 0.5 Vertrauen/Gewicht), Tippen, Sprechen, Zuhören, laufende Anfrage (`pending`), Tab nicht sichtbar, Cooldown je Neugier-Band, `hasCandidate`, Snapshot nicht geladen (`enabled`). Nachvollziehbar nur im `filterLog` im Arbeitsspeicher.

**Serverseitige Ablehnungen (Attempt vorhanden):**
1. `suppressed` — Nutzer hat laut `readUserControl()` abgewinkt.
2. `no_candidate` — weder Impuls-Kandidat noch Curiosity-Lücke (umfasst Curiosity `WAIT`/`DO_NOTHING` aus allen 9 Untergründen: keine Lücke, Neugier zu gering, offene Frage, Cooldown, Score < 0.2, Energie < 0.15 …).
3. `energy` — Energie < `AUTONOMY_MIN_ENERGY` 0.15, auch bei Impulse SPEAK.
4. `formulation` — Sprachschicht liefert keinen Text.
5. `duplicate` — semantisches Duplikat einer früheren eigenen Frage.
6. Ausnahme beim Schreiben (`orb_questions`/`orb_messages`/`orb_state`) → geworfener Fehler → Client `onError`, kein Attempt-Datensatz.

Die Liste ist nicht als vollständig behauptet: der Consistency Audit hat mit fester Zählregel 26 serverseitige und 10 clientseitige Abbruchstellen benannt; hier sind sie zu 6 Server-Ausgängen und 10 Vorfiltern zusammengefasst.

---

## 6. Observability-Auswertung (reale Versuche)

Erfasste Runtime-Belege aus der Vorschau-Telemetrie (`network-requests.log`, 27 Anfragen):

| Zeitpunkt | Aufruf | result | gate | reason | energy | curiosity | score | curiosityAction | impulseAction |
|---|---|---|---|---|---|---|---|---|---|
| 2026-09-22T07:09:40.127Z | `requestOrbCuriosity` | silent | **suppressed** | „Der Nutzer möchte dieses Thema gerade nicht vertiefen." | 0.0507 | 1.00 | 0.855 | WAIT | STAY_SILENT |
| kurz davor | `inspectOrbCuriosity` (nur Einblick) | – | – | „Zu wenig Energie – ORB wartet." | 0.0456 | 1.00 | 0.855 | WAIT | – |

Beide Fälle: **Attempt vorhanden → keine Frage**, UI regulär beendet. RUNTIME-BEWIESEN.

„Attempt vorhanden → Frage" ist in dieser Telemetrie **nicht** enthalten; die letzte tatsächlich gestellte autonome Frage datiert auf 2026-09-21 11:48:03 (DB-BEWIESEN). Weitere Attempts aus früheren Sitzungen sind nicht auswertbar, weil Attempt-Datensätze nur als Antwortfeld und als Logzeile existieren und **nicht persistiert** werden → Observability-Lücke.

---

## 7. Vergleich: Frage entstanden vs. keine Frage

FALL A = letzte tatsächliche autonome Frage (DB, 2026-09-21 11:48:03, Thema `faktisch`, Impuls, score 0.2198, energy 0.0895 — vor dem Energy-Gate entstanden).
FALL B = erfasster Versuch 2026-09-22 07:09:40.

| Stage | A: Frage entstanden | B: keine Frage |
|---|---|---|
| Request | `requestOrbCuriosity` | `requestOrbCuriosity` |
| Curiosity | WAIT (Energie 0.0895 < 0.15) | WAIT |
| Impulse | SPEAK (Priorität P1) | STAY_SILENT, `suppressed = true` |
| Final Gate | **existierte noch nicht** – Impuls hatte Vorrang | **suppressed** → abgelehnt |
| Score | 0.2198 | 0.855 (Kandidat vorhanden, Wert unkritisch) |
| Duplicate | nicht erreicht → geprüft nach LLM, bestanden | nicht erreicht |
| LLM | aufgerufen, Frage formuliert | **nicht aufgerufen** |
| Persistence | 4 Schritte vollständig (Frage, Nachricht, State, Metrik) | nichts geschrieben |
| Response | `asked = true` | `asked = false`, `action = WAIT` |
| UI | Frage erscheint, Sprachausgabe, Cooldown | Anzeige endet ohne Ausgabe |

**Erster Unterschied:** die Impulse-Entscheidung bzw. das unmittelbar folgende finale Gate. Danach unterscheidet sich alles. Bemerkenswert: Fall A wäre mit dem heutigen Code am Energy-Gate gescheitert (0.0895 < 0.15) — er ist ein Beleg des behobenen Fehlers, nicht ein Gegenbeispiel.

---

## 8. Energy-Gate-Verhalten

- `AUTONOMY_MIN_ENERGY = CURIOSITY_MIN_ENERGY = 0.15`; Prüfung in `finalAutonomyGate()` an Position 3, **vor** `formulateQuestion()` und vor jedem Schreibvorgang. CODE-BEWIESEN.
- Bei Ablehnung: kein LLM-Aufruf, kein `orb_questions`-INSERT, kein `orb_messages`-INSERT, kein Energie-, kein Neugier-Verbrauch — der einzige Code-Pfad, der Energie abzieht, liegt nach der Persistenz der Frage. CODE-BEWIESEN, zusätzlich TEST-BEWIESEN (`tests/orb-autonomy-gate.test.ts`, Fälle A1/A1b/A2/A3/A4).
- Laufzeitlage: gespeicherte Energie 0.0714 (Stand 2026-09-22 07:10:42), Neugier 1.00. Seit 2026-09-21 11:48 keine autonome Frage (DB-BEWIESEN). Die Energie liegt dauerhaft unter 0.15, während die Erholung bei 0.02/min auf 0.25 begrenzt ist und jeder Nutzerturn Energie kostet.
- Bewertung gemäss Auftrag: Erscheint „ORB denkt …" in solchen Fällen, ist das **kein Fehler**, sondern ein korrekt abgelehnter Versuch — und er wird korrekt abgeschlossen (Anzeige endet, Attempt vorhanden).

---

## 9. LLM-Verhalten

- `formulateQuestion()` wird ausschliesslich nach `if (!gateDecision.allowed) return silent(...)` aufgerufen. WAIT / STAY_SILENT / suppressed / no_candidate / energy erreichen das Modell nie. CODE-BEWIESEN.
- Leere oder fehlerhafte Antwort (`spoken.status !== "ok" || !spoken.question`) → `silent(…, gate "formulation")`, kein Schreibvorgang.
- Ungültige Frage im Sinne eines Duplikats → `silent(…, gate "duplicate")` nach dem Modellaufruf (bekannter Kostenpunkt K8, unverändert).
- Timeout/Exception: die Provider-Schicht liefert einen Fehlerstatus; eine geworfene Ausnahme erreicht `onError` im Client.
- Gateway-Belege: im Fenster 2026-09-21T00:00Z – 2026-09-22T07:13Z **0 fehlerhafte** Anfragen bei 247 Gesamtanfragen; die zuletzt erfassten Aufrufe (z. B. `log_id 01a0c7f2-4920-7503-986d-5ee22b118a90`, 2026-09-22T07:09:02Z, `openai/gpt-6-astra`, http 200) sind durchweg erfolgreich. Payloads `redacted` — Inhalte nicht einsehbar. → **LLM-Failure als Ursache NICHT BESTÄTIGT.**

---

## 10. Persistenz

- Erfolgreiche Frage: 12 proaktive Nachrichten, 12 `orb_questions`, 12 `orb_metrics` mit `kind = 'proactive'` für den Hauptnutzer — die Zählungen stimmen exakt überein, also kein halb geschriebener Fall im Bestand. DB-BEWIESEN.
- Abgelehnter Versuch: kein Datensatz in einer der vier Tabellen (kein Schreibpfad vor dem Gate). CODE-BEWIESEN.
- Kompensation nach Teilerfolg: Fehler beim `orb_messages`-INSERT löscht die eben erzeugte `orb_questions`-Zeile und wirft danach. Die Gleichheit 12 = 12 ist damit vereinbar; ein reales Auslösen der Kompensation ist im Bestand **nicht** nachweisbar (auch nicht widerlegt) → OFFEN.
- `orb_metrics`-INSERT bleibt ohne Fehlerprüfung (bekannter Punkt K7, unverändert).

---

## 11. Race / Timeout / Abort

| Prüfung | Befund | Status |
|---|---|---|
| Mehrere autonome Anfragen gleichzeitig | Client sperrt vor dem Aufruf (`lastProactiveRef = now`) und `pending` blockiert den Takt | NICHT BESTÄTIGT |
| Cooldown-Race | Serverseitiger Cooldown prüft `lastQuestionAt` erneut | NICHT BESTÄTIGT |
| Duplicate-Race | Prüfung im selben Aufruf gegen geladene Fragen; zwei parallele Aufrufe wären nötig, siehe oben | NICHT BESTÄTIGT |
| Stale `isPending` | React Query löst in beiden Ausgängen auf | NICHT BESTÄTIGT |
| Mehrere Tabs | jeder Tab hat eigene Sperre; ein zweiter Tab könnte parallel auslösen — serverseitig greifen Cooldown und offene Frage | WAHRSCHEINLICH möglich, nicht beobachtet |
| Request-Overlap / Antwort nach neuer Anfrage | keine Abbruchlogik, aber auch keine Reihenfolgeabhängigkeit; `setLastAutonomyAttempt` überschreibt nur die Anzeige | NICHT BESTÄTIGT |
| Abort | existiert nicht | – |
| Component Remount | Anzeige endet mit der Komponente | NICHT BESTÄTIGT |

---

## 12. Production Evidence

| Kennzahl | Wert | Quelle |
|---|---|---|
| Autonome Fragen gesamt (Hauptnutzer) | 12 | `orb_questions` |
| Davon seit 2026-09-22 00:00 UTC | 0 | `orb_questions` |
| Proaktive Nachrichten | 12 | `orb_messages.state_snapshot->>'proactive'` |
| Metriken `kind = 'proactive'` | 12 | `orb_metrics` |
| Letzte autonome Frage | 2026-09-21 11:48:03 UTC | `orb_questions`/`orb_messages` |
| Energie (gespeichert) | 0.0714, `updated_at` 2026-09-22 07:10:42 | `orb_state` |
| Erfasste Server-Attempts | **1** (07:09:40, silent/suppressed) | Vorschau-Telemetrie |
| LLM-Fehler seit 2026-09-21 | 0 von 247 | AI-Gateway-Protokoll |
| Persistence-Fehler | keiner nachweisbar | Zählgleichheit 12/12/12 |
| Client-/UI-Fehler | keiner erfasst (`runtime-errors.log` ohne Eintrag zu diesem Pfad) | Telemetrie |
| Attempts ohne sauberes Ende | 0 erfasst | Telemetrie |

**Nicht verfügbar:** die Gesamtzahl aller Versuche (SPEAK/WAIT/SILENT/Duplicate/Energy) über die Zeit. Attempt-Datensätze werden nicht persistiert; ausgewertet werden konnte nur, was in der aktuellen Telemetrie liegt. Es werden hier keine Zahlen geschätzt.

---

## 13. Root Cause

**Primär: A) KEIN BUG** für die beobachteten Fälle — ORB entscheidet korrekt gegen eine Frage und beendet den Versuch sauber. Typ 1 (WAIT) und Typ 2 (REJECT) aus der Typologie, beide RUNTIME-BEWIESEN.

Zusätzlich bestätigt:

**B-nah) Zu weit gefasste Unterdrückungsregel — echter Logikfehler, RUNTIME-BEWIESEN.**
`DECLINE_RE` in `src/orb-core/impulse.ts:87–88` enthält die Alternative `später|spaeter` ohne Wortgrenze und ohne Absichtsprüfung. Die reale Nutzernachricht „auch. haben wir **später** frieden beschlossen ?" (2026-09-22 07:08:01, DB-BEWIESEN) löst `preference = "suppress"` aus; ein Nachvollzug mit der echten Funktion über die letzten 12 Nutzertexte liefert genau diesen Treffer und damit `reason = "Der Nutzer möchte dieses Thema gerade nicht vertiefen."` — identisch zum erfassten Attempt 07:09:40. Damit wird ORB durch eine harmlose Frage für das gesamte Nachrichtenfenster stumm geschaltet. Weitere Alternativen mit gleichem Risiko: `egal`, `unwichtig`, `immer` (in `PERMANENT_RE`), `weiss nicht`.

**A-nah) Dauerhaft niedrige Energie als zweite, eigenständige Stummschaltung — DB-BEWIESEN.**
Energie 0.0456–0.0714 gegen Schwelle 0.15, Erholung 0.02/min mit Obergrenze 0.25 bei laufender Nutzung: seit über 19 Stunden keine autonome Frage, obwohl Neugier bei 1.00 und Score 0.855 liegt. Kein Fehler im Sinne falscher Logik (K9, Designfolge), aber die dominante Ursache der Stille.

**H) OBSERVABILITY GAP — BESTÄTIGT.** Attempts existieren nur als Antwortfeld und Konsolenzeile. Ohne gerade erfasste Telemetrie ist ein vergangener Versuch nicht rekonstruierbar; eine Häufigkeitsaussage über Ablehnungsgründe ist nicht möglich.

**Nicht bestätigt:** C) Client Request Bug, D) UI State Bug, E) LLM Failure, F) Persistence Failure, G) Timeout/Cancellation.
**Fallabdeckung §9 des Auftrags:** A CONFIRMED · B NOT CONFIRMED · C UNKNOWN (kein erfasster Fall ohne Attempt; nicht ausschliessbar) · D NOT CONFIRMED · E NOT CONFIRMED · F NOT CONFIRMED.

---

## 14. Beweise

1. `OrbChat.tsx:163–165` + `channels.orb.tsx` (`pending`, `orbActivity`) — Anzeige hängt allein an `isPending`.
2. `channels.orb.tsx` `curiosityMutation.onSuccess` — `setLastAutonomyAttempt(...)`, danach `if (!result.asked || !result.question) return;`.
3. `autonomy.ts:52–80` — Gate-Reihenfolge suppressed → no_candidate → energy → pass, Schwelle 0.15.
4. `engine.server.ts:2245–2310` — Gate vor `formulateQuestion()`, `silent()` mit Attempt und einer Logzeile.
5. `engine.server.ts:2324–2372` — vier Persistenzschritte inklusive Kompensation.
6. `impulse.ts:87–88, 101–107` + `engine.server.ts:2075` — `DECLINE_RE` gegen alle Nutzertexte des Nachrichtenfensters.
7. Nutzernachricht 2026-09-22 07:08:01 „… haben wir später frieden beschlossen ?" (DB) und Nachvollzug mit `readUserControl()` → `suppress`.
8. Erfasster Attempt 2026-09-22T07:09:40.127Z mit `gate: "suppressed"`, `energy: 0.0507`.
9. `orb_state`: Energie 0.0714; `orb_questions`: letzte Frage 2026-09-21 11:48:03; Zählungen 12/12/12.
10. AI-Gateway: 0 Fehler bei 247 Anfragen seit 2026-09-21 (`log_id 01a0c7f2-4920-7503-986d-5ee22b118a90`, 2026-09-22T07:09:02Z, http 200).
11. `tests/orb-autonomy-gate.test.ts` — Gate vor Formulierung und Persistenz, keine Nebenwirkung bei Ablehnung.

---

## 15. Möglicher Minimal-Fix (nicht ausgeführt)

| Befund | Betroffen | Auslöser | Auswirkung | Minimaler möglicher Fix |
|---|---|---|---|---|
| Unterdrückung zu weit gefasst | `src/orb-core/impulse.ts` `DECLINE_RE` / `readUserControl()` | Wörter wie „später", „egal", „immer" in harmlosen Sätzen | ORB verstummt für das gesamte Nachrichtenfenster; Grund wirkt inhaltlich falsch | Wortgrenzen ergänzen und die Alternativen auf ablehnende Wendungen einschränken (z. B. „später" nur in Verbindung mit „frag/frage") — reine Regeländerung, keine neue Logik, plus Regressionstests mit den echten Sätzen |
| Reason-Vorrang | `src/orb-core/autonomy.ts` | mehrere Gates gleichzeitig zutreffend | Begründung nennt „suppressed", obwohl die Energie ebenfalls sperrt | zusätzliche Nebengründe im Attempt mitführen, Entscheidung unverändert (K1) |
| Attempts nicht persistiert | Observability | jede Ablehnung | keine Häufigkeitsanalyse möglich | Attempts gezielt und begrenzt festhalten — bewusst offen gelassen, erfordert eigene Freigabe |
| Energie dauerhaft unter der Schwelle | `core.ts` (Cap 0.25 / 0.02 pro Minute) vs. 0.15 | normale Nutzung | ORB fragt über Stunden nicht | keine Codeänderung ohne Entscheidung: es ist eine Schwellen-/Designfrage (K9), ausdrücklich ausserhalb dieses Berichts |

Es wurde nichts davon umgesetzt.

---

## 16. Verbleibende Unsicherheiten

1. Ein Versuch **ohne** Attempt (Fall C) ist nicht beobachtet und mangels Persistenz nicht ausschliessbar → UNKNOWN.
2. Häufigkeitsverteilung der Ablehnungsgründe über die Zeit nicht ermittelbar (keine Persistenz) → OFFEN.
3. Die veröffentlichte Umgebung führt den Stabilization-Stand nicht aus; alle Runtime-Belege stammen aus der Vorschau → OFFEN für Produktion.
4. Mehrere gleichzeitig offene Tabs als Quelle paralleler Versuche: theoretisch möglich, nicht beobachtet → WAHRSCHEINLICH.
5. Ob die Kompensation nach Teilerfolg jemals ausgelöst hat, ist nicht nachweisbar → OFFEN.
6. Gateway-Payloads sind `redacted`; Inhalte der Modellaufrufe konnten nicht geprüft werden.

---

**READY FOR FIX DESIGN** – die Ursachenlage ist belegt: Die Anzeige „ORB denkt nach …" gehört zur laufenden Anfrage und endet korrekt; die beobachtete Stille entsteht aus zwei belegten Ursachen (zu weit gefasste Unterdrückungsregel, dauerhaft zu niedrige Energie). Verändert wurde nichts: 0 Codeänderungen, 0 Tests, 0 SQL-Schreibzugriffe, 0 Migrationen, 0 Deployment.
