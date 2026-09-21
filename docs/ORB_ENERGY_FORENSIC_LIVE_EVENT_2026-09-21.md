# ORB Energy Forensic Live Event

Datum: 2026-09-21 · Umgebung: PRODUCTION · Modus: STRICT READ-ONLY
Es wurde nichts geändert: kein Code, keine Datenbank, keine Konfiguration, kein Deployment.
Nutzer: `9ce1d1b0-…67297` (einziger ORB-Testnutzer).

---

## 1. Observed Production Behavior

Beobachtung des Nutzers im mobilen Live-Test:

- Energie erreichte ca. 11–15 %.
- „ORB denkt …“ erschien.
- Es entstand am Ende keine eigene Frage.
- Energie fiel wieder auf ca. 1 %.
- Energie sinkt scheinbar bei jeder Chat-Aktivität – und auch ohne sichtbare Aktion.

Datenbank-Befund (read-only, 07:57 UTC):

| Feld | Wert |
| --- | --- |
| `energy` (gespeichert) | `0` |
| `curiosity` | `1` |
| `decay_computations` | `4539` |
| `updated_at` | `2026-09-21 07:57:40.545805+00` (76 s alt beim Abruf) |

Beide heutigen Chat-Runden zeigen im `state_snapshot` **energy = 0** und `decision = stay_silent`:

| Zeit (UTC) | Rolle | Entscheidung | energy im Snapshot |
| --- | --- | --- | --- |
| 07:44:26.701 | user | – | – |
| 07:44:26.702 | orb | `stay_silent` | 0 |
| 07:57:36.077 | user | – | – |
| 07:57:36.078 | orb | `stay_silent` | 0 |

Metriken: 2 × `turn`, 2 × `analysis`, **0 × `proactive`**, keine Zeile in `orb_questions` heute.

---

## 2. Energy Mutation Map

| # | SOURCE | FUNCTION | EVENT/TRIGGER | ENERGY DELTA | PERSISTENCE | UI UPDATE |
| --- | --- | --- | --- | --- | --- | --- |
| M1 | DB `orb_state` DEFAULT | Zeilenanlage | erster ORB-Besuch | = 0.8 (Init) | ja (INSERT) | über Snapshot |
| M2 | `src/orb-core/core.ts:167` | `recoverEnergy()` | jeder Lesevorgang des Zustands | `+0.02 × Δt_min`, Cap 0.25, nur bei `stored < 0.25` | **nein** (nur berechnet) | ja |
| M3 | `src/orb-core/engine.server.ts:258–268` | `toState()` | jeder Zustandsaufruf | wendet M2 an | nein | ja |
| M4 | `src/orb-core/core.ts:188` | `nextState()` | Benutzernachricht verarbeitet | `−0.03 − 0.04 × importance` (−0.03 … −0.07) | ja (M5) | ja |
| M5 | `engine.server.ts:1485–1498` | `processInput()` Zustands-Update | nach jeder Benutzernachricht | schreibt M4-Ergebnis | ja, **setzt `updated_at = now()`** | ja |
| M6 | `engine.server.ts:2313–2318` | `askProactively()` | **gestellte** eigene Frage | `−0.03` | ja, setzt `updated_at` | ja |
| M7 | `engine.server.ts:408–413` | `getSnapshot()` `decay_computations`-Zähler | **jeder Snapshot-Abruf** mit ≥1 Verbindung | **0** (Energie wird nicht geschrieben) | ja – **setzt `updated_at = now()`** → **setzt die Erholungsuhr M2 auf 0 zurück** | ja |
| M8 | `engine.server.ts:1726–1732` | `recordLearning()` | „Riss“ speichern | 0 (kein `energy`-Feld) | ja, setzt `updated_at` → wie M7 | ja |
| M9 | `avatar.ts:52/130`, `OrbFace.tsx:68`, `channels.orb.tsx:266` | Anzeige | Render | 0 | nein | ja |
| M10 | `prompt.server.ts:49` | Prompt-Text | LLM-Aufruf | 0 | nein | – |

Kein weiterer Schreibzugriff auf `orb_state` existiert: `rg 'from("orb_state")'` liefert genau die Stellen 273, 278, 411, 1487, 1726, 2313.

**Nur zwei echte Abzüge existieren: M4/M5 (−0.03 … −0.07 pro Benutzernachricht) und M6 (−0.03 pro gestellter Frage).** Beide sind Vorbestand; M6 ist exakt der freigegebene Wert 0.03.

---

## 3. Exact Deduction Sources

| Abzug | Datei | Funktion | Zeile | Betrag | Auslöser | ohne Benutzereingabe? | mehrfach pro Autonomie-Zyklus? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D1 | `src/orb-core/core.ts` | `nextState()` | 188 | `−0.03 − 0.04·importance` | Benutzernachricht (`processInput`) | nein | nein (1× pro Nachricht) |
| D2 | `src/orb-core/engine.server.ts` | `askProactively()` | 2316 | `−0.03` | **erfolgreich gestellte** eigene Frage | ja (Leerlauf-Beobachter) | nein – nur nach `insert` von Frage + Nachricht; jeder frühere Abbruch (`silent()`) schreibt nichts |
| D3 (indirekt) | `src/orb-core/engine.server.ts` | `getSnapshot()` | 408–413 | rechnerisch `−(bisherige Erholung)` | **jeder** Snapshot-Abruf | **ja** | **ja, unbegrenzt oft** |

D3 ist kein Abzug am gespeicherten Wert, sondern eine Rücksetzung des Zeitankers: die Zeile wird wegen `decay_computations` geschrieben, der Trigger `orb_state_updated_at` (`set_updated_at()`) setzt `updated_at = now()`, `energy` bleibt bei 0 → der nächste `recoverEnergy()`-Aufruf startet bei Δt ≈ 0.

---

## 4. Autonomous Cycle Reconstruction

Gefragte Punkte A–P:

| Fall | Pfad | Energie-Wirkung |
| --- | --- | --- |
| A Benutzernachricht gesendet | `processInput` | **−0.03 … −0.07** (D1), `updated_at` neu |
| B ORB verarbeitet Nachricht | derselbe Aufruf | kein zusätzlicher Abzug |
| C „ORB denkt …“ | reiner Client-Zustand (`sendMutation.isPending`) | **0** |
| D Autonome Auswertung startet | `askProactively()` → `loadCuriosityContext` (nur `select`) | **0** |
| E IMPULSE-Bewertung | `decideImpulse()` (reine Logik) | 0 |
| F CURIOSITY-Bewertung | `decideCuriosity()` (reine Logik) | 0 |
| G Kandidaten-Bewertung | reine Logik | 0 |
| H Frage abgelehnt | `silent()` → sofortiger `return` | **0, kein Schreibzugriff** |
| I Frage formuliert | `formulateQuestion()` (LLM) | 0 |
| J Frage tatsächlich gesendet | `engine.server.ts:2316` | **−0.03** (D2) |
| K Chat-Render/Updates | React | 0 |
| L Leerlauf-Beobachter feuert | 5-s-Intervall, rein clientseitig; ein Serveraufruf nur bei erfüllten Bedingungen | 0 (außer J) |
| M Timer/Intervalle | nur PRESENCE_TICK_MS = 5 s, kein Polling der Momentaufnahme (`useQuery` ohne `refetchInterval`) | 0 |
| N React-Renderzyklen | – | 0 |
| O App/Tab erhält Fokus | `visibilitychange` setzt nur Leerlaufzeit zurück; React Query holt die Momentaufnahme bei Fokus neu → **M7/D3** | 0 gespeichert, **Erholungsuhr wird zurückgesetzt** |
| P Energie aus Persistenz gelesen | `toState()` → `recoverEnergy()` | rechnerisch **+**, nie gespeichert |

---

## 5. Timeline

Belegt sind nur Zeitpunkte mit Datenbank-Evidenz. Zwischenwerte der Anzeige sind nicht protokolliert (kein Energie-Verlauf wird gespeichert) und werden **nicht erfunden**.

| Zeit (UTC) | Energie vorher | Ereignis | Codepfad | Delta | Energie nachher |
| --- | --- | --- | --- | --- | --- |
| 2026-09-21 06:30:27 | 0 (gespeichert) | Stand nach der Implementierung | – | – | 0 gespeichert |
| … Leerlauf | 0 | Erholung nur rechnerisch | `recoverEnergy` | +0.02/min, Cap 0.25 | Anzeige stieg (beobachtet 11–15 %) |
| jeder Snapshot-Abruf | Anzeige 0.11–0.15 | `decay_computations`-Update | `engine.server.ts:408` | gespeichert 0, `updated_at = now()` | **Anzeige beim nächsten Lesen ≈ 0.00–0.01 (≈ 1 %)** |
| 07:44:26.701 | – | Benutzernachricht | `processInput` | D1 auf einen bereits fast 0 gerechneten Wert | `state_snapshot.energy = 0`, `decision = stay_silent` |
| 07:44:30.6 / 07:44:31.5 | – | Metriken `turn`, `analysis` | – | – | – |
| 07:57:36.078 | – | Benutzernachricht (Aufforderung zu fragen) | `processInput` | D1 | `energy = 0`, `stay_silent` |
| 07:57:40.545 | – | letzter Zustandsschreibvorgang | Turn/Snapshot | `updated_at = now()` | Erholungsuhr erneut auf 0 |

Kein `proactive`-Metrik-Eintrag, keine `orb_questions`-Zeile heute → **Punkt J wurde nie erreicht; die 0.03-Kosten wurden heute nie erhoben.**

---

## 6. Explanation of the ~11–15 % → ~1 % Drop

Klassifizierung der angebotenen Ursachen:

- **A wiederholte legitime Kosten – ausgeschlossen.** Heute gab es 2 Benutzernachrichten und 0 eigene Fragen; maximal ca. −0.14 insgesamt, und der gespeicherte Wert war ohnehin 0.
- **B unerwartete Energie-Mutation – nein.** Es existiert kein weiterer Schreibzugriff, der `energy` verringert.
- **C mehrere autonome Zyklen – nein.** 0 `proactive`-Metriken, 0 Fragen.
- **D Anzeige-/Persistenz-Fehlpassung – JA, das ist die Ursache.** Der angezeigte Wert ist ein **berechneter** Wert (`stored + Δt·0.02`); gespeichert bleibt 0. Jeder Snapshot-Abruf schreibt `decay_computations` und der Trigger setzt `updated_at = now()`. Damit ist Δt wieder ≈ 0 und die Anzeige fällt auf ≈ 0–1 %. Genau das erklärt beide Beobachtungen: „sinkt bei Chat-Aktivität“ (Turn schreibt Zustand) und „sinkt ohne sichtbare Aktion“ (Snapshot-Abruf bei Tab-Fokus/Invalidierung schreibt ebenfalls).
- **E Race Condition – nicht erforderlich** zur Erklärung; mehrere Tabs/Komponenten würden denselben Effekt lediglich häufiger auslösen (der Cap bleibt eingehalten, da die Funktion rein zeitbasiert ist).
- **F weiterer Energie-Verbraucher – keiner gefunden.**
- **G unzureichende Evidenz** – nur für den exakten Minutenverlauf der Anzeige (nicht protokolliert).

**Ergebnis: D – Fehlpassung zwischen berechneter Anzeige und Persistenz, ausgelöst durch die Rücksetzung von `updated_at` beim Snapshot-Zähler (M7/D3).** Die Erholung funktioniert mathematisch korrekt, ihr Zeitanker wird aber von einem vorbestehenden, nicht energiebezogenen Schreibvorgang gelöscht.

---

## 7. Listening Mode Verification

Die ORB-Antwort um 07:57 („die aktuellen LISTEN-Vorgaben verbieten mir …“) ist **nur teilweise zutreffend**:

- Der Modus `LISTEN` in `src/orb-core/conversation.ts` verbietet tatsächlich Rückfragen **innerhalb einer Antwort auf eine Eingabe** – das ist korrekt.
- Der eigenständige Weg (`askProactively`) wird von LISTEN **nicht** berührt; es existiert kein `if (listening) return` in diesem Pfad.
- Technisch entschieden hat hier die Energie: beide Antworten tragen `decision = stay_silent`, und `decide()` (`core.ts:203`) liefert `stay_silent`, sobald `energy < 0.12`. FOLLOW_UP und SMALLTALK verlangen ebenfalls `energy >= 0.12` (`conversation.ts:180, 194`).

Die LISTEN-Formulierung ist also eine Folge, nicht die Ursache. Ursache ist Energie ≈ 0 zum Verarbeitungszeitpunkt.

---

## 8. Recovery Verification

Vergleich mit der freigegebenen Änderung:

| Vorgabe | Ist-Zustand | Bewertung |
| --- | --- | --- |
| +0.02 pro Minute | `ENERGY_RECOVERY_PER_MIN = 0.02` (`core.ts:152`) | erfüllt |
| Cap 0.25 | `ENERGY_RECOVERY_CAP = 0.25`, `Math.min(...)` | erfüllt |
| Kosten 0.03 unverändert | `engine.server.ts:2316` unverändert | erfüllt |
| zeitbasiert, nicht aufrufbasiert | reine Funktion über `nowMs − updatedAtMs` | erfüllt |
| keine weitere Energie-Mutation | keine gefunden | erfüllt |

Die Erholung selbst ist korrekt umgesetzt. Sie wird in der Praxis nur wirksam, solange **kein** Schreibvorgang auf `orb_state` erfolgt – und ein solcher erfolgt bei jedem Snapshot-Abruf.

---

## 9. Unexpected Findings

**FINDING F-1 — NO CHANGE MADE.** `getSnapshot()` (`engine.server.ts:408–413`) schreibt bei jedem Abruf `decay_computations`. Der Trigger `orb_state_updated_at` setzt dabei `updated_at = now()` und löscht damit die gesamte aufgelaufene Energie-Erholung, ohne `energy` zu erhöhen. Wirkung: Erholung praktisch neutralisiert, solange der ORB-Chat geöffnet ist.

**FINDING F-2 — NO CHANGE MADE.** `decay_computations` steht bei 4539 – ein Maß für die Häufigkeit der Snapshot-Schreibvorgänge. Jeder davon hätte seit dem 21.09. die Erholungsuhr zurückgesetzt.

**FINDING F-3 — NO CHANGE MADE.** `recordLearning()` (`:1726`) schreibt ebenfalls `orb_state` ohne `energy` – identischer Rücksetz-Effekt.

**FINDING F-4 — NO CHANGE MADE.** Der gespeicherte Wert bleibt 0, weil `processInput` den (fast nicht erholten) Wert zurückschreibt. Ein Nutzer kann daher nie einen erholten Wert dauerhaft ansparen.

**FINDING F-5 — NO CHANGE MADE.** Die Anzeige („x % Energie“, Avatar-Atmung ab 0.20) beruht auf dem berechneten Wert und kann zwischen zwei Abrufen ohne jedes Ereignis sichtbar springen – das erklärt „Energie sinkt ohne sichtbare Aktion“.

**FINDING F-6 — NO CHANGE MADE.** Ablehnungen (`silent()`) werden nirgends protokolliert; die Aussage „ORB denkt … aber keine Frage“ lässt sich nicht serverseitig belegen. Es existieren heute keine `proactive`-Metriken – der Serveraufruf kann stattgefunden und still abgebrochen haben, ohne Spur.

**FINDING F-7 — NO CHANGE MADE.** Parallele Tabs/Komponenten erhöhen nur die Häufigkeit von F-1; den Cap können sie nicht überschreiten, da die Erholung rein aus gespeichertem Wert und Zeit berechnet wird.

---

## 10. Classification

**F — display/persistence mismatch.**

Begründung: Es gibt keinen unbekannten Energie-Verbraucher und keine doppelte Kostenbuchung. Die Erholung entspricht exakt der Freigabe (+0.02/min, Cap 0.25, Kosten 0.03). Der beobachtete Abfall von ca. 11–15 % auf ca. 1 % entsteht dadurch, dass der angezeigte Energiewert ausschliesslich aus `stored + Δt·0.02` berechnet wird, während ein vorbestehender, nicht energiebezogener Schreibvorgang (`decay_computations` in `getSnapshot()`) über den Zeitstempel-Trigger den Zeitanker Δt bei jedem Snapshot-Abruf auf 0 zurücksetzt.

Kein Eingriff vorgenommen. Keine Empfehlung umgesetzt – weiteres Vorgehen nur nach ausdrücklicher Freigabe.
