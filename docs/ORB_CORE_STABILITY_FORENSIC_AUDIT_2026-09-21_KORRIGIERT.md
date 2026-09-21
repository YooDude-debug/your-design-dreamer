# ORB CORE – STABILITY & ARCHITECTURE FORENSIC AUDIT (KORRIGIERTE FASSUNG)

Datum: 2026-09-21 · READ-ONLY · keine Code-, Test-, DB-, Migrations- oder Deployment-Änderung
Ersetzt inhaltlich: `docs/ORB_CORE_STABILITY_FORENSIC_AUDIT_2026-09-21.md` (Original bleibt unverändert erhalten)

Beweisklassen: **CODE-BEWIESEN** (Quellcode gelesen), **DB-BEWIESEN** (Schema/Daten gelesen),
**RUNTIME-BEWIESEN** (Produktionsdaten gelesen), **TEST-BEWIESEN**, **WAHRSCHEINLICH**, **OFFEN**.
Frühere Berichte (SDK-Extract, Master-Report, Ur-Audit) gelten in dieser Fassung **nicht** als Beweis.
Alle Aussagen unten wurden gegen Primärquellen neu geprüft.

Durchgeführte Prüfhandlungen (alle lesend): Quellcode `src/orb-core/memory.ts`, `curiosity.ts`,
`impulse.ts`, `presence.ts`, `engine.server.ts`, `src/integrations/y-dude-orb/use-orb-presence.ts`;
Ausführung der echten `topicOf()`/`topicsOf()`-Implementierung mit 30 Eingaben in einem Wegwerf-Skript
unter `/tmp` (keine Projektdatei angelegt oder verändert); SQL-Leseabfragen auf `orb_messages`,
`orb_questions`, `orb_metrics` (Produktion).

Änderungsbilanz dieses Auftrags: **0 Code-Dateien, 0 Tests, 0 DB-Objekte, 0 Migrationen, 0 Deployments.**

---

## 0. Begriffstrennung (verbindlich für diesen Bericht)

| Klasse | Bedeutung |
|---|---|
| **A) ECHTER LOGIKFEHLER** | Der Code tut etwas, das der eigenen dokumentierten Regel widerspricht |
| **B) OBSERVABILITY-PROBLEM** | Verhalten ist korrekt, aber nachträglich nicht belegbar |
| **C) DESIGNENTSCHEIDUNG** | Bewusst so gebaut, nachvollziehbar, kein Fehler |
| **D) REKONSTRUIERBAR, NICHT DIREKT GESPEICHERT** | Information existiert, nur nicht als eigenes Feld |
| **E) OFFENER BEFUND** | Nicht abschliessend geklärt |

---

## 1. KORREKTUR GEGENÜBER DEM VORHERIGEN AUDIT – Nr. 1A: Impulse ohne Energieprüfung

**Ergebnis: BESTÄTIGT. Klasse A (echter Logikfehler). CODE-BEWIESEN + RUNTIME-BEWIESEN.**

### 1.1 Primärquellen

`src/orb-core/curiosity.ts`
- Z. 150: `export const CURIOSITY_MIN_ENERGY = 0.15;`
- Z. 244–253 `CuriosityDecisionInput` enthält `energy: number`
- Z. 285–287: `if (input.energy < CURIOSITY_MIN_ENERGY) return out("WAIT", "Zu wenig Energie – ORB wartet.")`

`src/orb-core/impulse.ts`
- Z. 129–148 `ImpulseDecisionInput`: Felder `gaps, curiosity, conversationTopics, recentUserTexts,
  storedPreference, previousImpulses, knownAnswers, openQuestion, lastImpulseAt, now`.
  **Es existiert kein Feld `energy`.**
- Z. 163–240 `decideImpulse()`: keine Referenz auf Energie irgendeiner Art (verifiziert per Volltextsuche
  `rg -n "energy" src/orb-core/impulse.ts` → 0 Treffer).

`src/orb-core/engine.server.ts` – Zusammenführung in `askProactively()`
- Z. 2209–2216: `decideCuriosity({ curiosity, energy, gaps, lastQuestionAt, openQuestion, now })`
- Z. 2221–2231: `decideImpulse({ … })` – ohne Energie
- Z. 2232: `const impulse = impulseDecision.action === "SPEAK" ? impulseDecision.impulse : null;`
- Z. 2247: `if (impulseDecision.suppressed) return silent(impulseDecision.reason);`
- Z. 2250: `if (!impulse && (decision.action !== "ASK" || !decision.gap)) return silent(decision.reason);`

### 1.2 Bewiesene Kausalität

Zeile 2250 prüft die Curiosity-Entscheidung nur dann, wenn **kein** Impuls vorliegt (`!impulse`).
Liegt ein Impuls vor, wird die Curiosity-Entscheidung – einschliesslich `WAIT` wegen
`energy < 0.15` – vollständig übersprungen. Anschliessend wird die Frage formuliert, gespeichert
und in Z. 2320–2328 wird trotzdem Energie abgezogen (`energy: Math.max(0, ctx.state.energy - 0.03)`).

Daraus folgt: Der Energie-Gate ist für den Impulszweig **wirkungslos**, und die Energie kann durch
Impulsfragen weiter absinken, während der Curiosity-Zweig bereits „wartet“.

### 1.3 Produktionsbeweis (RUNTIME-BEWIESEN)

`orb_messages` mit `state_snapshot->>'proactive' = 'true'`, Feld `state_snapshot.energy` ist der
Energiewert **vor** dem Abzug:

| created_at (UTC) | energy vorher | impulse-Feld | Curiosity hätte entschieden |
|---|---|---|---|
| 2026-09-21 11:48:03.567 | **0.0895** | `{type: contradiction, priority: P1, form: question}` | `WAIT` (Energie < 0.15) |
| 2026-09-21 09:47:46.357 | **0.0898** | `{type: missing_information, priority: P2}` | `WAIT` (Energie < 0.15) |
| 2026-09-20 07:26:11.726 | **0.0** | `{type: missing_information, priority: P2}` | `WAIT` (Energie < 0.15) |

Drei reale Fälle, in denen eine autonome Frage gestellt wurde, obwohl die Energie unterhalb der
eigenen Schwelle lag. Der Fehler ist damit nicht theoretisch, sondern **in Produktion eingetreten**.

Klassifikation: **A) ECHTER LOGIKFEHLER**, Risiko **P1** (falsches autonomes Verhalten).
**Keine Reparatur durchgeführt.**

---

## 2. KORREKTUR/PRÄZISIERUNG – Nr. 1B: Bidirektionales Topic-Matching

**Ergebnis: BESTÄTIGT, alle drei Fälle reproduziert. Klasse A (deterministischer Fehlklassifizierungsfehler). CODE-BEWIESEN.**

Matching-Bedingung, `src/orb-core/memory.ts` Z. 422 (identisch in `topicsOf()` Z. 432):

```ts
if (tokens.some((t) => keys.some((k) => t.startsWith(k) || k.startsWith(t)))) return topic;
```

Der zweite Teil `k.startsWith(t)` vergleicht das **Keyword** gegen das **kürzere Token** – dadurch
genügt ein gemeinsamer Wortanfang von nur 3 Zeichen (Mindestlänge aus `contentTokens()` Z. 257/260).

### 2.1 Reproduktion der drei gemeldeten Fälle (gegen den laufenden Code ausgeführt)

| # | Input | Tokenisierung (`words`) | Stem (`stem`) | Content Token | Keyword | Bedingung | Topic |
|---|---|---|---|---|---|---|---|
| 1 | „Ich gehe wandern“ | ich, gehe, wandern | `wandern` → Suffix `ern`, 7−3=4 ≥ 4 → `wand` | `["gehe","wand"]` | `reisen: "wander"` | `k.startsWith(t)`: `"wander".startsWith("wand")` → true | **reisen** |
| 2 | „Die Rechnung war hoch“ | die, rechnung, war, hoch | `rechnung` → Suffix `n`, 8−1=7 ≥ 4 → `rechnung`→`rechnun`… Ausgabe des Codes: Token `rechnung` | `["rechnung","hoch"]` | `hardware: "rechn"` | `t.startsWith(k)`: `"rechnung".startsWith("rechn")` → true | **hardware** |
| 3 | „Ich brauche eine Bandage“ | ich, brauche, eine, bandage | kein Suffix greift → `bandage` | `["bandage"]` | `musik: "band"` | `t.startsWith(k)`: `"bandage".startsWith("band")` → true | **musik** |

Hinweis zu Fall 2: der tatsächliche Code-Output ist `tokens = ["rechnung","hoch"]`; das Topic
entsteht hier über die **Vorwärts**richtung (`t.startsWith(k)`), nicht über die Rückwärtsrichtung.
Die Fehlzuordnung ist damit nicht ausschliesslich Folge der Bidirektionalität, sondern auch der
zu kurzen/zu generischen Keywords (`rechn`, `band`, `berg`, `reis`). Das ist eine **Präzisierung**
gegenüber der Auftragsannahme, die alle drei Fälle allein dem bidirektionalen Vergleich zuschreibt.

### 2.2 Weitere reproduzierbare Fehlzuordnungen (Code-Ausgabe, wörtlich)

| Input | Topic laut Code | Ursache |
|---|---|---|
| „Die Wand ist weiss“ | `reisen` | `"wander".startsWith("wand")` (rückwärts) |
| „Bandbreite ist gross“ | `musik` | `band` |
| „Bandscheibe“ | `musik` | `band` |
| „Bandnudeln“ | `musik` | `band` |
| „Bandana“ | `musik` | `band` |
| „Der Reis war lecker“ | `reisen` | `reis` |
| „Reisszwecke“ | `reisen` | `reis` |
| „Bergpredigt“ | `reisen` | `berg` |
| „Bergwerk“ | `reisen` | `berg` |
| „Rechner“ | `hardware` | `rechn` (hier korrekt) |
| „Rechnungswesen“ | `hardware` | `rechn` |
| „Spielzeugauto“ | `gaming` | `spiel` (statt `auto`) |
| „Spielplatz“ | `gaming` | `spiel` |
| „Waldbrand“ | `natur` | `wald` (korrekt), aber `brand` wäre ebenso greifbar |
| „Wandtattoo“ | `wandtattoo` | kein Keyword-Treffer → Fallback erstes Token (Z. 424) |

Weitere geprüfte Eigenschaften:

- **Mindestlänge der verglichenen Stämme**: 3 Zeichen (`contentTokens()` Z. 257 und Z. 260).
  Keine Mindestlänge für die **Übereinstimmung** – ein 3-Zeichen-Präfix reicht. CODE-BEWIESEN.
- **Konfidenz**: existiert nicht. `topicOf()` gibt `string | null` zurück, ohne Sicherheitsmass. CODE-BEWIESEN.
- **Semantischer Fallback**: existiert nicht. Lexikalischer Fallback = erstes Inhaltswort (Z. 424),
  d. h. auch ein Füllrest kann Thema werden. CODE-BEWIESEN.
- **Reihenfolgeabhängigkeit**: `Object.entries(TOPIC_KEYWORDS)` – das erste passende Topic in
  Deklarationsreihenfolge gewinnt (`hardware` vor `gaming` vor … vor `natur`). Bei mehreren Treffern
  entscheidet also die Position im Objekt, nicht die Stärke des Treffers. CODE-BEWIESEN.

### 2.3 Auswirkung eines falschen Topics

| Bereich | Auswirkung | Klasse |
|---|---|---|
| **Memory** | `orb_nodes.topic` wird falsch gespeichert; Knoten liegt dauerhaft im falschen Thema (belegt: Knoten `1dfb5e07-…`, Thema `reisen`, entstanden aus einer Wander-Aussage) | CODE + DB-BEWIESEN |
| **Interests** | Interessen werden je Topic gewichtet; ein falsches Topic stärkt das falsche Interesse und schwächt das richtige | CODE-BEWIESEN |
| **Recall** | Themengleichheit ist Teil der Relevanz/`conversationalFit`; falsches Topic senkt die Trefferwahrscheinlichkeit des richtigen Knotens und hebt die des falschen | CODE-BEWIESEN |
| **Knowledge Gaps** | `deriveKnowledgeGaps()` verwendet `m.topic` (Z. 184, 189, 198) → Lücke und Fragetext entstehen zum falschen Thema (belegt: Produktionsfrage vom 21.09. 08:54 „In welchem Zusammenhang mit Reisen …“) | CODE + RUNTIME-BEWIESEN |
| **Feed** | `topicsOf()` speist Feed-Vergleiche; zusätzlich werden **alle** Tokens als Pseudo-Themen ergänzt (Z. 434), was falsche Treffer zusätzlich verwässert | CODE-BEWIESEN |

Klassifikation: **A) ECHTER LOGIKFEHLER** (deterministische Fehlklassifikation), Risiko **P1**.
**Keine Reparatur durchgeführt.**

---

## 3. KORREKTUR GEGENÜBER DEM VORHERIGEN AUDIT – Nr. 2: Herkunft Curiosity vs. Impulse

**Die frühere Aussage „nicht rekonstruierbar“ ist FALSCH und wird hiermit korrigiert.**

### 3.1 Was tatsächlich gespeichert wird

- `orb_questions` (DB-BEWIESEN, Spaltenliste geprüft): `id, user_id, question, topic, knowledge_gap,
  gap_kind, source_memory_ids, score, reason, created_at, asked_at, answered, answer_received, answered_at`.
  → **Kein** Feld `source`. Aber: `reason` enthält bei Impulsen den Impulstext einschliesslich
  `Priorität P1/P2` (Z. 2284 speichert `impulseReason`).
- `orb_messages.state_snapshot` (Z. 2298–2313) enthält:
  `proactive: true`, `explicit`, `scope`, `curiosity_scope`, `impulse_scope`, `topic`, `gap_kind`,
  `knowledge_gap`, `score`, `question_id` und entscheidend
  **`impulse: impulse ? { type, priority, form } : null`** (Z. 2309–2311).
- `orb_metrics` (DB-BEWIESEN): nur Laufzeitkennzahlen, `kind: "proactive"` – keine Herkunft.

### 3.2 Rekonstruktionsregel (CODE-BEWIESEN, eindeutig)

```
state_snapshot.impulse !== null   →  Herkunft = IMPULSE   (mit Lückenart und Priorität)
state_snapshot.impulse === null   →  Herkunft = CURIOSITY
```
Die Regel ist eindeutig, weil `impulse` in Z. 2232 genau dann gesetzt wird, wenn
`impulseDecision.action === "SPEAK"`, und `gap` in Z. 2251 genau daran hängt.
Verbindung zur Fragezeile über `state_snapshot.question_id` → `orb_questions.id`.

### 3.3 Produktionsbelege (RUNTIME-BEWIESEN)

| created_at (UTC) | question_id | impulse | rekonstruierte Herkunft |
|---|---|---|---|
| 2026-09-21 14:17:07.757 | 03891db5-01df-4b67-9aab-430eec31c69b | `null` | CURIOSITY |
| 2026-09-21 11:48:03.567 | fca9eb34-5f1b-49c2-adb3-57a99edf2751 | `{contradiction, P1, question}` | IMPULSE |
| 2026-09-21 10:49:57.802 | f5ff882a-1df9-48fe-b0cf-6358f731b24d | `null` | CURIOSITY |
| 2026-09-21 09:47:46.357 | ff27dc22-7d97-461e-9993-ec05cf73cb5c | `{missing_information, P2, question}` | IMPULSE |
| 2026-09-21 09:36:43.986 | d20c13de-96b7-498a-89c7-98aa462c3407 | `{missing_information, P2, question}` | IMPULSE |
| 2026-09-21 08:59:57.407 | 96be5c30-965e-4cd0-accc-c59c67623c5a | `null` | CURIOSITY |
| 2026-09-21 08:54:27.211 | ed90f90e-a603-4450-8327-23ec295a3179 | `null` | CURIOSITY |
| 2026-09-21 08:45:30.976 | 9bbb4125-0556-4ea4-8848-51903bfcec8d | `null` | CURIOSITY |
| 2026-09-20 07:26:11.726 | a95656dc-7575-4676-8f4a-cc519bcf5aff | `{missing_information, P2, question}` | IMPULSE |

Von 13 gespeicherten autonomen Fragen sind **alle 13** eindeutig zuordenbar (9 Curiosity, 4 Impulse).

### 3.4 Korrigierte Formulierung

> Die Herkunft einer autonomen Frage ist **nicht als eigenes Source-Feld gespeichert, aber aus den
> gespeicherten Produktionsdaten zuverlässig rekonstruierbar** (`orb_messages.state_snapshot.impulse`,
> verknüpft über `question_id`).

Klassifikation: **D) REKONSTRUIERBAR, NICHT DIREKT GESPEICHERT** – kein Bug, keine Informationslücke.
Einschränkung (**OFFEN**): Die Rekonstruktion gilt nur für **gestellte** Fragen. Für abgelehnte
Versuche existiert keine Zeile (siehe Kapitel 4).

---

## 4. KORREKTUR/PRÄZISIERUNG – Nr. 3: Die „24/25“-Aussage

### 4.1 Zählregel (zuerst definiert, dann gezählt)

> **Gezählt wird jede eindeutige Codeverzweigung, die einen autonomen Fragenversuch beendet oder
> verhindert, ohne eine `orb_messages`-Zeile zu erzeugen, und die im Pfad
> `useOrbPresence` → `askProactively()` erreichbar ist.**
> Getrennt gezählt werden **Serverablehnungen** (im Serverpfad) und **Browser-Vorfilter**
> (verhindern den Serveraufruf überhaupt). Mehrfach auslösbare Bedingungen zählen einmal.
> Unerreichbare Zweige werden benannt, aber nicht mitgezählt.

### 4.2 Serverseitige Ablehnungspunkte

**A. `deriveKnowledgeGaps()` – `src/orb-core/curiosity.ts` (Vorfilter der Lückenbildung, 7)**

| # | Zeile | Bedingung | Reason | Rückgabepfad | Persistenz |
|---|---|---|---|---|---|
| 1 | 184 | `!m.topic` | – (stiller `continue`) | Knoten erzeugt keine Lücke | nein |
| 2 | 185 | `m.confidence < 0.5` | – | dito | nein |
| 3 | 186 | `contentTokens(m.content).length === 0` | – | dito | nein |
| 4 | 189 | `interest.weight < 0.1` | – | dito | nein |
| 5 | 203 | gleiche Lückenart schon beantwortet | – | Lückenart übersprungen | nein |
| 6 | 204 | gleiche Lückenart schon gefragt | – | dito | nein |
| 7 | 207 | `novelty <= 0` (≥ 4 Fragen zum Knoten) | – | dito | nein |

**B. `decideCuriosity()` – `curiosity.ts` Z. 267–304 (6)**

| # | Zeile | Bedingung | Action | Reason | Persistenz |
|---|---|---|---|---|---|
| 8 | 279 | keine Lücke | DO_NOTHING | „Keine offene Wissenslücke …“ | nein |
| 9 | 282 | `curiosity` Band = low | DO_NOTHING | „Neugier zu gering …“ | nein |
| 10 | 285 | `energy < 0.15` | WAIT | „Zu wenig Energie – ORB wartet.“ | nein |
| 11 | 288 | offene eigene Frage | WAIT | „Eine eigene Frage ist noch offen …“ | nein |
| 12 | 293 | Cooldown (2–5 min je Band) | WAIT | „Cooldown nach der letzten eigenen Frage aktiv.“ | nein |
| 13 | 297 | `score < CURIOSITY_ASK_THRESHOLD` | WAIT | „Interesse noch nicht stark genug …“ | nein |

**C. `decideImpulse()` – Kandidatenfilter, `impulse.ts` (4)**

| # | Zeile | Bedingung | Reason | Persistenz |
|---|---|---|---|---|
| 14 | 171 | `gap.expiresAt <= now` | – (stiller `continue`) | nein |
| 15 | 173 | Priorität > P3 (`P4`) | – | nein |
| 16 | 176 | Ähnlichkeit ≥ 0.6 zu früherem Impuls | – | nein |
| 17 | 177 | Ähnlichkeit ≥ 0.6 zu bekannter Antwort | – | nein |

**D. `decideImpulse()` – Abbruchentscheidungen (5)**

| # | Zeile | Bedingung | Action | Reason | Persistenz |
|---|---|---|---|---|---|
| 18 | 216 | Nutzer hat abgewinkt (`suppressed`) | STAY_SILENT | Nutzerkontrolltext | nein |
| 19 | 217 | offene Frage | STAY_SILENT | „Eine eigene Frage ist noch offen …“ | nein |
| 20 | 221 | Cooldown | STAY_SILENT | „Abkühlphase …“ | nein |
| 21 | 227 | kein Kandidat | STAY_SILENT | „Keine Lücke mit nachvollziehbarem Mehrwert.“ | nein |
| 22 | 228 | `score < 0.2` | STAY_SILENT | „Mehrwert noch zu gering …“ | nein |

**E. `askProactively()` – `engine.server.ts` (4)**

| # | Zeile | Bedingung | Reason | Rückgabepfad | Persistenz |
|---|---|---|---|---|---|
| 23 | 2247 | `impulseDecision.suppressed` | Nutzerkontrolltext | `silent()` → `asked:false` | nein |
| 24 | 2250 | kein Impuls **und** Curiosity ≠ ASK | Curiosity-Reason | `silent()` | nein |
| 25 | 2259 | LLM-Fehler oder leere Frage | „Sprachschicht nicht verfügbar …“ | `silent()` | nein |
| 26 | 2264 | Duplikat (Ähnlichkeit ≥ 0.6) | „Diese Frage hat ORB … schon gestellt.“ | `silent()` | nein |

**Summe Server nach der definierten Zählregel: 26 – nicht 24.**
Die Zahl 24 ergibt sich nur, wenn man zwei der Lückenbildungsfilter (z. B. Z. 203 und 204 als einen
Punkt, Z. 207 als Sonderfall von 204) zusammenfasst. Beide Zählungen sind konsistent, sobald die
Regel genannt wird – ohne Regel ist weder 24 noch 26 belegbar. **Die Aussage „24“ wird daher zu
„26 unter der hier definierten Regel (24 bei Zusammenfassung der drei Novelty-/Asked-Filter)“ korrigiert.**

### 4.3 Browser-Vorfilter

`shouldAskProactively()` – `src/orb-core/presence.ts` Z. 102–124, aufgerufen im 5-Sekunden-Takt aus
`useOrbPresence` (Z. 99–130). Jede Ablehnung verhindert den Serveraufruf vollständig.

| # | Zeile | Bedingung | Reason | Serveraufruf? | Persistenz |
|---|---|---|---|---|---|
| 1 | 106 | Tab nicht sichtbar | „Tab nicht aktiv …“ | nein | nein |
| 2 | 107 | `typing` | „Benutzer tippt gerade.“ | nein | nein |
| 3 | 108 | `listening` | „Mikrofon ist aktiv.“ | nein | nein |
| 4 | 109 | `speaking` | „ORB spricht gerade.“ | nein | nein |
| 5 | 110 | `pending` | „Eine Anfrage ist bereits in Bearbeitung.“ | nein | nein |
| 6 | 111 | `idleMs < 40 000` | „Früheste erlaubte Zeit (40 s) …“ | nein | nein |
| 7 | 114 | `idleMs > 900 000` | „Benutzer war lange abwesend …“ | nein | nein |
| 8 | 117 | Band = low | „Neugier zu gering …“ | nein | nein |
| 9 | 119–121 | Client-Cooldown | „Cooldown nach der letzten Frage aktiv.“ | nein | nein |
| (–) | 118 | `!ctx.hasCandidate` | **unerreichbar**: Aufrufer setzt `hasCandidate: true` fest (`use-orb-presence.ts` Z. 109) | – | – |
| 10 | 98 | `!enabled` (Snapshot nicht geladen) | Intervall läuft nicht | nein | nein |

**Summe Browser: 9 erreichbare Vorfilter in `shouldAskProactively()` (10 Zweige, einer unerreichbar),
zuzüglich der `enabled`-Sperre = 10 clientseitige Nicht-Ausführungsstellen – nicht 7.**
Die Zahl 7 liess sich gegen den aktuellen Code **nicht** bestätigen (NICHT BEWIESEN).

### 4.4 Korrigierte Gesamtaussage

> Nach der in 4.1 definierten Zählregel existieren **26 benennbare serverseitige Ablehnungspunkte**
> und **10 clientseitige Nicht-Ausführungsstellen** (9 erreichbare Vorfilter + `enabled`-Sperre),
> zusammen **36 stille Abbruchstellen**. Die früher genannte Kombination „24 + 7 = 31“ ist nur unter
> abweichenden Zusammenfassungsregeln haltbar und wird hiermit korrigiert.

> **Bestätigt ohne Einschränkung:** Keine einzige dieser Ablehnungen erzeugt eine dauerhafte
> Persistenzspur. CODE-BEWIESEN: In allen Ablehnungspfaden findet kein `insert`/`update` statt;
> `orb_metrics` wird ausschliesslich **nach** erfolgreicher Frage geschrieben (`engine.server.ts`
> Z. 2340), `orb_state` ebenfalls nur dort (Z. 2320). `decideCuriosity()` und `decideImpulse()` sind
> reine Funktionen ohne DB-Zugriff. Der Reason existiert nur im Rückgabeobjekt des Requests und ist
> nach dem Request verloren; im Browser lebt er bis zum Reload (`lastAutonomyAttempt`,
> `channels.orb.tsx` Z. 227).

Klassifikation: **B) OBSERVABILITY-PROBLEM**, Risiko **P2** (verhindert Diagnose), kein Logikfehler.

---

## 5. Zusammenfassung

### 5.1 Bestätigte echte Bugs (Klasse A)

1. **Impulszweig ohne Energieprüfung** – überstimmt Curiosity-`WAIT`; drei Produktionsfälle mit
   Energie 0.0895 / 0.0898 / 0.0 belegt. CODE- + RUNTIME-BEWIESEN. **P1**
2. **Topic-Fehlklassifikation durch Präfixvergleich + zu generische Keywords** – „wand“→reisen,
   „rechnung“→hardware, „bandage“→musik sowie mindestens 12 weitere reproduzierte Fälle;
   wirkt auf Memory, Interests, Recall, Knowledge Gaps, Feed. CODE-BEWIESEN. **P1**

### 5.2 Bestätigte Observability-Lücken (Klasse B)

3. Keine der 36 stillen Abbruchstellen hinterlässt eine Persistenzspur. **P2**
4. Kein End-to-End-Test über den vollständigen Pfad Presence → Curiosity → Impulse → Gate →
   Formulierung → Duplikat → Question → Message → State → Metric. **P2**

### 5.3 Korrigierte frühere Aussagen

| Frühere Aussage | Korrektur | Beweis |
|---|---|---|
| „Herkunft Curiosity/Impulse ist nicht rekonstruierbar.“ | Nicht als Source-Feld gespeichert, aber über `state_snapshot.impulse` + `question_id` zuverlässig rekonstruierbar; 13/13 Produktionsfragen eindeutig zugeordnet | RUNTIME + CODE |
| „24/25 Ablehnungspunkte sind eine nicht beweisbare Zählbehauptung.“ | Mit definierter Zählregel beweisbar: 26 Server + 10 Client = 36; „24 + 7 = 31“ nicht bestätigt | CODE |
| „Die drei Topic-Fehler folgen aus der Bidirektionalität.“ | Nur „wand“→reisen folgt aus `k.startsWith(t)`; „rechnung“ und „bandage“ folgen aus der Vorwärtsrichtung mit zu kurzen Keywords | CODE (ausgeführt) |
| Impulsfehler als „möglicher“ Logikfehler | Bestätigt als **eingetretener** Logikfehler mit Produktionsbelegen | RUNTIME |

### 5.4 Offene Punkte (Klasse E)

- Für **abgelehnte** Versuche bleibt die Herkunft nicht rekonstruierbar (keine Zeile existiert).
- Ob jemals eine Impulsfrage **ausschliesslich** wegen des fehlenden Energie-Gates statt einer
  Curiosity-Frage gestellt wurde, lässt sich nicht beweisen: die Curiosity-Entscheidung der jeweiligen
  Sekunde ist nicht gespeichert (nur der Energiewert, der `WAIT` belegt).
- Keine Transaktion über die vier Schreibschritte (`orb_questions` → `orb_messages` → `orb_state` →
  `orb_metrics`): theoretisches Inkonsistenzrisiko, in Produktion bisher nicht beobachtet.
- `topicsOf()` fügt alle Tokens als Pseudo-Themen hinzu (Z. 434) – Auswirkung auf die Feed-Relevanz
  nicht quantifiziert.

### 5.5 Empfohlene Reparaturreihenfolge (Vorschlag, NICHT umgesetzt)

1. **P1 – Energie-Gate für den Impulszweig**: kleinste denkbare Änderung, nur im Zusammenführungspfad;
   erst mit Test, dann Staging, dann Freigabe.
2. **P1 – Topic-Matching**: Mindestlänge/Wortgrenze beim Vergleich und Entschärfung der generischen
   Keywords (`band`, `berg`, `reis`, `rechn`); rein lexikalisch, keine neue KI-Ebene.
3. **P2 – Ablehnungsprotokoll**: eine einzige Persistenzstelle für abgelehnte Versuche (Grund + Gate),
   ohne Verhaltensänderung.
4. **P2 – ein End-to-End-Test** des vollständigen autonomen Pfads.
5. Nicht anfassen: `updated_at`-Zeitanker (aktuell korrekt), Cooldown-Bänder, Schwellenwerte,
   Listening/Presence-Takt, `topicsOf()`-Pseudo-Themen, bestehende Produktionsdaten.

---

**Keine Reparatur durchgeführt. Keine Datei des Systems verändert. Kein Deployment, keine Migration.**
