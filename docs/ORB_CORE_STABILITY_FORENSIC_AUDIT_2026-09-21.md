# ORB CORE – STABILITY & ARCHITECTURE FORENSIC AUDIT

Datum: 2026-09-21 · READ-ONLY · keine Code-, DB-, Test-, Config- oder Deployment-Änderung

Beweisklassen: **CODE-BEWIESEN** (Quellcode gelesen), **DB-BEWIESEN** (Schema/Trigger/Daten
gelesen), **TEST-BEWIESEN** (Test existiert und lief grün), **RUNTIME-BEWIESEN** (Produktionsdaten
gelesen), **WAHRSCHEINLICH**, **OFFEN**. Der SDK Technical Extract wurde ausschliesslich als
Suchhinweis verwendet, nicht als Beweis.

Ausgeführt (nur lesend): `bunx vitest run tests/orb-*.test.ts` → 24 Dateien, 417 Tests, alle grün.

---

## 1. Executive Summary

| # | Befund | Einstufung | Risiko |
|---|---|---|---|
| 1 | `topicOf()` ordnet über beidseitigen Präfixvergleich viele Wörter falsch zu („wandern“ → `reisen`, „Rechnung“ → `hardware`, „Bandage“ → `musik“) | **BUG** (CODE-BEWIESEN) | P1 |
| 2 | Kein Konfidenzwert und kein Fallback für Themen; unbekannte Eingaben erhalten willkürlich das erste Inhaltswort als Thema | **UNSAUBER** (CODE-BEWIESEN) | P1 |
| 3 | Kein einziger abgelehnter autonomer Versuch wird persistiert – keine Zeile, keine Kennzahl, kein Zustand | **UNSAUBER** (CODE-BEWIESEN) | P2 |
| 4 | Herkunft Curiosity/Impulse ist **entgegen der bisherigen Berichtsbehauptung** rekonstruierbar: `orb_messages.state_snapshot.impulse` | **ROBUST** (RUNTIME-BEWIESEN) | – |
| 5 | Der Impulszweig prüft die Energieschwelle nicht und überstimmt eine Curiosity-`WAIT`-Entscheidung | **BUG** (CODE-BEWIESEN) | P1 |
| 6 | `orb_state.updated_at` ist gleichzeitig allgemeiner Zeitanker und Energie-Erholungsanker | **UNSAUBER, aktuell korrekt** (CODE+DB-BEWIESEN) | P3 |
| 7 | Vier Schreibvorgänge auf `orb_questions`/`orb_messages`/`orb_state`/`orb_metrics` ohne Transaktion | **OFFEN/theoretisch** (CODE-BEWIESEN, RUNTIME unauffällig) | P3 |
| 8 | Kein End-to-End-Test des autonomen Fragepfads | **OFFEN** (TEST-BEWIESEN durch Abwesenheit) | P2 |
| 9 | „ORB denkt nach …“ kann nicht hängen bleiben | **ROBUST** (CODE-BEWIESEN) | – |

---

## 2. Topic-Matching-Befund (Priorität hoch)

### 2.1 Reproduktion „wandern“ → `reisen` — CODE-BEWIESEN

Kette, exakt aus `src/orb-core/memory.ts`:

1. `words()` (Z. 221) → `["ich","gehe","wandern"]`
2. `contentTokens()` (Z. 254) filtert `ich` (STOPWORDS) und stemmt
3. `stem()` (Z. 230) prüft Suffixe in fester Reihenfolge; Bedingung
   `w.length - suffix.length >= 4`. Für `wandern`: `ern` passt (7−3 = 4 ≥ 4) → **`wand`**
4. `TOPIC_KEYWORDS.reisen` (Z. 408) enthält `"wander"`
5. `topicOf()` (Z. 422) vergleicht
   `tokens.some((t) => keys.some((k) => t.startsWith(k) || k.startsWith(t)))`
   → `"wander".startsWith("wand") === true` → Thema **`reisen`**

Ausgeführte Reproduktion (reines Lesen der Funktionen, keine Codeänderung):

```
"Ich gehe wandern"  -> tokens ['gehe','wand'] -> topic reisen
"wandern"           -> tokens ['wand']        -> topic reisen
"Ich mag die Wand"  -> tokens ['wand']        -> topic reisen
"Wand streichen"    -> tokens ['wand','strei']-> topic reisen
```

Antwort auf Frage 1: **Ja, aktuell reproduzierbar.** Der Stamm `wand` ist von
„wandern“ und „Wand“ nicht unterscheidbar.

### 2.2 Weitere reproduzierbare Fehlzuordnungen — CODE-BEWIESEN

| Eingabe | Token | Zugeordnetes Thema | Ursache |
|---|---|---|---|
| „Ich mag die Wand“, „Wand streichen“ | `wand` | `reisen` | `wander`.startsWith(`wand`) |
| „Rechnung bezahlen“ | `rechnung` | `hardware` | `rechnung`.startsWith(`rechn`) |
| „Bandage“ | `bandage` | `musik` | `bandage`.startsWith(`band`) |
| „Songtext“ | `songtext` | `musik` | startsWith(`song`) |
| „Autor werden“ | `autor` | `auto` | startsWith(`auto`) |
| „Apitherapie“ | `apitherapie` | `programmierung` | startsWith(`api`) |
| „Modellbau“ | `modellbau` | `ki` | startsWith(`modell`) |
| „Spielzeug“, „Spielplatz“ | `spielzeug` | `gaming` | startsWith(`spiel`) |
| „Tierarzt“, „Katze“ | `tierarzt`, `katze` | `natur` | startsWith(`tier`/`katz`) |
| „Bergpredigt“, „Bergsteigen“ | `bergpredigt` | `reisen` | startsWith(`berg`) |
| „Flugblatt verteilen“ | `flugblatt` | `reisen` | startsWith(`flug`) |
| „Hotelfachfrau werden“ | `hotelfachfrau` | `reisen` | startsWith(`hotel`) |
| „Ich habe einen Reis gekocht“ | `reis` | `reisen` | `reis` ist Schlüsselwort von `reisen` |
| „Koch Müller“ (Nachname) | `koch` | `essen` | Schlüsselwort `koch` |
| „Kinost“ (Tippfehler) | `kinost` | `film` | startsWith(`kino`) |

Zwei Fehlerklassen: **(a)** Schlüsselwort ist Präfix eines fremden Wortes
(`band`→`bandage`), **(b)** Token ist Präfix eines Schlüsselworts
(`wand`→`wander`). Klasse (b) entsteht nur durch die Richtung `k.startsWith(t)`.

### 2.3 Mindestlängen — CODE-BEWIESEN

- Rohwort: `w.length < 3` verworfen (Z. 256)
- Stamm: `s.length < 3` verworfen (Z. 260)
- Stammbildung greift nur, wenn der Rest ≥ 4 Zeichen hat (Z. 245)
- Für den Präfixvergleich selbst gibt es **keine** Mindestlänge und keine
  Mindestüberdeckung → ein 3-Zeichen-Stamm kann ein 8-Zeichen-Schlüsselwort treffen.
  Einstufung: **BUG**.

### 2.4 Konfidenz und Fallback

- **Keine Konfidenz.** `topicOf()` gibt `string | null` zurück; das Thema wird in
  `orb_nodes.topic` gespeichert, ohne Angabe, ob es aus einem Schlüsselwort oder aus
  dem Fallback stammt. **CODE-BEWIESEN.** Einstufung: **UNSAUBER**.
- **Lexikalischer Fallback:** `return tokens[0]` (Z. 424) – das erste Inhaltswort wird
  zum Thema („spare“, „lese“, „reif“, „wandschrank“). Kein semantischer Fallback, keine
  Einbettungen, kein LLM. **CODE-BEWIESEN.** Einstufung: **UNSAUBER** (wächst
  unkontrolliert, aber deterministisch und nicht destruktiv).

### 2.5 Was ein falsches Thema beeinflusst — CODE-BEWIESEN

| Verbraucher | Stelle | Wirkung |
|---|---|---|
| Knotenspeicherung | `engine.server.ts` `processInput` → `orb_nodes.topic` | falsches Thema wird dauerhaft persistiert |
| Interessenmodell | `upsertInterest(…, topic …)` (Z. 705) | Gewicht wächst auf dem falschen Thema |
| Lückenbildung | `deriveKnowledgeGaps` (`curiosity.ts` Z. 183 ff.) filtert über `m.topic` + Interessengewicht | Lücken entstehen/entfallen falsch |
| Gesprächspassung | `conversationTopics = msgRes.data.flatMap(topicsOf)` (Z. 1975) → `conversationalFit` 1 vs. 0.6 | Punktwert um Faktor bis 1.67 verzerrt |
| Frageinhalt | `formulateQuestion` setzt `„Thema {gap.topic}“` in den Prompt (Z. 2173) | LLM fragt sichtbar im falschen Thema |
| Persistenz der Frage | `orb_questions.topic` (Z. 2279) | Falschzuordnung wird Teil der Fragenhistorie |
| Antwortlernen | `closeOpenQuestion` → `upsertInterest(row.topic …)` (Z. 2438) | Fehler verstärkt sich mit jeder Antwort |
| Feed-Vorschläge | `feedRelevance` / `topicsOf` (`memory.ts` Z. 428 ff.) | irrelevante Vorschläge |

`topicsOf()` ist zusätzlich unscharf: es fügt **alle** Token als Pseudo-Themen hinzu
(Z. 434) – für Gesprächspassung unkritisch, für Auswertungen irreführend. **UNSAUBER.**

---

## 3. Autonomous Attempt Observability

### 3.1 Zählregel (zuerst definiert)

Als *Ablehnungspunkt* zählt genau eine Stelle im Quellcode, die im autonomen Pfad
eine Entscheidung „keine Frage“ zurückgibt (`return no(...)`, `return out("WAIT"/"DO_NOTHING", …)`,
`return silent(...)`, `return silent(reason)` im Impulszweig) **oder** einen Kandidaten
vor der Bewertung verwirft (`continue`). Stille Vorfilter (`continue`) werden getrennt
gezählt, weil sie keine benennbare Begründung erzeugen.

Gezählt nach dieser Regel: **9 Client-Gates** (`presence.ts` `shouldAskProactively`,
davon 1 – `hasCandidate` – im Client konstant `true`), **6 Server-Gates**
(`decideCuriosity`), **5 Impulse-Gates** (`decideImpulse`), **4 Gates in
`askProactively`** = **24 benennbare Ablehnungspunkte**; zusätzlich **7 stille
Vorfilter** (`continue`) in `deriveKnowledgeGaps` und `decideImpulse`.
Die frühere Zahl „24/25“ ist ohne Zählregel nicht prüfbar; mit dieser Regel ergibt
sich 24 + 7. **CODE-BEWIESEN.**

### 3.2 Tabelle

| Gate | Datei/Stelle | Entscheidung | Reason vorhanden | Persistiert? | DB-Spur? | später rekonstruierbar? |
|---|---|---|---|---|---|---|
| Tab nicht sichtbar | presence.ts 106 | kein Aufruf | ja (nur UI-Status) | nein | nein | nein |
| Benutzer tippt | presence.ts 107 | kein Aufruf | ja | nein | nein | nein |
| Mikrofon aktiv | presence.ts 108 | kein Aufruf | ja | nein | nein | nein |
| ORB spricht | presence.ts 109 | kein Aufruf | ja | nein | nein | nein |
| Anfrage läuft | presence.ts 110 | kein Aufruf | ja | nein | nein | nein |
| < 40 s Leerlauf | presence.ts 111 | kein Aufruf | ja | nein | nein | nein |
| > 15 min Leerlauf | presence.ts 114 | kein Aufruf | ja | nein | nein | nein |
| Neugier `low` | presence.ts 117 | kein Aufruf | ja | nein | nein | nein |
| Client-Cooldown | presence.ts 121 | kein Aufruf | ja | nein | nein | nein |
| keine Lücke | curiosity.ts 279 | DO_NOTHING | ja | nein | nein | nein |
| Neugier `low` (Server) | curiosity.ts 282 | DO_NOTHING | ja | nein | nein | nein |
| Energie < 0.15 | curiosity.ts 285 | WAIT | ja | nein | nein | nein |
| offene Frage | curiosity.ts 288 | WAIT | ja | nein | nein | nein |
| Server-Cooldown | curiosity.ts 293 | WAIT | ja | nein | nein | nein |
| Wert < 0.2 | curiosity.ts 297 | WAIT | ja | nein | nein | nein |
| Suppression | impulse.ts 216 | STAY_SILENT | ja | **nein** (`rememberPreference` wird zurückgegeben, aber in `askProactively` nicht gespeichert) | nein | nein |
| offene Frage (Impuls) | impulse.ts 217 | STAY_SILENT | ja | nein | nein | nein |
| Impuls-Cooldown | impulse.ts 221 | STAY_SILENT | ja | nein | nein | nein |
| kein Kandidat | impulse.ts 227 | STAY_SILENT | ja | nein | nein | nein |
| Wert < 0.2 (Impuls) | impulse.ts 228 | STAY_SILENT | ja | nein | nein | nein |
| Suppression (Gesamt) | engine 2247 | `asked:false` | ja | nein | nein | nein |
| beide still | engine 2250 | `asked:false` | ja | nein | nein | nein |
| LLM-Fehler / leere Frage | engine 2259 | `asked:false` | ja (Text pauschal) | nein | nein | nein |
| Duplikat | engine 2270 | `asked:false` | ja | nein | nein | nein |
| stille Vorfilter (7×) | curiosity.ts 184–207, impulse.ts 171–180 | Kandidat verworfen | **nein** | nein | nein | nein |

Für **jede** Zeile gilt CODE-BEWIESEN: es entsteht ausschliesslich ein
Rückgabeobjekt (`OrbProactiveResult`). Kein `orb_questions`-, `orb_messages`- oder
`orb_metrics`-Eintrag; `orb_state` bleibt unverändert (die einzige Schreibstelle im
Snapshot-Pfad betrifft `decay_computations`, nicht den Versuch). Die Begründung
existiert nur bis zum Ende des Requests und danach nur im Client-State
`lastAutonomyAttempt` (`channels.orb.tsx` 227) – nach einem Neuladen verloren.
**Einstufung: UNSAUBER, P2.**

### 3.3 „ORB denkt nach …“ bei `asked=false` — CODE-BEWIESEN

`OrbChat.tsx` 163 rendert den Hinweis an `pending`; `pending` ist
`sendMutation.isPending || curiosityMutation.isPending` (`channels.orb.tsx` 262).
Es gibt keinen eigenen Zustandsschalter. `onSuccess` läuft auch bei `asked=false`
(setzt nur `lastAutonomyAttempt` und kehrt zurück), `onError` loggt.
In beiden Fällen endet `isPending` → **kein hängender UI-Zustand möglich: ROBUST.**
Nebenbefund (**UNSAUBER**): der Hinweis erscheint auch für einen Versuch, der
danach lautlos abbricht – der Benutzer sieht „denkt nach“ ohne Ergebnis.

---

## 4. Curiosity vs. Impulse

### 4.1 Herkunft

**Widerspruch zu früheren Berichten (dort: „nicht gespeichert“).** Tatsächlich:

- `orb_messages.state_snapshot.impulse` ist `{type, priority, form}` bei Impuls und
  `null` bei Curiosity (`engine.server.ts` 2309). **CODE-BEWIESEN.**
- Produktionsdaten bestätigen beide Formen: 2026-09-21 11:48:03 →
  `{form:question, priority:P1, type:contradiction}`; 10:49:57 und 10:47:22 → `null`.
  **RUNTIME-BEWIESEN.**
- `orb_questions` allein genügt **nicht**: keine Herkunftsspalte; `gap_kind` ist bei
  Impuls konstant `"kontext"` (Z. 2139) und `reason` nur Freitext. **CODE-BEWIESEN.**
- `orb_metrics` kennt nur `kind='proactive'`, keine Herkunft. **CODE-BEWIESEN.**

Fehlend ist also nur eine Herkunftsspalte in `orb_questions`; der Nachweis ist über
`state_snapshot.question_id` → `orb_questions.id` verknüpfbar. **Einstufung: ROBUST
mit Einschränkung** (Rekonstruktion erfordert Join über zwei Tabellen).

### 4.2 Entscheidungsmatrix — CODE-BEWIESEN (`engine.server.ts` 2232–2253)

| Curiosity | Impulse | Ergebnis | Begründung im Code |
|---|---|---|---|
| beliebig | `suppressed` | **keine Frage** | Z. 2247 vor allem anderen |
| WAIT (z. B. Energie < 0.15) | SPEAK | **Impuls fragt** | `impulse` ist gesetzt, Z. 2250 greift nicht; `gap = gapFromImpulse(...)` |
| WAIT | STAY_SILENT | keine Frage | Z. 2250 |
| DO_NOTHING | SPEAK | **Impuls fragt** | wie oben |
| DO_NOTHING | STAY_SILENT | keine Frage | Z. 2250 |
| ASK | SPEAK | **Impuls gewinnt** | `gap = impulse ? gapFromImpulse : decision.gap` – Curiosity-Lücke wird verworfen |
| ASK | STAY_SILENT | **Curiosity fragt** | Z. 2251 Fallback |

Zwei Befunde:

1. **BUG (P1):** Der Impulszweig prüft `energy` nicht (`impulse.ts` hat keinen
   Energiebezug). Damit kann ORB sprechen, während der Neugierzweig wegen
   `energy < CURIOSITY_MIN_ENERGY` wartet – die Energieschwelle ist im Gesamtpfad
   nicht wirksam. Kosten werden anschliessend trotzdem abgezogen (Z. 2325).
2. **UNSAUBER:** Bei `ASK` + `SPEAK` gewinnt immer der Impuls, unabhängig vom
   Punktwert. `silent()` meldet aber weiterhin `decision.*` (Z. 2236–2241), d. h. die
   Begründung einer Ablehnung kann aus dem *anderen* Zweig stammen.

---

## 5. Energy Time Anchor

`orb_state` hat keine eigene Energie-Zeitspalte (Spalten: `curiosity, joy, fear, trust,
uncertainty, energy, goals, cracks, reactivation_count, decay_computations, created_at,
updated_at`). **DB-BEWIESEN.** Trigger: `orb_state_updated_at BEFORE UPDATE … EXECUTE
FUNCTION set_updated_at()` – einziger Trigger. **DB-BEWIESEN.**
`toState()` (Z. 258) berechnet `recoverEnergy(row.energy, row.updated_at, Date.now())`.
→ `updated_at` ist **gleichzeitig** allgemeiner Zeitanker (A) und Energieanker (B).
**CODE + DB-BEWIESEN.**

Alle Schreibstellen auf `orb_state`:

| Stelle | Felder | energy mitgeschrieben? | updated_at ändert sich | Verlust von Erholungszeit? |
|---|---|---|---|---|
| 278 `ensureState` INSERT | Defaults | n/a (INSERT) | setzt `created_at/updated_at` | nein |
| 415 `getSnapshot` UPDATE | `decay_computations`, `energy` | **ja** (`toState(stateRow).energy`) | ja | nein (Fix wirksam) |
| 1494 `processInput` UPDATE | 5 Gefühlswerte, `energy`, `cracks`, `reactivation_count` | **ja** (`updated.energy`, aus erholter Basis) | ja | nein |
| 1733 `recordLearning` UPDATE | `cracks`, `fear`, `uncertainty`, `energy` | **ja** (`toState(stateRow).energy`) | ja | nein |
| 2323 `askProactively` UPDATE | `curiosity`, `energy` | **ja** (`ctx.state.energy − 0.03`, erholte Basis) | ja | nein |

Keine weiteren `orb_state`-Zugriffe im Repository (`grep` über `src/`). **CODE-BEWIESEN.**

**Risiko (P3, UNSAUBER):** Die Korrektheit hängt an einer Konvention, nicht an einer
Invariante. Eine künftige UPDATE-Stelle, die `energy` weglässt (z. B. nur `goals`
setzen), setzt `updated_at` neu und lässt die bereits verstrichene Ruhezeit verfallen –
genau der am 2026-09-21 behobene Fehler entsteht neu. Es gibt weder einen Datenbank-
Schutz noch einen Test, der neue Schreibstellen erfasst; der bestehende Test prüft nur
`orb_state`-Updates innerhalb von `engine.server.ts` (`tests/orb-energy-message-reset.test.ts`
Z. 16–23, textbasiert). **TEST-BEWIESEN (begrenzte Reichweite).**

---

## 6. Persistence / Atomicity

Reihenfolge in `askProactively` — CODE-BEWIESEN:

| Schritt | Zeile | Fehler dort | bereits geschrieben | möglicher inkonsistenter Zustand |
|---|---|---|---|---|
| 1 `formulateQuestion` | 2257 | LLM-Fehler → `silent()` | nichts | keiner |
| 2 Duplikatprüfung | 2264 | – | nichts | keiner |
| 3 `orb_questions` INSERT | 2273 | `throw` | nichts | keiner |
| 4 `orb_messages` INSERT | 2292 | `throw` | Frage-Zeile | **Frage existiert, aber kein Chatverlauf**; `answered=false` blockiert über `findOpenQuestion` alle weiteren autonomen Fragen im Antwortfenster; Benutzer sieht nie eine Frage |
| 5 `orb_state` UPDATE | 2320 | `throw` | Frage + Nachricht | Frage sichtbar, aber **keine Energie-/Neugierkosten** und kein neuer `updated_at`; Cooldown greift trotzdem über `asked_at` |
| 6 `orb_metrics` INSERT | 2340 | Fehler wird **nicht geprüft** (kein `.error`-Check) | alles Fachliche | nur Kennzahl fehlt; fachlich konsistent |
| 7 `getSnapshot` | 2360 | `throw` | alles | Frage ist gespeichert, Client erhält Fehler → Frage erscheint erst beim nächsten Laden |

**Keine Transaktion** – jeder Schritt ist ein eigener PostgREST-Aufruf; es gibt kein
RPC, das die vier Schreibvorgänge bündelt. **CODE-BEWIESEN.**

Bewertung: aktuell **theoretisches** Risiko. Produktionsstand:
`orb_questions = 12`, proaktive `orb_messages = 12`, `orb_metrics(kind='proactive') = 12`,
unbeantwortete Fragen `= 0` – keine verwaiste Zeile. **RUNTIME-BEWIESEN.**
Der Schritt-4-Fall wäre allerdings selbstverstärkend (dauerhafte Blockade des autonomen
Pfads bis zum Ablauf des Antwortfensters) → P3 mit Aufstiegspotenzial, nicht P0.

---

## 7. Test Coverage

Vorhanden: 24 ORB-Testdateien, 417 Tests, alle grün (nur gelesen/ausgeführt).
Kein Test importiert `engine.server.ts` funktional; `tests/orb-energy-message-reset.test.ts`
liest die Datei nur als Text. **TEST-BEWIESEN.**

| Kette | Abdeckung | Beleg |
|---|---|---|
| Energy Recovery (`recoverEnergy`) | **A vollständig** | `orb-energy-recovery.test.ts` (13) |
| Energy-Reset durch Nachricht | **B teilweise** (Formel ja, DB-Verhalten nur als Textprüfung) | `orb-energy-message-reset.test.ts` (6) |
| `decideCuriosity` Gates | **A vollständig** (alle 6 Gates) | `orb-curiosity.test.ts`, `orb-presence-wait-fix.test.ts` |
| `shouldAskProactively` | **A vollständig** | `orb-presence.test.ts` |
| `decideImpulse` | **A vollständig** (Logik) | `orb-proactive-impulse.test.ts` (31) |
| Memory/Topic | **B teilweise** – Themen positiv getestet, **kein** Test auf Fehlzuordnung („wand“) | `orb-memory.test.ts` 79–84 |
| Recall/Relevanz | **A vollständig** | `orb-memory-recall-fix.test.ts`, `orb-memory.test.ts` |
| `formulateQuestion` / LLM-Grenze | **C nicht getestet** | – |
| Duplikatprüfung im Serverpfad | **B teilweise** (`isDuplicateQuestion` unit, nicht im Pfad) | `orb-curiosity.test.ts` |
| Curiosity↔Impulse-Vorrang in `askProactively` | **C nicht getestet** | – |
| Persistenzreihenfolge / Atomicity | **C nicht getestet** | – |
| Presence → Server → … → Metric (E2E) | **C nicht getestet** | – |

---

## 8. End-to-End Matrix (statisch aus dem Code abgeleitet)

| # | Zustand/Eingabe | Curiosity | Impulse | endgültig | Persistenz | sichtbar | rekonstruierbar |
|---|---|---|---|---|---|---|---|
| 1 | energy 0.10, Lücke stark | WAIT | STAY_SILENT | keine Frage | keine | „denkt nach“, dann nichts | nein |
| 2 | energy 0.20, Lücke ≥ 0.2, kein Cooldown | ASK | STAY_SILENT | **Frage (Curiosity)** | Q+M+State+Metric | Frage im Chat | ja (`impulse:null`) |
| 3 | energy 0.10, Impulskandidat P1 | WAIT | SPEAK | **Frage (Impuls)** – Energiegate umgangen | Q+M+State+Metric | Frage im Chat | ja (`impulse:{…}`) |
| 4 | Nutzer: „nicht jetzt“ | beliebig | suppressed | keine Frage | keine – `rememberPreference` wird verworfen | nichts | nein |
| 5 | offene unbeantwortete Frage | WAIT | STAY_SILENT | keine Frage | keine | nichts | indirekt über `orb_questions.answered=false` |
| 6 | letzte Frage vor 60 s, Band `high` (180 s) | WAIT | STAY_SILENT | keine Frage | keine | nichts | indirekt über `asked_at` |
| 7 | Formulierung ≈ frühere Frage (≥ 0.6) | ASK | – | keine Frage | keine (LLM-Kosten bereits angefallen) | nichts | nein |
| 8 | LLM nicht verfügbar | ASK | – | keine Frage | keine | nichts | nein |
| 9 | LLM liefert leeren Text | ASK | – | keine Frage | keine | nichts | nein |
| 10 | Curiosity WAIT + Impulse SPEAK | WAIT | SPEAK | Impuls fragt | vollständig | Frage | ja |
| 11 | Curiosity ASK + Impulse SPEAK | ASK | SPEAK | **Impuls gewinnt**, Curiosity-Lücke verworfen | vollständig | Frage | ja |
| 12 | beide still | WAIT/DO_NOTHING | STAY_SILENT | keine Frage | keine | nichts | nein |
| 13 | erfolgreicher Durchlauf | ASK | STAY_SILENT | Frage | Q+M+State(−0.03/−0.06)+Metric | Frage + TTS | ja |

Zeilen 1–13 sind CODE-BEWIESEN (statische Ableitung); Zeilen 2, 3, 11, 13 zusätzlich
RUNTIME-BEWIESEN durch die 12 vorhandenen Produktionsfragen (beide Herkunftsformen belegt).

---

## 9. Risiko-Priorisierung

**P0 – Datenintegrität/Kernlogik:** keine Befunde. Kein Pfad löscht, überschreibt oder
verfälscht bestehende Knoten; `VERGESSEN ≠ LÖSCHEN` gilt im gelesenen Code.

**P1-1 Falsche Themenzuordnung durch beidseitigen Präfixvergleich**
· Beweis: `memory.ts` 422/432 + reproduzierte Liste (Abschnitt 2.2)
· Auswirkung: falsche Knotenthemen, falsche Interessen, sichtbar falsche autonome Fragen
· Richtung (nicht umgesetzt): Richtung `k.startsWith(t)` entfernen oder an eine
Mindestlänge/Mindestüberdeckung binden; Themenherkunft als Konfidenz mitspeichern.

**P1-2 Impulszweig ohne Energiegate und mit Vorrang vor Curiosity**
· Beweis: `impulse.ts` (kein `energy`-Feld in `ImpulseDecisionInput`), `engine.server.ts` 2251
· Auswirkung: ORB spricht, während der Neugierzweig ausdrücklich `WAIT` sagt
· Richtung: Energieschwelle vor der Zweigwahl prüfen, Vorrang explizit über Punktwert.

**P2-1 Kein persistierter Versuch**
· Beweis: Tabelle 3.2, jede Zeile „Persistiert? nein“
· Auswirkung: Ablehnungen sind nach dem Request nicht mehr nachweisbar; Live-Beobachtung
bleibt Momentaufnahme
· Richtung: bestehende `orb_metrics`-Tabelle für abgelehnte Versuche mitnutzen (keine neue Fähigkeit).

**P2-2 Kein End-to-End-Test des autonomen Pfads**
· Beweis: Abschnitt 7 · Richtung: ein Test gegen `fake-supabase` über `askProactively`.

**P3-1 Doppelrolle von `updated_at`** (Abschnitt 5) · Richtung: eigener Zeitanker oder Test,
der jede `orb_state`-Schreibstelle repo-weit erfasst.

**P3-2 Vier Schreibvorgänge ohne Transaktion** (Abschnitt 6) · Richtung: nur beobachten,
solange keine verwaisten Zeilen auftreten.

**P3-3 `orb_questions` ohne Herkunftsspalte** (Abschnitt 4.1) · Richtung: Spalte nur falls
Auswertung ohne Join gebraucht wird.

**P4 Kosmetisch:** „ORB denkt nach …“ ohne sichtbares Ergebnis bei stiller Ablehnung;
`topicsOf()` liefert Token als Pseudo-Themen.

---

## 10. Was NICHT problematisch ist

- **Energie-Erholung selbst:** reine Zeitfunktion, aufrufunabhängig, gedeckelt bei 0.25,
  Werte über dem Cap werden nicht gesenkt. CODE- und TEST-BEWIESEN.
- **Alle vier `orb_state`-Schreibstellen schreiben `energy` mit** – der Fehler vom
  2026-09-21 ist im aktuellen Stand nicht mehr reproduzierbar. CODE-BEWIESEN.
- **„ORB denkt nach …“** kann nicht hängen bleiben (abgeleiteter Zustand). CODE-BEWIESEN.
- **Herkunft Curiosity/Impulse** ist rekonstruierbar. RUNTIME-BEWIESEN.
- **Duplikatschlüssel `normKey`** ist bewusst konservativ; keine unscharfe Fusion.
  TEST-BEWIESEN (`orb-memory.test.ts` 39–76).
- **Keine autonomen sozialen Aktionen**: `*_SOCIAL_ACTIONS_ENABLED = false`,
  `ACTIVE_AUTONOMY_LEVEL = 2`, Scope `orb_core_chat_only`. CODE- und TEST-BEWIESEN.
- **Kein Server-Polling:** ein 5-s-Client-Intervall, reine Rechenarbeit; Serveraufruf nur
  bei erfülltem Verdict. CODE-BEWIESEN.
- **Produktionsdaten aktuell konsistent** (12/12/12, 0 offene Fragen). RUNTIME-BEWIESEN.

---

## 11. Was noch offen ist

1. **OFFEN:** Welches Gate den beobachteten Versuch um 11:30 ablehnte – nicht persistiert,
   nicht rekonstruierbar.
2. **OFFEN:** Wie häufig Themen in der Produktion falsch zugeordnet sind. Prüfbar wäre nur
   eine Stichprobe von `orb_nodes.content` gegen `topic`; nicht Teil dieses Audits.
3. **OFFEN:** Ob der Impulszweig in der Produktion je bei `energy < 0.15` gesprochen hat –
   `orb_messages.state_snapshot.energy` enthält den Wert, die Zweigherkunft ebenfalls; die
   Auswertung wurde hier nicht durchgeführt.
4. **OFFEN:** Verhalten bei gleichzeitigen Aufrufen (zwei Tabs) – kein Sperrmechanismus
   gelesen, kein Nachweis eines Problems. **WAHRSCHEINLICH** unkritisch wegen Client-Cooldown.
5. **WAHRSCHEINLICH:** `rememberPreference` („nie wieder fragen“) wird nie gespeichert,
   d. h. eine dauerhafte Nutzerpräferenz wirkt nur solange die Äusserung im 8-Nachrichten-Fenster liegt.
   CODE-BEWIESEN, dass nichts gespeichert wird; Nutzerwirkung nicht gemessen.

---

## 12. Empfohlene Reihenfolge für spätere Reparaturen (nicht umgesetzt)

1. P1-2 Energiegate/Vorrang im autonomen Pfad (kleinste Änderung, grösste Verhaltenswirkung)
2. P1-1 Präfixvergleich der Themenerkennung + Themenherkunft
3. P2-2 ein End-to-End-Test, der 1 und 2 absichert
4. P2-1 Versuchsprotokollierung über die bestehende Kennzahltabelle
5. P3-1 Absicherung der `orb_state`-Schreibkonvention
6. Danach neu bewerten; P3-2/P3-3/P4 vorerst nicht anfassen.

---

## Diese 3 Dinge würde ich als erstes reparieren

1. **Energiegate im Impulszweig** – ORB spricht heute, obwohl der Neugierzweig `WAIT` sagt.
2. **`k.startsWith(t)` in `topicOf`/`topicsOf`** – erzeugt reproduzierbar falsche Themen
   („wandern“/„Wand“ → `reisen`, „Rechnung“ → `hardware`).
3. **Ein End-to-End-Test des autonomen Fragepfads** – derzeit ist kein einziger Schritt
   dieses Pfads im Zusammenhang getestet.

## Diese Dinge würde ich ausdrücklich NICHT anfassen

- `recoverEnergy`, Rate 0.02/min, Cap 0.25, Kosten 0.03 – bewiesen korrekt und getestet.
- Die vier `orb_state`-Schreibstellen in ihrer jetzigen Form.
- `normKey`/Duplikatlogik – bewusst konservativ.
- Schwellen `CURIOSITY_ASK_THRESHOLD`, `IMPULSE_MIN_SCORE`, Cooldowns, Idle-Grenzen.
- Der abgeleitete „denkt nach“-Zustand.
- Die Autonomiegrenzen (Level 2, keine sozialen Aktionen, Scope).
- `orb_nodes`-Daten, insbesondere der verwaiste Knoten „lieblingsess-merke“.

---

Files changed: 0 · Database changes: 0 · Migrations: 0 · Deployments: 0 ·
Configuration changes: 0 · Tests changed: 0 · Tests ausgeführt (lesend): 417 grün
