# ORB CORE — Proactive Questioning Regression: Forensic Analysis

Datum: 2026-09-21 · Modus: STRICT READ-ONLY · Umgebung: PRODUCTION + Source
Nutzer (ORB-Testkonto): `9ce1d1b0-7481-4cb0-aedf-5291dae67297`
KEINE Änderung an Code, DB, Migration, Schwellen, Prompts, Listening, Deployment.

---

## 1. Executive Summary

1. `askProactively()` wird aktuell **erreicht** (Ergebnis A aus Abschnitt 3). Der Client-Gate
   (`shouldAskProactively`) erlaubt den Aufruf: Neugier 0.9925 = `very_high`, kein Cooldown,
   Mikrofon aus, Tab sichtbar.
2. Der Pfad stoppt **serverseitig in beiden Bewertern** von `askProactively`:
   - CURIOSITY: `energy = 0 < CURIOSITY_MIN_ENERGY (0.15)` → `WAIT`.
   - IMPULSE: bester Kandidatenwert **0.104 < IMPULSE_MIN_SCORE (0.2)** → `STAY_SILENT`.
   Damit greift `engine.server.ts:2238` (`return silent(...)`).
3. Die von ORB gelieferte Erklärung „LISTEN-Modus verbietet Nachfragen“ ist **C — nicht durch
   Code/Runtime belegt** (bezogen auf den autonomen Pfad). `MODE_HINT.LISTEN` ist eine reine
   Sprachanweisung des **reaktiven** Antwortpfads (`processInput`) und wird von
   `askProactively()` nie gelesen. `listening` im Presence-Gate bedeutet ausschliesslich
   „Mikrofonaufnahme läuft“ (`presence.ts:108`), nicht „Zuhörmodus“.
4. Es gibt **keine Code-Regression**: Git-Historie von `presence.ts`, `use-orb-presence.ts`,
   `impulse.ts`, `curiosity.ts`, `engine.server.ts`, `channels.orb.tsx` zeigt seit den
   bestätigten Fällen keine neuen Guards, keine geänderten Schwellen, keine deaktivierten Calls.
   Der Unterschied ist **Daten-/Zustandsstand**, nicht Logik.
5. Ursachenklassifikation: **E (Energy)** + **N (fehlender bzw. zu schwach bewerteter Kontext)**,
   nachrangig **K** (stille Ablehnungen sind für den Nutzer unsichtbar). **Nicht** F, G, H, J, L, M.

---

## 2. Current Behavior

Beobachtet: keine autonome Nachfrage mehr seit 2026-09-20 07:26:11 UTC.
Produktionsbelege (read-only):

| Beleg | Wert |
|---|---|
| `orb_state` (Testkonto, 2026-09-21 06:30:27) | `curiosity = 0.9925`, `energy = 0` |
| letzte proaktive Frage (`orb_questions`) | 2026-09-20 07:26:11.726 (Case 1), beantwortet 07:26:55 |
| offene eigene Frage | keine (alle 3 Fragen `answered_at` gesetzt) |
| Chat-Nachrichten seit 2026-09-20 19:22 | `decision = stay_silent`, `state_snapshot.proactive = null`, `energy = 0` |
| `orb_metrics kind='proactive'` seit 07:26 | keine neue Zeile |

ORB-Aussagen im Chat (2026-09-21 05:16 / 05:17): „meine aktuellen Vorgaben setzen den Modus
LISTEN und verbieten Nachfragen ausdrücklich“ / „du musst das ausdrückliche Frageverbot im
LISTEN-Modus lockern“. Diese Aussagen sind Modelltext, kein Systembefund (Abschnitt 9).

---

## 3. Previously Confirmed Behavior (Referenz)

| | Case 1 (2026-09-20 07:26) | Case 2 (2026-09-19 18:05) |
|---|---|---|
| Trigger | Browser-Idle-Observer | Browser-Idle-Observer |
| Server-Einstieg | `askProactively` | `askProactively` |
| Bewerter | IMPULSE (`missing_information`, P2) | CURIOSITY (`detail`) |
| Energie | 0 (Impulspfad prüft Energie nicht) | 0.618 |
| Wert | 0.36288 ≥ 0.2 | 0.40446 ≥ 0.2 |
| Auslösender Knoten | `5d140b55…` „Nicht faktisch falsch“, **0 Verbindungen** | `dac061cb…` Thema „erzähle“ |

---

## 4. Runtime Path Comparison / 6. Aktueller Runtime-Pfad

Replay der **echten** Kernfunktionen (`detectGaps`, `decideImpulse`, `decideCuriosity`) gegen den
aktuellen Produktionsdatenstand (12 Knoten mit Thema, 36 Verbindungen, letzte 8 Nachrichten,
3 frühere Fragen). Reine Rechnung, keine Schreibvorgänge.

```text
Browser Idle Observer (use-orb-presence.ts:99, 5-s-Takt)      [REACHED]
  → shouldAskProactively (presence.ts:102)                    [REACHED, ask = true]
      tabVisible ok · typing nein · listening(Mikrofon) nein
      speaking nein · pending nein · idle ≥ 40 s · band very_high
      hasCandidate = true (clientseitig fest, :109) · Cooldown abgelaufen
  → onAsk → requestOrbCuriosity → askProactively (engine.server.ts:2187) [REACHED]
      → loadCuriosityContext (:1900)                          [REACHED]
      → decideCuriosity (:2197)                               [BLOCKED]
            energy 0 < 0.15 → WAIT ("Zu wenig Energie")
      → decideImpulse (:2209)                                 [BLOCKED]
            suppressed = false · openQuestion = false · Cooldown ok
            5 Kandidaten, bester Wert 0.104 < 0.2
            → STAY_SILENT: „Mehrwert noch zu gering (0.10 < 0.2).“
      → Zeile 2238: kein Impuls und decision ≠ ASK → silent()  [BLOCKED — Stopp-Punkt]
  → formulateQuestion (:2245)                                 [NOT REACHED]
  → Duplikatprüfung (:2252)                                   [NOT REACHED]
  → orb_questions / orb_messages / orb_state / orb_metrics     [NOT REACHED]
  → UI-Ausgabe (channels.orb.tsx:221 `if (!result.asked) return`) [NOT REACHED]
```

Replay-Kandidaten (aktueller Stand):

| Typ | Priorität | Thema | Wert |
|---|---|---|---|
| `missing_context` | P3 | faktisch | 0.1272 |
| `incomplete_goal` | P2 | ziel | 0.1041 |
| `repeated_topic` | P3 | hardware | 0.0954 |
| `repeated_topic` | P3 | hardware | 0.0763 |
| `repeated_topic` | P3 | hardware | 0.0763 |

Warum niedriger als in Case 1:
1. **`conversationalFit = 0.6`** für alle Kandidaten — kein Gap-Thema liegt in den Themen der
   letzten 8 Nachrichten (aktuelle Gesprächsthemen sind „impul/list/modu/nachfrag/messwerte…“).
2. **`futureRelevance = 0.5355`** statt höher — alle Knoten tragen `long_term_value = 0.5`
   und `temporal_scope = long_term` (`gaps.ts:111-117`).
3. **Der Case-1-Knoten ist nicht mehr isoliert.** `5d140b55…` hat heute eine Verbindung zu
   `1076e508…` (Gewicht 0.628). Damit entsteht kein `missing_information` (P2) mehr, sondern nur
   `missing_context` (P3, `PRIORITY_BENEFIT` 0.55 statt 0.8).
4. **`energy = 0`** schliesst den zweiten Weg (CURIOSITY) vollständig aus; er war der Weg von
   Case 2.

Rechnung P3-Spitzenkandidat: 0.8 × 0.9 × 0.5355 × 0.6 × 0.55 = 0.1272.
Rechnung Case 1 damals: 0.8 × 0.9 × 0.5355 × 1.0 × 0.8 = 0.36288.

---

## 5. askProactively Analysis

Zustand im aktuellen Code (unverändert gegenüber dem bestätigten Stand):

| Stelle | Prüfung | Aktuelles Ergebnis |
|---|---|---|
| :2195 | Kontext laden | 12 Knoten, 36 Verbindungen, 26 Interessen |
| :2197 | `decideCuriosity` | `WAIT` (Energie) |
| :2209 | `decideImpulse` | `STAY_SILENT` (Wert) |
| :2235 | `suppressed` (Nutzerabsage) | false — `DECLINE_RE` trifft keinen der letzten Nutzertexte |
| :2238 | gemeinsamer Ausstieg | **greift** |
| :2239+ | gemeinsamer Aktionspfad | nicht erreicht |

`explicit: true` umgeht diese Prüfungen ausdrücklich nicht (Kommentar :2237) — auch ein
Knopfdruck führt im aktuellen Zustand zu Stille.

---

## 6. Listening Mode Analysis

Vollständige Suche nach „listen“ in `src/orb-core`, `src/orb-sdk`, `src/integrations/y-dude-orb`,
`src/routes/_authenticated/channels.orb.tsx`:

| Fund | Bedeutung | Wirkung auf Autonomie |
|---|---|---|
| `channels.orb.tsx:120` `const [listening, setListening]` | Mikrofonaufnahme läuft | setzt Leerlaufzeit zurück |
| `presence.ts:80,108` `if (ctx.listening) return no("Mikrofon ist aktiv.")` | Gate während laufender Aufnahme | blockiert **nur solange das Mikrofon an ist** |
| `use-orb-presence.ts:85` | Aktivität markieren | Leerlaufzähler zurücksetzen |
| `avatar.ts:12` `"listening"` | Gesichts-/Anzeigezustand | nur UI |
| `conversation.ts:20,201,213` `LISTEN` | **Gesprächsmodus des reaktiven Antwortpfads**; `MODE_HINT.LISTEN` = „höchstens ein kurzer Satz, keine Frage“ | wirkt nur auf die **Antwort auf eine Nutzereingabe** in `processInput`; `askProactively` liest `MODE_HINT` nicht |

Es existiert **kein** `if (listeningMode) return` im autonomen Pfad und kein globaler
„NO AUTONOMY“-Schalter. `askProactively` nutzt eine eigene Sprachanweisung
(`formulateQuestion`, :2141-2178) ohne `MODE_HINT`.

---

## 7. Exact Blocking Point

- Primär: `src/orb-core/engine.server.ts:2238`
  `if (!impulse && (decision.action !== "ASK" || !decision.gap)) return silent(decision.reason);`
- Ursache A: `src/orb-core/curiosity.ts:285` `if (input.energy < CURIOSITY_MIN_ENERGY) → WAIT`
  bei `energy = 0`.
- Ursache B: `src/orb-core/impulse.ts:228` `if (best.score < IMPULSE_MIN_SCORE)` bei 0.104.

---

## 8. Root Cause

Beide Wege in `askProactively` scheitern gleichzeitig, aus zwei unabhängigen Gründen:

1. **Energie ist dauerhaft 0.** Energie wird an allen Fundstellen nur abgezogen, nie aufgebaut
   (bereits als FINDING in den Vorberichten dokumentiert). Der CURIOSITY-Weg (Case 2) ist damit
   strukturell dauerhaft gesperrt.
2. **Kein Lückenkandidat erreicht 0.2 mehr.** Der Impulswert hängt an `conversationalFit`
   (0.6, weil das Gespräch über ORB selbst und nicht über gespeicherte Themen läuft),
   an `futureRelevance` (0.5355, weil alle Knoten `long_term_value = 0.5` tragen) und an der
   Priorität (nur P2/P3 verfügbar, weil der früher isolierte Knoten inzwischen verbunden ist).

Es ist also die Folge normaler Zustandsentwicklung im Zusammenspiel mit zwei harten Schwellen —
kein Listening-Verbot und keine Codeänderung.

---

## 9. Validation of ORB's Own Explanation

Klassifikation: **C — nicht durch Code/Runtime belegt.**

- `MODE_HINT.LISTEN` existiert und verbietet Fragen — aber ausschliesslich im reaktiven
  Antwortpfad. Insofern beschreibt ORB korrekt, warum **seine Antworten auf Nutzereingaben**
  keine Rückfragen enthalten (alle letzten Nachrichten: `decision = stay_silent`).
- Für die **autonome** Frage ist diese Anweisung ohne Bedeutung; der tatsächliche Block liegt in
  Energie (0) und Impulswert (0.104). ORB hat seinen reaktiven Modus als Erklärung für das
  Ausbleiben des autonomen Impulses verwendet — technisch unzutreffend.

---

## 10. Regression Analysis

| Prüfpunkt | Ergebnis |
|---|---|
| neue Guards | keine |
| verschärfte Guards | keine |
| geänderte Schwellen (`0.2`, `0.15`, `0.35`, Cooldowns, 40 s / 15 min) | unverändert |
| geänderte Reihenfolge | unverändert |
| deaktivierte Calls | keine — `onAsk` → `requestOrbCuriosity` → `askProactively` intakt |
| Idle-Observer | intakt, 5-s-Takt, `hasCandidate: true` |
| Duplikatprüfung | nicht erreicht, unverändert |
| proaktive Event-Erzeugung | nicht erreicht, unverändert |
| Datenzustand | **verändert**: Energie 0, Case-1-Knoten verbunden, Gesprächsthemen ORB-bezogen |

Ergebnis: **keine Code-Regression. Zustandsbedingte Verhaltensänderung.**

---

## 11. Smart Repair Options (Vorschlag, nicht umgesetzt)

### Option A — Minimal Change: Energiehaushalt schliessen
- Änderung: Energie im bestehenden Zustandsupdate wieder aufbauen (z. B. Regeneration pro
  Interaktion oder zeitbasiert, obergrenzt), ohne Formeln für Gedächtnis zu berühren.
- Dateien/Funktionen: `src/orb-core/engine.server.ts` (Zustandsupdate im Antwortpfad),
  ggf. `src/orb-core/core.ts` (reine Regenerationsfunktion) + Tests.
- Risiken: Energie ist Eingang mehrerer Entscheidungen (FOLLOW_UP/SMALLTALK ≥ 0.12,
  CURIOSITY ≥ 0.15) → mehr Rückfragen und mehr Smalltalk gleichzeitig.
- Seiteneffekte: mehr LLM-Aufrufe; Regressionsrisiko **mittel**.
- IMPULSE: unberührt. CURIOSITY: wird wieder erreichbar. Memory: unberührt.
  Listening: unberührt. UX: ORB wirkt lebendiger, Gefahr häufigerer Fragen.
- Tests: Einheitstests für Regeneration, Grenzwerttests 0.12/0.15, Nichtregression
  `orb-conversation-decision`.

### Option B — Architectural Cleanup: Listening vs. Autonomie trennen
- Änderung: die reaktive Sprachanweisung (`MODE_HINT.LISTEN`) explizit als „keine Rückfrage in
  dieser Antwort“ benennen und in der Sprachschicht sichtbar von „Autonomie erlaubt/verboten“
  trennen; zusätzlich eine benannte Autorisierungsfunktion
  `isAutonomousActionAllowed()` als einzige Stelle, die Autonomie erlaubt.
- Dateien: `src/orb-core/conversation.ts`, `src/orb-core/presence.ts`,
  `src/orb-core/engine.server.ts`, `src/orb-core/llm/prompt.server.ts`, neue Tests.
- Risiken: berührt den reaktiven Antwortpfad → Wortlautänderungen möglich.
  Regressionsrisiko **mittel-hoch**, dafür beste Nachvollziehbarkeit.
- IMPULSE/CURIOSITY: unverändert bewertet, nur klarer autorisiert. Memory: unberührt.
  UX: ORB kann seinen Zustand künftig korrekt erklären (behebt den Befund aus Abschnitt 9).

### Option C — Robust Autonomy Guard (empfohlen)
- Änderung: (1) Energie-Gate nur für CURIOSITY beibehalten, aber Energie regenerieren
  (Option A, konservativ dosiert); (2) `conversationalFit` als **Rangfaktor** statt als
  multiplikativer Wertdämpfer prüfen — nur als Vorschlag zur Bewertung, nicht als Änderung
  der Speicherformeln; (3) Stille Ablehnungen mit Grund in `orb_metrics` protokollieren,
  damit künftige Diagnosen ohne Replay möglich sind.
- Dateien: `src/orb-core/impulse.ts`, `src/orb-core/engine.server.ts`, Tests.
- Risiken: Änderung an `impulseScore` ist ein Eingriff in eine bestehende Bewertungsformel →
  nur mit ausdrücklicher Freigabe; Regressionsrisiko **mittel**.
- Wirkung: Autonomie funktioniert unabhängig davon, ob das Gespräch gerade über gespeicherte
  Themen läuft; Listening bleibt unangetastet; Diagnose wird dauerhaft belegbar.

Gegenempfehlung zu „Listening lockern“: würde nichts bewirken, da Listening den autonomen
Pfad nicht blockiert.

---

## 12. Recommended Target Architecture (Entwurf)

```text
User Input Listening (Mikrofon/Tippen)   → nur Unterbrechungsschutz
        ↓
Context Observation (loadCuriosityContext)
        ↓
Autonomy Evaluation ── IMPULSE (gaps.ts/impulse.ts)
                    └─ CURIOSITY (curiosity.ts)
        ↓
Decision (ein gemeinsames gap)
        ↓
Autonomous Action Authorization  ← neue, benannte, einzige Freigabestelle
        ↓
Question (formulateQuestion) → Duplikatprüfung → Persistenz → Output
```

Kompatibilität: hoch. Der bestehende Code hat diese Kette faktisch schon
(`shouldAskProactively` → `askProactively` → gemeinsamer Aktionspfad); es fehlt nur eine
benannte Autorisierungsstelle und die Trennung der reaktiven Sprachanweisung von der
Autonomiefrage. Listening bleibt Unterbrechungsschutz („nicht während einer Äusserung“),
nicht Autonomieverbot.

---

## 13. Test Strategy (nach Freigabe)

1. normale Nutzereingabe erzeugt eine Antwort
2. Listening (Mikrofon aktiv) verhindert einen proaktiven Aufruf
3. aktives Zuhören/Tippen verhindert Zwischenfragen
4. Leerlauf ≥ 40 s löst Autonomie-Bewertung aus
5. IMPULSE erzeugt bei P1/P2-Lücke mit Wert ≥ 0.2 `SPEAK`
6. CURIOSITY erzeugt bei Energie ≥ 0.15 und Wert ≥ 0.2 `ASK`
7. autonome Frage wird erzeugt und persistiert (`orb_questions` + `orb_messages`)
8. Duplikatprüfung unterdrückt sehr ähnliche Frage (Ähnlichkeit ≥ 0.6)
9. Gedächtnisverhalten unverändert (Schwelle 0.35, Verfall, Recall — bestehende Tests grün)
10. `state_snapshot.proactive = true` und `question_id` gesetzt
11. keine Frage während `typing`/`listening`/`pending`
12. keine Endlosschleife: höchstens ein Aufruf pro Takt (`lastProactiveRef` sofort gesetzt)
13. kein Fragen-Spam: Cooldown je Neugierband (120–300 s)
14. Cooldown-Test über `PROACTIVE_COOLDOWN_MS`
15. Regressionstests, die die Case-1- und Case-2-Fingerprints reproduzieren
    (Impuls-Gap P2 → Wert ≥ 0.2; Curiosity-Gap mit Energie 0.618 → ASK)

---

## 14. Rollback Strategy

- Vor jeder Änderung vollständiges Backup unter
  `.lovable/backup/pre_orb_autonomy_repair_<datum>/` inkl. betroffener Kerndateien.
- Production-Commit vor/nach dokumentieren.
- Rollback = Rückkopieren der Kerndateien + erneutes Publish; keine DB-Änderung nötig,
  wenn Option A/C ohne Migration umgesetzt wird.
- Abbruchkriterium: eine autonome Frage pro Cooldown-Fenster überschritten, oder
  Gedächtnistests nicht grün → sofortiger Rollback.

---

## 15. Implementation Plan

| Phase | Inhalt |
|---|---|
| 1 Diagnose | dieser Bericht (abgeschlossen) |
| 2 Minimaler Fix | gewählte Option (Vorschlag: C, mindestens A) — nur nach Freigabe |
| 3 Tests | Punkte 1–14 aus Abschnitt 13, Typecheck, Lint, Build |
| 4 Regression Case 1 | Impulspfad mit P2-Lücke reproduzierbar, Wert ≥ 0.2 |
| 5 Regression Case 2 | Curiositypfad bei Energie ≥ 0.15 reproduzierbar |
| 6 Production Verification | Leerlauftest im echten Chat, Prüfung `orb_questions`/`orb_metrics` |
| 7 Rollback-Strategie | Abschnitt 14 |

---

## 16. FINDINGS — NO CHANGE MADE

1. **F1** Energie wird nur abgezogen, nie aufgebaut; Produktionswert 0 seit 2026-09-19 →
   CURIOSITY-Pfad strukturell gesperrt. (Bereits in Vorberichten festgestellt.)
2. **F2** Asymmetrisches Energie-Gate: CURIOSITY prüft 0.15, IMPULSE prüft keine Energie.
3. **F3** `conversationalFit` dämpft den Impulswert multiplikativ auf 0.6, wenn das Gespräch
   nicht über gespeicherte Themen läuft — genau der Fall bei Gesprächen über ORB selbst.
4. **F4** `long_term_value` ist bei allen geladenen Knoten 0.5 → `futureRelevance` konstant
   0.5355; der Wert differenziert aktuell nicht.
5. **F5** Stille Ablehnungen von `askProactively` werden nirgends persistiert; die Diagnose war
   nur über einen Offline-Replay möglich.
6. **F6** `hasCandidate: true` ist clientseitig fest verdrahtet (`use-orb-presence.ts:109`);
   jeder erlaubte Takt erzeugt einen Serveraufruf, auch wenn kein Kandidat existiert.
7. **F7** ORB begründet ausbleibende autonome Fragen mit `MODE_HINT.LISTEN`, obwohl diese
   Anweisung im autonomen Pfad nicht gilt — irreführende Selbstbeschreibung.
8. **F8** Themenextraktion erzeugt teils unbrauchbare Themen (z. B. `reisen` für einen Text
   über Chatverlauf, `okay`, `solche`), was `conversationalFit` weiter verschlechtert.

Keine Änderung vorgenommen. Kein Deployment. Keine Schreiboperation.
