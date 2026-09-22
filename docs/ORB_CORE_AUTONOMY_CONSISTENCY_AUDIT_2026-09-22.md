# ORB CORE – AUTONOMOUS DECISION CONSISTENCY AUDIT

**Datum:** 2026-09-22
**Modus:** READ-ONLY · keine Änderung · kein Deployment · keine Migration
**Primärquellen:** aktueller Quellcode (`src/orb-core/*`, `src/integrations/y-dude-orb/*`, `src/routes/_authenticated/channels.orb.tsx`), Produktionsdaten (`orb_questions`, `orb_messages`, nur lesend), vorhandene Tests (nur ausgeführt, nicht verändert)
**Geändert:** 0 Dateien, 0 Tests, 0 SQL, 0 Migrationen, 0 Deployments

Klassifikation je Aussage: **CODE-BEWIESEN** · **DB-BEWIESEN** · **RUNTIME-BEWIESEN** · **TEST-BEWIESEN** · **WAHRSCHEINLICH** · **OFFEN**

---

## 1. EXECUTIVE SUMMARY

Der autonome Entscheidungsweg ist nach dem Targeted Fix 01 **in seinem Kern konsistent**: es gibt genau eine finale Freigabe, sie liegt vor der Formulierung und vor jeder Persistenz, und ein abgelehnter Versuch verändert nachweislich keinen Zustand (CODE-BEWIESEN, TEST-BEWIESEN).

Gefunden wurden **fünf** Konsistenzabweichungen, keine davon ein Datenverlust:

| # | Befund | Klasse | Nachweis |
|---|--------|--------|----------|
| K1 | Reihenfolge Suppression → Kandidat → Energie: bei fehlendem Kandidaten wird Energie nie geprüft, der Reason lautet dann rein curiosity-basiert, obwohl ein Impuls hätte sprechen wollen | Inkonsistenz der Begründung, keine falsche Handlung | CODE-BEWIESEN |
| K2 | Der Impuls-Zweig nutzt `lastImpulseAt: ctx.lastQuestionAt` – Curiosity- und Impulse-Cooldown teilen denselben Zeitanker, aber mit unterschiedlichen Zeittabellen | WAHRSCHEINLICH unbeabsichtigt | CODE-BEWIESEN |
| K3 | Client: `presence.noteProactive()` wird ohne `topic`/`dimension` aufgerufen; die clientseitige `asked`-Liste bleibt dadurch immer leer | Toter Schutzmechanismus | CODE-BEWIESEN |
| K4 | Client-Cooldown startet nur bei `asked = true`; ein serverseitig abgelehnter Versuch darf sofort im nächsten Takt erneut auslösen | Designfolge, erzeugt Last, keine Seiteneffekte | CODE-BEWIESEN |
| K5 | Der Erfolgspfad schreibt vier Tabellen ohne Transaktion; ein Fehler nach `orb_questions` hinterlässt eine Frage ohne Nachricht und ohne Energiekosten | Bekannt, unverändert | CODE-BEWIESEN |
| K6 | Themen wie „erzähle“, „faktisch“, „warum“, „korrekt“, „jahre“ stammen aus dem Fallback „erstes Inhaltswort“ und tragen echte autonome Fragen | DB-BEWIESEN | Produktionsdaten |

**Produktionsabgleich:** 15 gespeicherte autonome Fragen (nicht 13 – zwei weitere seit dem letzten Bericht). Drei davon wurden bei Energie **0.0 / 0.0898 / 0.0895** gestellt; **alle drei tragen `state_snapshot.impulse != null`** – der behobene Logikfehler ist damit ausschliesslich im Impuls-Zweig aufgetreten (DB-BEWIESEN). Nach dem Fix ist diese Kombination nicht mehr erreichbar (CODE-BEWIESEN, TEST-BEWIESEN).

Keine End-to-End-Abdeckung vom Browser bis zur Persistenz (TEST-BEWIESEN durch Fehlen: `tests/e2e/` enthält keinen ORB-Spec).

---

## 2. AUTONOMOUS FLOW (aus dem aktuellen Code rekonstruiert)

| # | Stufe | Input | Output | Gate | Reason | Nebenwirkungen | Persistenz |
|---|-------|-------|--------|------|--------|----------------|------------|
| 1 | Browser-Takt `useOrbPresence` (`PRESENCE_TICK_MS`) | `curiosity` aus Snapshot, `typing`, `speaking`, `listening`, `pending`, `document.visibilityState`, `idleMs`, `lastProactiveRef` | `verdict` | `shouldAskProactively()` | 9 benennbare Gründe (Tab, Tippen, Mikrofon, Sprechen, laufende Anfrage, < 40 s, > 15 min, Neugier „low“, Cooldown) | `status`, `filterLog` (nur Arbeitsspeicher, entprellt) | keine |
| 2 | Client-Vorfilter-Ergebnis | `verdict.ask` | Serveraufruf oder nichts | derselbe | derselbe | `lastProactiveRef = now` **nur** bei `ask` | keine |
| 3 | Server-Request | `curiosityFn({})` → `askProactively(db, userId)` | `OrbProactiveResult` | Authentifizierung (`requireSupabaseAuth`) | – | – | keine |
| 4 | Context Loading `loadCuriosityContext()` | userId, now | `CuriosityContext` | – | – | `ensureState()` **kann** eine `orb_state`-Zeile anlegen (nur beim ersten Mal); sonst rein lesend: 12 Knoten, 8 Interessen, 8 Nachrichten, Fragenhistorie, 60 Verbindungen, Threads | INSERT `orb_state` nur bei Erstanlage |
| 5 | Curiosity `decideCuriosity()` | `curiosity`, `energy`, `gaps`, `lastQuestionAt`, `openQuestion` | `DO_NOTHING` / `WAIT` / `ASK` + `gap`, `score`, `band` | 6 Prüfungen in fester Reihenfolge | benennbar je Prüfung | keine (reine Logik) | keine |
| 6 | Impulse `decideImpulse()` | `detectedGaps`, `curiosity`, Gesprächsthemen, letzte Nutzertexte, frühere Fragen, bekannte Antworten, `openQuestion`, `lastImpulseAt` | `SPEAK` / `STAY_SILENT` + Kandidat | Ablauf, Priorität ≤ P3, Duplikat/bekannt, Suppression, offene Frage, Cooldown, `IMPULSE_MIN_SCORE` | benennbar | keine | keine |
| 7 | Merge + Energy Gate `finalAutonomyGate()` | `energy`, Curiosity-Entscheidung, Impulse-Entscheidung | `{ allowed, gate, source, action, reason }` | `suppressed` → `no_candidate` → `energy < 0.15` → `pass` | benennbar | keine | keine |
| 8 | Question Formulation `formulateQuestion()` → `speak()` | Gap + optionaler Impuls, Zustand, Ziele, Interessen | `{ question, status }`, auf 600 Zeichen gekürzt | `status !== "ok" \|\| !question` → still, Gate `formulation` | „Sprachschicht nicht verfügbar“ | LLM-Aufruf (Kosten, Latenz) | keine |
| 9 | Duplicate Check `isDuplicateQuestion()` | formulierte Frage, Fragenhistorie | Boolean | `similarity ≥ 0.6` | „schon gestellt“ | keine | keine |
| 10 | Persistence | Frage, Gap, Score, Reason | `orb_questions.id` | Fehler → `throw` | – | – | INSERT `orb_questions` (inkl. `asked_at`) |
| 11 | Message | Frage + `state_snapshot` | – | Fehler → `throw` | – | – | INSERT `orb_messages` (`decision: "ask"`, `proactive: true`, `question_id`, `impulse`, Scopes) |
| 12 | State Update | `ctx.state` | – | Fehler → `throw` | – | `curiosity − 0.06`, `energy − 0.03`; Trigger setzt `updated_at` neu → Erholungsanker wird zurückgesetzt | UPDATE `orb_state` |
| 13 | Metrics | `perf` | – | kein Fehlerpfad (Ergebnis nicht geprüft) | – | – | INSERT `orb_metrics` (`kind: "proactive"`) |
| 14 | Attempt + Rückgabe | alles | `OrbProactiveResult` mit `attempt` | – | – | eine `console.info("[orb.autonomy]")`-Zeile je Versuch | keine |

Alle Zeilen CODE-BEWIESEN.

---

## 3. GATE ORDER

| Gate | Ort | Position begründet? | Kann später umgangen werden? | Unnötig berechnet? | Verändert Zustand trotz „keine Frage“? | Urteil |
|------|-----|---------------------|------------------------------|--------------------|----------------------------------------|--------|
| **A Energy** | `decideCuriosity()` Platz 3 **und** `finalAutonomyGate()` Platz 3 | ja – nach Kandidatenermittlung, vor LLM und Persistenz | **nein** (nach dem Fix); vorher ja | nein | nein | **CONSISTENT** (CODE-BEWIESEN, TEST-BEWIESEN) |
| **B Suppression** | `decideImpulse()` (aus `readUserControl` / Stilprofil) und `finalAutonomyGate()` Platz 1 | ja – Nutzerwille schlägt alles | nein | nein | nein | **CONSISTENT** |
| **C Open Question** | `decideCuriosity()` Platz 4, `decideImpulse()` (eigener Zweig) | ja | nein | nein | nein | **CONSISTENT** |
| **D Cooldown** | `decideCuriosity()` Platz 5 (`PROACTIVE_COOLDOWN_MS[band]`), `decideImpulse()` (`PROACTIVE_COOLDOWN_MS[band]` gegen `lastImpulseAt`), zusätzlich clientseitig | Prüfung dreifach, Zeitanker serverseitig identisch (`ctx.lastQuestionAt`), Tabellen aber getrennt angewandt | nein | ja, doppelt gerechnet | nein | **INCONSISTENT (K2)** – `lastImpulseAt: ctx.lastQuestionAt` (engine.server.ts, `decideImpulse`-Aufruf): der „letzte Impuls“ ist in Wahrheit die letzte *beliebige* eigene Frage. Kein Fehlverhalten, aber der Name behauptet mehr als der Wert hält (CODE-BEWIESEN) |
| **E Curiosity Score** | `decideCuriosity()` Platz 6 (`< 0.2` → WAIT) | ja – letzte inhaltliche Prüfung des Zweigs | **ja, gewollt**: ein Impuls darf sprechen, obwohl der Curiosity-Score zu klein war – beide Zweige sind Alternativen, nicht Stufen | nein | nein | **CONSISTENT** (Designentscheidung, im Code als „vorgeschaltet“ dokumentiert) |
| **F Impulse Score** | `decideImpulse()` (`IMPULSE_MIN_SCORE = 0.2`) | ja | nein | nein | nein | **CONSISTENT** |
| **G Duplicate** | `engine.server.ts` **nach** `formulateQuestion()` | nachvollziehbar (geprüft wird der formulierte Text), aber teuer | nein | ja – der LLM-Aufruf ist bereits erfolgt | nein (nur LLM-Kosten) | **INCONSISTENT im Aufwand, CONSISTENT im Ergebnis** (CODE-BEWIESEN). Ein grober Vorfilter existiert bereits im Impuls-Zweig (`IMPULSE_DUPLICATE_SIMILARITY` gegen `suggestedQuestion`), im Curiosity-Zweig nur über `novelty`/`asked` |
| **H LLM availability** | `spoken.status !== "ok"` | ja – direkt nach dem Aufruf | nein | nein | nein | **CONSISTENT** |
| **I Persistence** | vier Schreibschritte in Reihe | ja | nein | nein | – | **INCONSISTENT (K5)** – keine Transaktion (CODE-BEWIESEN) |

**Zusatzbefund K1 (CODE-BEWIESEN):** In `finalAutonomyGate()` steht `no_candidate` **vor** `energy`. Fehlt ein Kandidat, wird stets `input.curiosity.reason` zurückgegeben – auch wenn der Impuls-Zweig aus Energiegründen nichts liefern wollte. Handlung bleibt korrekt (still); nur die Begründung kann irreführen. Kein Umweg um ein Gate.

---

## 4. NO-QUESTION SIDE EFFECTS

Geprüft wurden **alle** `asked = false`-Pfade: `suppressed`, `no_candidate`, `energy`, `formulation`, `duplicate` sowie die clientseitigen Vorfilter.

| Wirkung | Client-Vorfilter | `suppressed` / `no_candidate` / `energy` | `formulation` | `duplicate` |
|---------|------------------|------------------------------------------|---------------|-------------|
| Energy verändert | nein | nein | nein | nein |
| Curiosity verändert | nein | nein | nein | nein |
| `lastQuestionAt` (`orb_questions.asked_at`) | nein | nein | nein | nein |
| `lastImpulseAt` | nein | nein (identisch zu `lastQuestionAt`) | nein | nein |
| Cooldown verändert | **ja, nur bei `ask = true`** (`lastProactiveRef = now`) | nein | nein | nein |
| Memory aktiviert (`activation_count`, `last_accessed_at`) | nein | nein | nein | nein |
| Graph verändert | nein | nein | nein | nein |
| Metric geschrieben | nein | nein | nein | nein |
| Message geschrieben | nein | nein | nein | nein |

**Nachweis:** `loadCuriosityContext()` enthält ausschliesslich `select`-Abfragen; die einzige Schreiboperation des Ladepfads ist `ensureState()` und nur, wenn noch keine `orb_state`-Zeile existiert (CODE-BEWIESEN). Der `silent()`-Helfer berührt keine der vier Tabellen (CODE-BEWIESEN, TEST-BEWIESEN: `tests/orb-autonomy-gate.test.ts` prüft den Block vertraglich).

**Ausdrücklich Teil des Designs, kein Fehler:**
1. `ensureState()` legt beim allerersten Versuch eine Zustandszeile an.
2. `formulation`-Ablehnung nach bereits erfolgtem LLM-Aufruf verbraucht Modellbudget – keine ORB-Zustandsänderung.
3. `filterLog` und die `console.info`-Zeile sind Beobachtung, keine Zustandsänderung.

---

## 5. ENERGY CONSISTENCY

| Operation | Ort | gespeicherte Energy | berechnete Energy | Zeitpunkt | Änderung |
|-----------|-----|---------------------|-------------------|-----------|----------|
| Lesen + Erholung | `toState()` → `recoverEnergy(row.energy, row.updated_at, now)` | unverändert | `min(0.25, stored + Minuten × 0.02)`; Frühausstieg bei `stored ≥ 0.25` | jeder Lesezugriff | **keine** (rein rechnend) |
| Erfahrung verarbeiten | `processInput()` → `nextState()` → UPDATE `energy: updated.energy` | überschrieben | `ctx.state.energy` (bereits erholt) minus Zustandsabzug | pro Nutzernachricht | gespeichert; Trigger setzt `updated_at` → Erholungsanker neu |
| Momentaufnahme mit Verbindungen | `getSnapshot()` UPDATE `decay_computations`, `energy: toState(stateRow).energy` | überschrieben mit dem erholten Wert | identisch zur Leseberechnung | bei jedem Snapshot mit ≥ 1 Verbindung | **Erholung wird gesichert**, nicht verloren (Fix vom 21.09.) |
| Lernereignis | `recordLearning()` UPDATE `cracks/fear/uncertainty`, `energy: toState(stateRow).energy` | überschrieben mit dem erholten Wert | identisch | pro Lernereignis | Erholung gesichert |
| Autonome Frage gestellt | `askProactively()` UPDATE `energy: max(0, ctx.state.energy − 0.03)` | überschrieben | Basis ist der **erholte** Wert | nur im Erfolgspfad | −0.03, genau einmal |
| Autonome Frage abgelehnt | `silent()` | unverändert | – | – | **keine** |
| Anzeige | `getSnapshot()` / `state_snapshot` in `orb_messages` | – | erholter Wert | Lesezeit | keine |

**Prüfergebnisse:**
- Doppelter Abzug: **nein**. Das Muster `energy − 0.03` existiert genau einmal in der Datei, ausschliesslich im Erfolgspfad (CODE-BEWIESEN, TEST-BEWIESEN).
- Verlorene Erholung: **nein** mehr. Alle vier `orb_state`-Schreibstellen führen `energy` mit (CODE-BEWIESEN).
- Nur angezeigt, nicht gespeichert: **beabsichtigt** – die Erholung ist eine reine Funktion von `updated_at`; sie wird erst beim nächsten Schreiben materialisiert. Solange jede Schreibstelle `energy` mitführt, ist das Ergebnis identisch (CODE-BEWIESEN).
- Persistiert ohne korrekte Berechnung: **nein** – jede Schreibstelle startet vom erholten Wert.
- **Offen / Designgrenze:** `ENERGY_RECOVERY_CAP = 0.25` liegt nur 0.10 über `AUTONOMY_MIN_ENERGY = 0.15`. Bei Ruhe erreicht ORB maximal 0.25; drei autonome Fragen in kurzer Folge (je −0.03) plus Zustandsabzüge führen wieder unter die Schwelle. Das ist eine **Designkonsequenz**, kein Fehler (CODE-BEWIESEN); ob es dem gewünschten Verhalten entspricht, ist **OFFEN**.

---

## 6. CURIOSITY / IMPULSE MATRIX

Alle Zeilen aus `finalAutonomyGate()` + `askProactively()` abgeleitet (CODE-BEWIESEN); die Fälle 1–4 und 9–10 sind zusätzlich TEST-BEWIESEN (`tests/orb-autonomy-gate.test.ts`).

| # | Curiosity | Impulse | Energy | OpenQuestion | Cooldown | FINAL | Warum |
|---|-----------|---------|--------|--------------|----------|-------|-------|
| 1 | ASK | STAY_SILENT | ≥ 0.15 | nein | frei | **ASK (source = curiosity)** | Kandidat vorhanden, Energie reicht, kein Impuls |
| 2 | WAIT (Energie) | SPEAK | < 0.15 | nein | frei | **WAIT, gate = energy** | Energie ist gemeinsame Ressource; Impuls kann sie nicht überstimmen |
| 3 | ASK | SPEAK | ≥ 0.15 | nein | frei | **ASK (source = impulse)** | beide Kandidaten vorhanden, Impuls hat Vorrang (`gapFromImpulse`) |
| 4 | WAIT | STAY_SILENT | beliebig | – | – | **WAIT, gate = no_candidate** | kein Kandidat; Reason = Curiosity-Reason |
| 5 | DO_NOTHING | SPEAK | ≥ 0.15 | nein | frei | **ASK (source = impulse)** | `DO_NOTHING` heisst nur „keine Neugier-Lücke“; der Impuls ist ein eigener Kandidat |
| 5b | DO_NOTHING | SPEAK | < 0.15 | – | – | **WAIT, gate = energy** | Energiegrenze greift vor allem anderen Kandidaten |
| 6 | beliebig | SPEAK + `suppressed` | beliebig | – | – | **WAIT, gate = suppressed** | Nutzerwille zuerst |
| 7 | WAIT (offene Frage) | SPEAK unmöglich – `decideImpulse()` wird bei `openQuestion` still | ≥ 0.15 | ja | – | **WAIT, gate = no_candidate** | beide Zweige kennen `openQuestion`; kein Kandidat entsteht |
| 8 | WAIT (Cooldown) | Cooldown greift im Impuls-Zweig mit derselben Zeittabelle, aber eigener Prüfung | ≥ 0.15 | nein | aktiv | **WAIT, gate = no_candidate** | in der Praxis identischer Anker (`lastQuestionAt`) → beide still. **Rand: unterschiedliche Bänder sind nicht möglich, da beide `curiosityBand(curiosity)` verwenden** |
| 9 | ASK oder WAIT | SPEAK | < 0.15 | nein | frei | **WAIT, gate = energy** | wie 2 |
| 10 | beliebig mit Kandidat | SPEAK | ≥ 0.15 | nein | frei | **ASK (source = impulse)** | Freigabe, Impuls hat Vorrang |

**DO_NOTHING vs WAIT nach aussen:** Bei `no_candidate` wird `action` auf die Curiosity-Handlung abgebildet (`DO_NOTHING` bleibt `DO_NOTHING`, `ASK` wird zu `WAIT`); bei `suppressed` und `energy` immer `WAIT` (CODE-BEWIESEN).

---

## 7. DUPLICATE LOGIC

- **Wann:** **nach** der LLM-Formulierung, direkt vor dem ersten INSERT (CODE-BEWIESEN).
- **Datenbasis:** `ctx.questions.map(row => row.question)` – die letzten `QUESTION_HISTORY_LIMIT` eigenen Fragen aus `orb_questions`, unabhängig von `answered` (CODE-BEWIESEN).
- **Schwelle:** `QUESTION_DUPLICATE_SIMILARITY = 0.6` über `similarity()` (Wortüberlappung, deterministisch).
- **Bei Duplikat:** `silent("… schon gestellt", { gate: "duplicate", duplicate: true })` → kein INSERT in `orb_questions`, keine `orb_messages`-Zeile, kein `orb_state`-Update, kein `orb_metrics`-Eintrag, **keine Fragekosten** (CODE-BEWIESEN, TEST-BEWIESEN).
- **Vorher verändert:** ausschliesslich der LLM-Aufruf (Kosten/Latenz). Kein ORB-Zustand.
- **Zweiter, früherer Filter:** `decideImpulse()` verwirft Kandidaten bereits vor dem LLM (`IMPULSE_DUPLICATE_SIMILARITY = 0.6`) gegen frühere Fragen **und** bekannte Antworten; der Curiosity-Zweig verhindert Wiederholung über `asked`/`novelty` in `deriveKnowledgeGaps()`.
- **Bewertung:** funktional korrekt, aber der teure Weg (LLM vor Prüfung) wird bewusst gegangen, weil erst der formulierte Text verglichen wird. **Verbesserungsmöglichkeit, kein Fehler.**

---

## 8. LLM BOUNDARY

Geprüft wurden alle Aufrufe der Sprachschicht im autonomen Pfad und in seiner Umgebung: `formulateQuestion()` → `speak()`, `src/orb-core/llm/*`, `analysis/analyze.server.ts`.

| Prüffrage | Ergebnis |
|-----------|----------|
| Beeinflusst das LLM eine autonome Entscheidung (`OB`)? | **Nein** – `decideCuriosity`, `decideImpulse`, `finalAutonomyGate`, `shouldAskProactively`, `detectGaps` sind reine Funktionen ohne Netzwerk- oder KI-Zugriff (CODE-BEWIESEN) |
| Erzeugt das LLM einen Gate-Wert? | **Nein** – der einzige vom LLM stammende Gate-Eingang ist `spoken.status` (technische Verfügbarkeit) und die Nichtleere des Textes |
| Erzeugt das LLM einen Score? | **Nein** – `curiosityScore()` und `impulseScore()` rechnen ausschliesslich mit gespeicherten Werten |
| Beeinflusst das LLM eine Persistenzentscheidung? | **Mittelbar ja, und das ist Design:** der formulierte Text entscheidet über den Duplikatfilter, also ob gespeichert wird. Formuliert das Modell zu ähnlich, entfällt die Frage. Ausserdem wird der Text als Frageinhalt gespeichert. Eine *Entscheidungslogik* liegt darin nicht (CODE-BEWIESEN) |
| Analyse-Schicht (`analyze.server.ts`) | Sie liefert Werte (u. a. Wichtigkeit/Kategorien) für gespeicherte Erinnerungen; diese wirken **später** über `deriveKnowledgeGaps()` auf Scores. Damit hat das Modell **indirekten Einfluss auf Eingangswerte**, nicht auf die Entscheidungsregeln. Einordnung: **WAHRSCHEINLICH beabsichtigt**, ausdrückliche Bestätigung **OFFEN** |

**Ergebnis:** Die Regel „CODE entscheidet OB, LLM entscheidet WIE“ ist für den autonomen Fragepfad **BESTÄTIGT** (CODE-BEWIESEN), mit den zwei genannten mittelbaren Einflüssen (Duplikat über Formulierung, Analysewerte als Score-Eingang).

---

## 9. MEMORY → AUTONOMY

Kette: `processInput` → `topicOf()` → Knoten mit `topic` → `loadCuriosityContext` (12 Knoten, `topic not null`) → `deriveKnowledgeGaps` / `detectGaps` → Curiosity / Impulse → Frage.

**Wie eine falsche Zuordnung eine falsche Frage erzeugt (CODE-BEWIESEN):**
1. Nur Knoten **mit** Thema werden geladen (`.not("topic","is",null)`). Ein Thema ist also Eintrittskarte.
2. `deriveKnowledgeGaps()` verlangt `m.topic` und baut `reason`/Frage-Prompt **um das Thema herum** (`„Du möchtest … über das Thema „${gap.topic}“ wissen“`).
3. Ein falsches Thema erzeugt daher eine thematisch falsch gerahmte, formal gültige Frage – genau das in Produktion beobachtete „Reisen“-Muster.
4. `conversationalFit` (1 vs 0.6) und die Interessengewichte werden **nach Thema** zugeordnet: ein falsches Thema verschiebt zusätzlich die Bewertung.

**Vorhandene Schutzmechanismen:**

| Mechanismus | Wirkung auf autonome Fragen | Grenze |
|-------------|-----------------------------|--------|
| `confidence` | `< PROACTIVE_MIN_CONFIDENCE (0.5)` → keine Lücke | schützt nicht vor *falschem Thema* bei sicherem Inhalt |
| `importance` | über `soft()` im Score | dämpft nur |
| `similarity` | Duplikatfilter (0.6) für Fragen und Impulse | verhindert Wiederholung, nicht Falschrahmung |
| Topic-Affinität (`orb_interests`, `PROACTIVE_MIN_INTEREST_WEIGHT = 0.1`) | schwache Interessen tragen keine Frage | ein falsches Thema erbt die Affinität des *falschen* Themas |
| `novelty` / `asked` | geschlossene und bereits gefragte Lücken entfallen | – |
| `recencyFactor` / Decay | alte Erinnerungen verlieren Relevanz | – |
| Topic-Fix (21.09.) | verhindert neue Fehlzuordnungen durch zu kurze Stämme | **wirkt nicht rückwirkend**: bestehende Knoten behalten ihr falsches Thema (DB-BEWIESEN) |

**Zusatzbefund K6 (DB-BEWIESEN):** Fünf der 15 Produktionsfragen hängen an Fallback-Themen aus dem ersten Inhaltswort: `erzähle`, `faktisch`, `warum`, `korrekt`, `jahre`. Diese sind keine echten Themen; sie entstehen, wenn kein Keyword greift. Sie erhalten dennoch vollen Frage-Status. Der Topic-Fix betrifft diesen Fallback **nicht**.

---

## 10. PRODUCTION COMPARISON (nur gelesen)

**15** gespeicherte autonome Fragen (nicht 13 – zwei weitere am 21.09. um 14:55 und 14:58). Alle 15 haben eine zugehörige `orb_messages`-Zeile mit `question_id`, alle `answered = true`.

| # | Zeitstempel (UTC) | Energy (Snapshot) | Curiosity | Herkunft | Score | Topic | Auffälligkeit |
|---|-------------------|-------------------|-----------|----------|-------|-------|---------------|
| 1 | 19.09. 18:05:13 | 0.618 | 0.7475 | Curiosity | 0.4045 | erzähle | Fallback-Topic (K6) |
| 2 | 19.09. 18:07:15 | 0.504 | 0.7575 | Curiosity | 0.3745 | hardware | – |
| 3 | 20.09. 07:26:12 | **0.000** | 1.0 | **Impulse** P2 | 0.3629 | faktisch | **Energieverletzung**, Fallback-Topic |
| 4 | 21.09. 08:45:31 | 0.1910 | 0.9925 | Curiosity | 0.6425 | reisen | Topic-Fehlzuordnung (historisch) |
| 5 | 21.09. 08:54:27 | 0.1807 | 0.98 | Curiosity | 0.6806 | reisen | dito |
| 6 | 21.09. 08:59:57 | 0.2116 | 1.0 | Curiosity | 0.5995 | hardware | – |
| 7 | 21.09. 09:31:19 | 0.1868 | 1.0 | Curiosity | 0.8357 | korrekt | Fallback-Topic |
| 8 | 21.09. 09:36:44 | 0.1915 | 1.0 | **Impulse** P2 | 0.3629 | warum | Fallback-Topic |
| 9 | 21.09. 09:47:46 | **0.0898** | 1.0 | **Impulse** P2 | 0.3629 | warum | **Energieverletzung** |
| 10 | 21.09. 10:47:23 | 0.1917 | 0.97 | Curiosity | 0.7441 | korrekt | Fallback-Topic |
| 11 | 21.09. 10:49:58 | 0.1573 | 1.0 | Curiosity | 0.6460 | hardware | knapp über 0.15 |
| 12 | 21.09. 11:48:04 | **0.0895** | 1.0 | **Impulse** P1 (contradiction) | 0.2198 | faktisch | **Energieverletzung** |
| 13 | 21.09. 14:17:08 | 0.4160 | 0.985 | Curiosity | 0.4193 | jahre | Fallback-Topic |
| 14 | 21.09. 14:55:54 | 0.2960 | 0.9725 | Curiosity | 0.5045 | reisen | – |
| 15 | 21.09. 14:58:57 | 0.2225 | 0.8975 | Curiosity | 0.4479 | reisen | – |

**Befunde (alle DB-BEWIESEN):**
1. **Energieverletzungen: genau 3**, alle unter 0.15, **alle drei mit `impulse != null`**. Damit ist die Diagnose aus dem Targeted Fix vollständig und präzise bestätigt: die Lücke lag ausschliesslich im Impuls-Zweig. Kein Curiosity-Fall unter 0.15 (Minimum 0.1573).
2. **Score-Konsistenz:** `orb_questions.score` und `state_snapshot.score` sind bei allen 15 identisch – kein Widerspruch. Alle Impuls-Fragen vom Typ `missing_information` tragen exakt `0.3628800…` (deterministischer Wert, Erwartung bestätigt).
3. **Schwellen:** alle Scores ≥ 0.2 (Minimum 0.2198) – `CURIOSITY_ASK_THRESHOLD` / `IMPULSE_MIN_SCORE` nie verletzt.
4. **Energiewerte > 0.25 in vier Fällen** (0.618 / 0.504 / 0.416 / 0.296). Das widerspricht der Erholungsobergrenze **nicht**: 0.25 ist nur die Obergrenze der *Erholung*, nicht des Zustands (`recoverEnergy` steigt nie über 0.25, senkt aber nichts). CODE-BEWIESEN.
5. **Unerwartete Gate-Kombination:** keine. Alle 15 Fälle sind mit dem heutigen Code erklärbar; die drei Energiefälle sind mit dem heutigen Code **nicht mehr möglich**.
6. Keine Änderung an Produktionsdaten.

---

## 11. FAILURE PATHS

| Fehler | Bereits gespeichert | Inkonsistenter Zustand? | Blockiert künftige Fragen? | Klassifikation |
|--------|---------------------|-------------------------|----------------------------|----------------|
| LLM-Timeout / `status != "ok"` | nichts | nein | nein | CODE-BEWIESEN |
| LLM nicht verfügbar (Quota) | nichts | nein | nein | CODE-BEWIESEN |
| Leere Frage (`!spoken.question`) | nichts | nein | nein | CODE-BEWIESEN |
| Duplikat | nichts | nein | nein – aber die *auslösende Lücke bleibt offen* und kann jeden Takt erneut einen LLM-Aufruf erzeugen (Kostenschleife, kein Zustandsfehler) | CODE-BEWIESEN |
| DB-Fehler beim Laden | nichts | nein | nein | CODE-BEWIESEN |
| INSERT `orb_questions` scheitert | nichts | nein | nein | CODE-BEWIESEN |
| INSERT `orb_messages` scheitert | **Frage in `orb_questions` mit `asked_at`, `answered = false`** | **ja** – eine „gestellte“ Frage, die der Nutzer nie gesehen hat | **ja** – `openQuestion` ist gesetzt; bis das Antwortfenster (`ANSWER_WINDOW_MS`) verstreicht, bleiben beide Zweige still. Energie wurde *nicht* abgezogen | CODE-BEWIESEN (K5) |
| UPDATE `orb_state` scheitert | Frage + Nachricht | **ja** – Frage sichtbar, aber ohne Energie-/Neugierkosten; Cooldown greift trotzdem (`asked_at` gesetzt) | nein | CODE-BEWIESEN (K5) |
| INSERT `orb_metrics` scheitert | alles ausser Kennzahl | nein (Kennzahl ist Beobachtung) | nein | **Zusatzbefund:** das Ergebnis dieses INSERT wird **nicht geprüft**; ein Fehler bleibt unbemerkt und ohne `throw` (CODE-BEWIESEN) |
| Ausnahme irgendwo im Erfolgspfad | siehe Zeilen oben | – | – | Der Client fängt sie ab (`onError` → nur `console.error`); `lastProactiveRef` wurde bereits gesetzt, also greift der Client-Cooldown | CODE-BEWIESEN |

**Reihenfolge-Bewertung:** Die aktuelle Ordnung (Frage → Nachricht → Zustand → Kennzahl) ist die riskanteste bezüglich `openQuestion`, weil die Sperrwirkung (`asked_at`) **vor** der Sichtbarkeit entsteht. Eine Umkehrung wäre denkbar, ist aber **nicht Teil dieses Audits**.

---

## 12. TEST COVERAGE

Ausgeführt, nichts verändert: 9 ORB-Testdateien, **147 Tests, alle grün** (TEST-BEWIESEN).

| Ebene | Abdeckung | Bewertung |
|-------|-----------|-----------|
| Unit – reine Entscheidungslogik | `orb-curiosity` (28), `orb-presence` (20), `orb-presence-wait-fix` (11), `orb-autonomy-gate` (16), `orb-energy-recovery` (13), `orb-energy-message-reset` (6), `orb-topic-classification` (22), `orb-memory` (22) | **stark** – jedes Gate ist einzeln geprüft, die Matrixfälle 1–4 und 9–10 direkt |
| Vertragsebene | `orb-sdk-contract` (9) sowie die Quelltextverträge in `orb-autonomy-gate` (Gate vor Formulierung/Persistenz, Ablehnung ohne Tabellenzugriff) | **ausreichend**, aber es sind Textprüfungen, keine Ausführungsprüfungen |
| Integration (DB) | `tests/integration/db-orb-security.test.ts` (RLS, Rechte, Wertegrenzen) | **nur Sicherheit**, keine Ablauf-Integration von `askProactively()` |
| End-to-End | `tests/e2e/` enthält Specs für Feed, Market, Messenger, Navigation, Public/Auth – **keinen ORB-Spec** | **fehlt vollständig** |

**Antwort auf die Kernfrage:** **Nein.** Der aktuelle Testbestand kann **nicht** beweisen, dass eine autonome Frage vom Browser bis zur Persistenz korrekt durchläuft. Bewiesen sind: jedes Gate einzeln, die Reihenfolge der Gates als Quelltextvertrag, die Abwesenheit von Seiteneffekten bei Ablehnung als Quelltextvertrag. Nicht bewiesen: das tatsächliche Zusammenspiel `useOrbPresence` → Server-Function → vier Schreibschritte → sichtbare Nachricht. Dieser Nachweis existiert derzeit ausschliesslich als Produktionsbeobachtung (15 Fragen, DB-BEWIESEN).

---

## 13. CONFIRMED PROBLEMS

| # | Problem | Klasse | Nachweis |
|---|---------|--------|----------|
| K1 | `no_candidate` vor `energy`: Begründung kann irreführen, wenn der Impuls aus Energiegründen nichts liefert | B – Observability/Begründung | CODE-BEWIESEN |
| K2 | `lastImpulseAt: ctx.lastQuestionAt` – der Impuls-Cooldown hat keinen eigenen Zeitanker | D – irreführende, aber funktionierende Kopplung | CODE-BEWIESEN |
| K3 | `presence.noteProactive()` ohne Argumente → clientseitige `asked`-Liste bleibt dauerhaft leer, der Schutz gegen Themen-/Dimensionswiederholung ist wirkungslos | A – toter Code-Pfad | CODE-BEWIESEN |
| K4 | Client-Cooldown nur bei Erfolg; abgelehnte Serverversuche dürfen im 5-Sekunden-Takt wiederholt werden (bei Duplikat inkl. LLM-Kosten) | C – Designfolge mit Kostenrisiko | CODE-BEWIESEN |
| K5 | Vier Schreibschritte ohne Transaktion; Abbruch nach `orb_questions` erzeugt eine unsichtbare, aber sperrende offene Frage | A – echter Konsistenzfehler im Fehlerfall | CODE-BEWIESEN |
| K6 | Fallback-Themen aus dem ersten Inhaltswort („erzähle“, „warum“, „korrekt“, „jahre“, „faktisch“) tragen echte autonome Fragen | A – Fehlklassifizierung, vom Topic-Fix nicht erfasst | DB-BEWIESEN |
| K7 | `orb_metrics`-INSERT wird nicht auf Fehler geprüft | B – Observability | CODE-BEWIESEN |
| K8 | Duplikatprüfung erst nach dem LLM-Aufruf | C – Designentscheidung mit Kostenfolge | CODE-BEWIESEN |
| K9 | Erholungsobergrenze 0.25 liegt nur 0.10 über der Autonomiegrenze 0.15 | E – offen zu bewerten | CODE-BEWIESEN |

---

## 14. CONFIRMED CORRECT BEHAVIOR

1. Genau **eine** finale Freigabe, **vor** Formulierung und **vor** jeder Persistenz (CODE-BEWIESEN, TEST-BEWIESEN).
2. Energie ist nach dem Fix **nicht** mehr umgehbar; Fall 2 der Matrix ist erwiesen (TEST-BEWIESEN) und in Produktion nicht mehr erreichbar (CODE-BEWIESEN).
3. Eine abgelehnte Frage verändert **nichts**: keine Energie, keine Neugier, kein Cooldown, kein Memory, kein Graph, keine Kennzahl, keine Nachricht (CODE-BEWIESEN, TEST-BEWIESEN).
4. Kein doppelter Energieabzug; die Erholung geht an keiner Schreibstelle mehr verloren (CODE-BEWIESEN).
5. Score-Schwellen wurden in Produktion nie verletzt; gespeicherte und geloggte Scores stimmen in allen 15 Fällen überein (DB-BEWIESEN).
6. Herkunft (Curiosity/Impulse) ist für alle 15 Fragen eindeutig rekonstruierbar (DB-BEWIESEN).
7. LLM-Grenze „CODE entscheidet OB, LLM entscheidet WIE“ gilt im autonomen Pfad (CODE-BEWIESEN).
8. Der Ladepfad ist rein lesend – Betrachten verändert kein Gedächtnis (CODE-BEWIESEN).
9. Nutzer-Unterdrückung schlägt jedes andere Gate (CODE-BEWIESEN, TEST-BEWIESEN).

---

## 15. OPEN QUESTIONS

1. Soll `ENERGY_RECOVERY_CAP` (0.25) so nah an `AUTONOMY_MIN_ENERGY` (0.15) bleiben? – **OFFEN** (Produktentscheidung).
2. Soll der Impuls-Cooldown einen eigenen Zeitanker bekommen, oder ist die Kopplung an die letzte Frage gewollt? – **OFFEN**.
3. Soll die Reihenfolge der Schreibschritte geändert (Nachricht vor `asked_at`) oder transaktional zusammengefasst werden? – **OFFEN**.
4. Sollen Fallback-Themen („erstes Inhaltswort“) überhaupt autonome Fragen tragen dürfen, oder wäre `null` korrekter? – **OFFEN**, mit Folgefrage nach den bestehenden Knoten.
5. Ist der mittelbare Einfluss der Analyse-Schicht auf Score-Eingangswerte ausdrücklich gewollt? – **OFFEN**.
6. Soll die Herkunft **abgelehnter** Versuche dauerhaft gespeichert werden (heute nur Rückgabewert + Protokollzeile)? – **OFFEN**.
7. Soll ein End-to-End-Test den Weg Browser → Persistenz absichern? – **OFFEN**.

---

**Es wurde nichts verändert.** Keine Reparatur, kein Refactoring, kein neues Feature, keine Migration, kein Deployment. Die Entscheidung über Reparaturen liegt beim Auftraggeber.
