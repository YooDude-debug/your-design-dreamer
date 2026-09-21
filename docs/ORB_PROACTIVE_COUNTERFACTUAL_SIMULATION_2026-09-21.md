# ORB CORE — COUNTERFACTUAL AUTONOMY SIMULATION

Datum: 2026-09-21 · Modus: READ-ONLY / SIMULATION ONLY · Umgebung: Production (nur lesend)
Referenz: `docs/ORB_PROACTIVE_QUESTIONING_BLOCK_ANALYSIS_2026-09-21.md`,
`docs/ORB_AUTONOMOUS_QUESTION_EVENT_2026-09-20.md` (Case 1),
`docs/ORB_FORENSIC_CASE2_PERSONAL_MEMORY_2026-09-21.md` (Case 2),
`docs/ORB_CROSS_CASE_AUTONOMY_ARCHITECTURE_2026-09-21.md`

**KEINE Änderung durchgeführt:** kein Code, keine Datenbank, keine Migration, kein Deployment,
keine Konfiguration, keine Thresholds, keine Memory-Daten, keine erzeugten Events.
Alle Zahlen stammen aus einer Offline-Nachrechnung der echten Core-Module
(`detectGaps`, `deriveKnowledgeGaps`, `decideImpulse`, `decideCuriosity`) mit einer
Nur-Lese-Kopie der aktuellen Production-Daten (Nutzer `9ce1d1b0…`, 12 geladene Knoten,
36 Verbindungen, 8 Nachrichten, 8 Interessen, 3 Fragen). Das Simulationsskript lag
ausserhalb des Produktcodes und wurde nach dem Lauf entfernt.

---

## 1. Executive Summary

1. Der autonome Pfad ist **nicht** durch Listening blockiert (bereits belegt) und **nicht**
   durch eine Code-Regression.
2. Entscheidend neu in dieser Simulation: die beiden Bewerter sind **unterschiedlich stark
   blockiert**.
   - **CURIOSITY:** bester Lückenwert **0.6324** — das ist **dreifach über** der Schwelle 0.20.
     Der **einzige** blockierende Faktor ist `energy = 0 < CURIOSITY_MIN_ENERGY = 0.15`
     (`src/orb-core/curiosity.ts:285`).
   - **IMPULSE:** bester Kandidatenwert **0.1041 < IMPULSE_MIN_SCORE 0.20**
     (`src/orb-core/impulse.ts:229`). IMPULSE prüft Energie **nicht**.
3. Der in der Vorgängeranalyse berichtete Wert 0.10 betraf ausschliesslich den IMPULSE-Pfad.
   Der CURIOSITY-Pfad ist inhaltlich **vollständig bereit** und scheitert allein an Energie.
4. Damit ist die **kleinste wirksame Änderung** eindeutig bestimmbar: **Energie-Erholung**.
   Keine Threshold-Senkung, kein Eingriff in Themenbezug, Listening, Cooldown oder
   Duplikatprüfung nötig, um das historisch bestätigte Verhalten wieder zu ermöglichen.
5. Warnung aus derselben Simulation: reine Energie-Erholung ohne Obergrenze würde bei
   Wert 0.6324 und Cooldown 120 s (Neugier `very_high`) im Leerlauf **etwa eine Frage
   alle zwei Minuten** erlauben. Die Empfehlung ist deshalb Energie-Erholung **mit
   begrenztem Nachschub**, nicht Energie = 1.
6. Empfehlung: **Variante E — minimal-invasiv: begrenzte, ereignisgebundene Energie-Erholung**
   (Detail in Abschnitt 14). Themenbezug bleibt unverändert.

---

## 2. Current Baseline (exakt nachgerechnet)

Zustand Production (`orb_state`, Stand 2026-09-21 06:30:27 UTC):
`curiosity 0.9925` · `energy 0` · `joy 1` · `fear 0` · `trust 1` · `uncertainty 0.753`
Letzte eigene Frage: 2026-09-20 07:26:11.726 UTC (Cooldown längst abgelaufen).

### 2.1 IMPULSE (gaps.ts → impulse.ts)

Erkannte Lücken (5) und Bewertung
`score = importance × confidence × futureRelevance × conversationalFit × PRIORITY_BENEFIT`:

| Lückenart | Prio | importance | confidence | futureRelevance | fit | Wert |
|---|---|---|---|---|---|---|
| missing_context („Nicht faktisch falsch", Thema `faktisch`) | P3 | 0.80 | 0.90 | 0.5355 | 0.6 | **0.1272** |
| incomplete_goal („Ziel ist aber Bewusstsein") | P2 | 0.45 | 0.90 | 0.5355 | 0.6 | 0.1041 |
| repeated_topic (`hardware`) | P3 | 0.60 | 0.90 | 0.5355 | 0.6 | 0.0954 |
| repeated_topic (`hardware`) | P3 | 0.48 | 0.90 | 0.5355 | 0.6 | 0.0763 |
| repeated_topic (`hardware`) | P3 | 0.48 | 0.90 | 0.5355 | 0.6 | 0.0763 |

Sortierung erfolgt zuerst nach Priorität, dann nach Wert → Bester Kandidat ist der
P2-Eintrag mit **0.1041**.
Ergebnis: `STAY_SILENT` — „Mehrwert noch zu gering (0.10 < 0.2)."

### 2.2 CURIOSITY (curiosity.ts)

`score = curiosity × relevance × soft(importance) × soft(confidence) × soft(fit) × soft(novelty)`,
`soft(x) = 0.5 + 0.5·x`.

| Lücke | Thema | relevance | fit | novelty | Wert |
|---|---|---|---|---|---|
| detail | reisen | 0.975 | 0.6 | 1.00 | **0.6324** |
| kontext | reisen | 0.975 | 0.6 | 1.00 | 0.6324 |
| erfahrung | hardware | 1.000 | 0.6 | 1.00 | 0.6034 |
| detail | hardware | 1.000 | 0.6 | 1.00 | 0.6034 |
| kontext | hardware | 1.000 | 0.6 | 1.00 | 0.6034 |

Ergebnis: `WAIT` — „Zu wenig Energie – ORB wartet." (Prüfreihenfolge: Lücken vorhanden ✓,
Neugier `very_high` ✓, **Energie 0 < 0.15 ✗** → Abbruch vor der Wert-Prüfung.)

### 2.3 Finale Entscheidung

`askProactively` (`engine.server.ts:2238`): kein Impuls **und** `decision.action !== "ASK"`
→ stiller Rücksprung. Ablehnungsgrund an der Oberfläche: der CURIOSITY-Grund (Energie).

**Baseline-Fazit:** ein Threshold-Problem besteht nur im IMPULSE-Pfad; im CURIOSITY-Pfad
besteht ausschliesslich ein **Energie-Problem**.

---

## 3. Simulation A — Energy Recovery (alles andere unverändert)

Energie wirkt nur als Tor in `decideCuriosity`; sie geht in **keine** Score-Formel ein.
Die Lückenwerte bleiben daher konstant.

| Energie | CURIOSITY-Aktion | Wert | IMPULSE | Frage ausgelöst? | entscheidende Bedingung |
|---|---|---|---|---|---|
| 0.00 | WAIT | 0.6324 | STAY_SILENT | nein | `energy < 0.15` |
| 0.05 | WAIT | 0.6324 | STAY_SILENT | nein | `energy < 0.15` |
| 0.10 | WAIT | 0.6324 | STAY_SILENT | nein | `energy < 0.15` |
| **0.15** | **ASK** | 0.6324 | STAY_SILENT | **ja** | Tor offen, Wert 0.63 ≥ 0.20 |
| 0.20 | ASK | 0.6324 | STAY_SILENT | ja | wie oben |
| 0.30 | ASK | 0.6324 | STAY_SILENT | ja | wie oben |
| 0.50 | ASK | 0.6324 | STAY_SILENT | ja | wie oben |
| 0.75 | ASK | 0.6324 | STAY_SILENT | ja | wie oben |
| 1.00 | ASK | 0.6324 | STAY_SILENT | ja | wie oben |

Vollständige Entscheidungskette bei Energie ≥ 0.15:
Lücken vorhanden → Neugier `very_high` (0.9925) → Energie-Tor offen → keine offene eigene
Frage (alle drei Fragen beantwortet) → Cooldown abgelaufen (> 24 h ≫ 120 s) →
Wert 0.6324 ≥ 0.20 → **ASK**, Thema `reisen`, Lückenart `detail`.

Hinweis: oberhalb von 0.15 ändert sich **nichts** mehr — mehr Energie erzeugt keine
bessere, nur keine andere Entscheidung. Eine hohe Energie ist also ausdrücklich unnötig.

---

## 4. Simulation B — Themenbezug nur als Ranking-Faktor

Gegenwärtig wirkt `conversationalFit` in beiden Bewertern **multiplikativ**:
`1` bei Themenübereinstimmung, sonst `0.6`. Im laufenden Gespräch (Metathema „ORB selbst":
Tokens `impul`, `nachfrage`, `wissenslücke`, `messung` …) trifft **kein** Knotenthema zu,
daher überall 0.6.

| Bewerter | Bester Wert CURRENT | Bester Wert RANKING-ONLY (fit neutral) | Schwelle | Wechsel? |
|---|---|---|---|---|
| CURIOSITY | 0.6324 | 0.7905 | 0.20 | nein (beides ASK-fähig) |
| IMPULSE | 0.1041 (P2) | **0.2121** (P3 `missing_context`) | 0.20 | **ja** — STAY_SILENT → SPEAK |

Ort der Wirkung:
- CURIOSITY: `curiosity.ts:141` über `soft(fit)` → Faktor 0.8 statt 1.0. **Nur Rangwirkung**,
  nie ausschlaggebend. Hier ist Themenbezug bereits heute ein Ranking-Faktor.
- IMPULSE: `impulse.ts:79` hart multiplikativ → Faktor 0.6. Hier wirkt Themenbezug faktisch
  als **Filter**: alle Kandidaten verlieren 40 %, der beste rutscht unter die Schwelle.

Wichtige Nebenwirkung: eine Neutralisierung hebt **alle** Kandidatenwerte um Faktor 1/0.6 ≈ 1.67,
also auch die drei `repeated_topic`-Beobachtungen (0.0954 → 0.1590; 0.0763 → 0.1272).
Der neue Sieger wäre die P3-Lücke „Worauf bezieht sich ‚Nicht faktisch falsch'?" — genau
die Frage, die bereits 2026-09-20 gestellt **und** beantwortet wurde; sie würde nur durch
die semantische Duplikatprüfung (`IMPULSE_DUPLICATE_SIMILARITY 0.6`, `engine.server.ts:2252`)
abgefangen. Das ist ein reales Wiederholungsrisiko und der Grund, warum diese Variante
allein nicht empfohlen wird.

---

## 5. Simulation C — Energy Recovery + Ranking-only

| Energie | CURIOSITY | IMPULSE (ranking-only) | Ergebnis |
|---|---|---|---|
| 0.00 | WAIT (0.7905) | SPEAK (0.2121) | **ASK** — über IMPULSE, weil dieser kein Energietor hat |
| 0.15 | ASK (0.7905) | SPEAK (0.2121) | ASK — IMPULSE hat Vorrang (`engine.server.ts:2239`) |
| 0.30 | ASK (0.7905) | SPEAK (0.2121) | ASK — IMPULSE hat Vorrang |

Erstmalige autonome Frage: bereits bei Energie 0, weil der IMPULSE-Pfad energiefrei ist.
Wirksame Kombination: `Gap ≥ 0.20` **nach** Neutralisierung des Themenfaktors + Priorität
≤ P3 + kein Duplikat + Cooldown abgelaufen.
Bewertung: funktioniert, ist aber die **grössere** Änderung (zwei Stellschrauben, veränderte
Selektivität des IMPULSE-Pfads) und deshalb nicht minimal.

---

## 6. Simulation D — Minimale Variante

Gesuchte Eigenschaften: minimal, kontrolliert, reversibel, ohne Threshold-Senkung, ohne
Abschalten von Listening/Duplikatprüfung/Cooldown.

Ergebnis der Simulation: **eine** Stellschraube genügt — das Energie-Tor.
Der CURIOSITY-Wert liegt mit 0.6324 bereits **3,2-fach** über der Schwelle; es fehlt
ausschliesslich Energie ≥ 0.15.

Minimalvariante (nur beschrieben, nicht umgesetzt):
in `engine.server.ts` bei der ereignisbasierten Zustandsaktualisierung eine **begrenzte
Erholung** vorsehen, z. B. `energy = min(ENERGY_RECOVERY_CAP, energy + recovery)` mit
`recovery` proportional zur vergangenen Ruhezeit seit `updated_at` und einem Deckel
deutlich unter 1 (Grössenordnung 0.30–0.40). Wirkung: das Tor 0.15 wird wieder erreichbar,
alle Schwellen, Formeln, Prioritäten, Cooldowns, Duplikatprüfung und der Themenfaktor
bleiben **unverändert**. Rücknahme ist ein einzelner Code-Rückbau, keine Datenmigration.

Ausdrücklich **nicht** Teil der Minimalvariante: `CURIOSITY_MIN_ENERGY` senken (verschiebt
nur das gleiche Tor, ohne die Ursache „Energie wird nie aufgebaut" zu beheben),
`IMPULSE_MIN_SCORE` senken, Themenfaktor entfernen, Energie fest auf 1 setzen.

---

## 7. Historical Case Replay

| Case | Baseline (heutiger Datenzustand) | A: Energy-Recovery | B: Ranking-only | C: A+B | D: Minimalvariante | Result |
|---|---|---|---|---|---|---|
| **Case 1** (IMPULSE, `missing_information` P2, Wert 0.36288, Energie 0) | Knoten ist heute verbunden → `missing_context` **P3**, Wert **0.1272** → STAY_SILENT | unverändert STAY_SILENT (IMPULSE hat kein Energietor) | 0.2121 ≥ 0.20 → SPEAK, aber **Duplikat** der schon gestellten und beantworteten Frage | SPEAK / Duplikatstopp | IMPULSE bleibt still; die **Frageform** entsteht stattdessen über den CURIOSITY-Pfad | strukturell reproduzierbar nur bei *unverbundenem* wichtigem Knoten — genau die damalige Datenlage |
| **Case 2** (CURIOSITY, `detail`, Wert 0.40446, Energie 0.618) | Wert heute **0.6324** ≥ 0.20, aber Energie 0 → WAIT | **ASK** (ab 0.15) | ASK (0.7905) | ASK | **ASK** | **vollständig reproduzierbar** |

Lesart: Case 2 ist mit der Minimalvariante wieder erreichbar — sogar mit einem höheren
Wert als damals. Case 1 ist kein Threshold-, sondern ein **Datenzustandsfall**: er tritt
wieder auf, sobald eine wichtige Angabe (≥ 0.6) ohne Verbindung im Spiderweb liegt; das
ist die vom Code vorgesehene Bedingung und bedarf keiner Änderung.

---

## 8. Quality Analysis — Themenrelevanz ≠ Fragequalität

Die Simulation trennt beide Begriffe messbar:

- „nicht thematisch relevant" = `conversationalFit = 0.6`, ein reiner Zeitpunkt-Indikator.
- „nicht sinnvoll" = keine echte Lücke, geringe Wichtigkeit, Sicherheit unter 0.55/0.5,
  Duplikat, bereits beantwortet, abgelaufene TTL, Priorität P4.

Vorhandene Qualitätssignale unabhängig vom Thema, alle im Code bereits wirksam:
echte Informationslücke (`detectGaps`/`deriveKnowledgeGaps`), Neuheit (`novelty`),
Sicherheit (`GAP_MIN_CONFIDENCE 0.55`, `PROACTIVE_MIN_CONFIDENCE 0.5`),
Wichtigkeit, Nutzerpräferenz (`readUserControl`), fehlender Kontext (Knotentyp),
Priorität (`GAP_PRIORITY`), Wiederholungsrisiko (Duplikatprüfung), Gesprächszustand
(`shouldAskProactively`), Ablaufzeit (`GAP_TTL_MS`).

Beispiel aus dem heutigen Zustand: die Frage nach dem Ziel „Bewusstsein" (P2, unverbundenes
Ziel) ist inhaltlich sinnvoll, obwohl das laufende Gespräch ein anderes Thema hat.
Der Themenfaktor bewertet hier den **Zeitpunkt**, nicht den Inhalt. Fazit: Themenbezug ist
als Rangfaktor berechtigt, als Filter (harte 0.6-Multiplikation im IMPULSE-Pfad) fachlich
nicht zwingend — aber seine Änderung ist für die Wiederherstellung **nicht erforderlich**.

---

## 9. Spam Analysis (Negativfälle, simuliert)

Bewertet wird der Zustand **mit** der Minimalvariante (Energie-Erholung, sonst unverändert).

| Fall | Entscheidung | Begründung (Codestelle) |
|---|---|---|
| Völlig irrelevantes Gespräch | ASK möglich | `fit = 0.6` senkt nur den Rang; CURIOSITY-Wert bleibt über der Schwelle. **Bewusst hingenommen**, entspricht Case 2. |
| Information bereits vollständig bekannt | DO NOT ASK | Duplikat- und `knownAnswers`-Prüfung (`impulse.ts:171`, `engine.server.ts:2252`) |
| Keine echte Lücke | DO NOT ASK | `gaps.length === 0` → `DO_NOTHING` (`curiosity.ts:279`) |
| Sehr kurze Ruhezeit (< 40 s) | DO NOT ASK | `PROACTIVE_MIN_IDLE_MS` (`presence.ts:118`) |
| Sehr lange Ruhezeit (> 15 min) | DO NOT ASK | `PROACTIVE_MAX_IDLE_MS` (`presence.ts:121`) |
| Wiederholte gleiche Frage | DO NOT ASK | semantische Duplikatprüfung, Schwelle 0.6 |
| Mehrere Kandidaten gleichzeitig | genau **eine** Frage | Sortierung + `candidates[0]`, höchstens ein Impuls |
| Nutzer antwortet nicht | DO NOT ASK | `openQuestion` → WAIT (`curiosity.ts:288`) |
| Nutzer lehnt indirekt ab („später", „egal") | DO NOT ASK | `readUserControl` → `suppressed` (`engine.server.ts:2234`) |
| ORB hat gerade selbst gesprochen | DO NOT ASK | Cooldown 120–300 s nach Neugierband |
| Nutzer ist aktiv (tippt, spricht, Mikro an, Tab inaktiv) | DO NOT ASK | `shouldAskProactively` (`presence.ts:104–110`) |

**Identifiziertes Spam-Risiko (quantifiziert):** bei Wert 0.6324 und `very_high`-Cooldown
120 s wäre im Dauerleerlauf eine Frage alle ~2 Minuten möglich, begrenzt durch das
15-Minuten-Leerlauffenster und die offene-Frage-Sperre. Deshalb ist der **Deckel** der
Energie-Erholung der eigentliche Qualitätsregler: mit begrenztem Nachschub verbraucht sich
Energie (−0.03 je eigene Frage, `engine.server.ts:2313`; −0.03 −0.04·importance je
Nachricht, `core.ts:164`) schneller, als sie zurückkommt, und erzeugt so von selbst
Seltenheit statt Dauerfeuer.

---

## 10. Energy Model Analysis

Warum Energie 0 ist — vollständige Fundstellen:

| Ort | Wirkung |
|---|---|
| `core.ts:164` (`nextState`) | `energy = clamp01(energy − 0.03 − 0.04·importance)` je verarbeiteter Nachricht |
| `engine.server.ts:2313` | `energy = max(0, energy − 0.03)` je eigener Frage |
| `engine.server.ts:1491` | schreibt das Ergebnis von `nextState` zurück |
| Erhöhung | **existiert nicht** — kein Pfad im Code erhöht `energy` |
| Rücksetzung | **existiert nicht** ausser über den Initialwert bei Zustandsanlage |
| Leser | `curiosity.ts:285` (Tor 0.15), `conversation.ts:180/194` (FOLLOW_UP/SMALLTALK ab 0.12), `core.ts:179` (`decide` → `stay_silent` unter 0.12), `core.ts:225` (Pulsdauer der Darstellung), `prompt.server.ts:49` (nur Text im Prompt) |

Das bestätigt das dokumentierte Finding „fehlende Energie-Erholung": Energie ist eine rein
monoton fallende Grösse. Sie erreichte am 2026-09-19 die Null und blockiert seitdem
dauerhaft CURIOSITY-Fragen, FOLLOW_UP und SMALLTALK.

Drei Modelle (nur Analyse):

**A — passive Erholung über Zeit.** `energy += rate · Δt`, gedeckelt.
Vorteile: einfach, deterministisch, gut testbar, spiegelt „Erholung in Ruhe".
Risiken: bei zu hoher Rate Dauerbereitschaft; Zeitbasis muss serverseitig aus `updated_at`
kommen, nicht aus Client-Zeit. Autonomie: stellt sie zuverlässig wieder her.
Spam: mittel, vollständig über Rate und Deckel steuerbar. Case 1: unberührt. Case 2:
reproduzierbar. Grenzfall: sehr lange Abwesenheit → Deckel greift, kein Aufstauen.

**B — ereignisbasierte Erholung.** Erholung an nachvollziehbare Ereignisse binden
(beantwortete eigene Frage, erfolgreicher Abruf, gespeicherte Erinnerung).
Vorteile: Energie wird zur Rückmeldegrösse statt zur Uhr; Missbrauch schwer.
Risiken: bei völliger Inaktivität bleibt Energie 0 — die Autonomie bliebe im heutigen
Zustand blockiert, bis der Nutzer handelt. Spam: gering. Case 2: reproduzierbar, sobald
ein Gespräch läuft. Grenzfall: exakt die heutige Sackgasse kann bestehen bleiben.

**C — relevanzbasierte Erholung.** Erholung proportional zur Qualität der offenen Lücken.
Vorteile: koppelt Bereitschaft an inhaltlichen Bedarf.
Risiken: Rückkopplung — hohe Lückenwerte erzeugen Energie, die Fragen erzeugt, die
Lücken schliessen; Verhalten schwer vorhersagbar, Tests aufwendig; vermischt zwei
Konzepte, die Abschnitt 13 gerade trennen will. Spam: höchstes Risiko.

Bewertung: **A mit Deckel, ergänzt um den Ereignisimpuls aus B**, ist das kleinste Modell
mit vorhersagbarem Verhalten. C wird nicht empfohlen.

---

## 11. Silent Rejection Analysis (`PROACTIVE_CANDIDATE_REJECTED`)

Heute endet jede Ablehnung als reiner Rückgabewert von `askProactively`; nichts wird
persistiert. Genau diese Lücke machte in den letzten Untersuchungen mehrfach Aussagen
unmöglich (wie oft der Leerlauf-Beobachter still ablehnte, war nicht rekonstruierbar).

Nutzen eines internen Ablehnungseintrags (Grund, bester Kandidat, Wert, Schwelle,
Energie, Neugier, Zeitpunkt):
- **Debugging:** Blockadestelle sofort sichtbar, ohne Offline-Nachrechnung wie hier.
- **Forensik:** schliesst die derzeit grösste Beweislücke (stille Pfade).
- **Qualitätsmessung:** Verhältnis Ablehnung/Frage als objektive Selektivitätskennzahl.
- **Späte Anpassung:** Schwellen liessen sich datenbasiert statt geschätzt bewerten.
- **Dauerblockade-Erkennung:** ein Muster wie „30 Tage nur Grund ‚zu wenig Energie'"
  wäre unmittelbar erkennbar — der aktuelle Fall wäre am 19.09. aufgefallen.

Risiken/Auflagen: Schreibvolumen (Beobachter tickt alle 5 s → nur bei Zustandswechsel
oder mit Mindestabstand schreiben), Datenschutz (keine Klartext-Inhalte, nur IDs und
Kennzahlen), neue Tabelle bedeutet Migration + RLS + GRANT und ist damit **nicht** Teil
einer Minimalvariante. Bewertung: fachlich wertvoll, als **eigener, späterer** Schritt.
Kein Datensatz geschrieben — nur Konzept.

---

## 12. Counterfactual Decision Matrix

| Szenario | Energy | Gap-Wert | Topic-fit | Priorität | Pfad | Decision |
|---|---|---|---|---|---|---|
| **Aktueller Zustand** | 0 | CUR 0.6324 / IMP 0.1041 | 0.6 | P2/P3 | beide | **DO NOT ASK** (Energie / Wert) |
| Energie 0.10 | 0.10 | 0.6324 | 0.6 | – | CURIOSITY | DO NOT ASK (Tor) |
| **Kleinste Änderung bis ASK** | **0.15** | 0.6324 | 0.6 | – | CURIOSITY | **ASK** |
| Ranking-only, Energie 0 | 0 | IMP 0.2121 | 1.0 (neutral) | P3 | IMPULSE | ASK (Duplikatstopp möglich) |
| **Historischer Case 1** | 0 | 0.36288 | 1.0 | **P2** | IMPULSE | ASK (belegt) |
| **Historischer Case 2** | 0.618 | 0.40446 | – | – | CURIOSITY | ASK (belegt) |
| Case-1-Knoten heute | 0 | 0.1272 | 0.6 | P3 | IMPULSE | DO NOT ASK |
| Nutzer tippt / Mikro an | beliebig | beliebig | – | – | vor Server | DO NOT ASK |
| Offene eigene Frage | ≥ 0.15 | 0.6324 | – | – | beide | DO NOT ASK |
| Cooldown < 120 s | ≥ 0.15 | 0.6324 | – | – | beide | DO NOT ASK |

Die Entscheidungsgrenze verläuft im CURIOSITY-Pfad **allein** entlang der Energie
(0.10 → 0.15) und im IMPULSE-Pfad entlang der Kombination Priorität × Themenfaktor
(0.1041 → 0.2121).

---

## 13. Architectural Assessment

| Zielsatz | Stand im heutigen Code | Bewertung |
|---|---|---|
| Listening ≠ Autonomie | erfüllt: `listening` ist nur „Mikrofon aktiv" (`presence.ts:108`), der LISTEN-Modus betrifft ausschliesslich reaktive Antworten (`conversation.ts`) | kompatibel, keine Änderung nötig |
| Themenrelevanz ≠ Frageerlaubnis | im CURIOSITY-Pfad erfüllt (`soft(fit)` = Rangfaktor), im IMPULSE-Pfad **nicht** (harte Multiplikation 0.6) | teilweise; Anpassung wäre konsistent, ist aber nicht erforderlich |
| Energie ≠ Fragequalität | erfüllt in der Formel (Energie geht in keinen Score ein), **verletzt** in der Wirkung, weil ein fehlender Erholungspfad Energie zur dauerhaften Sperre macht | hier liegt die Ursache |
| Listening → Timing / Unterbrechung | erfüllt durch `shouldAskProactively` | kompatibel |
| Informationslücke → Kandidatenqualität | erfüllt durch `detectGaps` / `deriveKnowledgeGaps` | kompatibel |
| Entscheidungsschwelle → ASK / DO NOT ASK | erfüllt (`0.20` in beiden Bewertern) | kompatibel |

Die Zielarchitektur ist mit dem bestehenden Code **ohne Umbau** vereinbar. Die einzige
strukturelle Abweichung ist das fehlende Energie-Gegenstück (Erholung) zu einer
ausschliesslich verbrauchenden Grösse.

---

## 14. Recommended Variant

**Empfehlung: E — andere minimal-invasive Variante: begrenzte Energie-Erholung.**
(Das ist B mit ausdrücklichem Deckel; **nicht** C, **nicht** D.)

- **Technische Wirkung:** hebt das einzige Tor, das den bereits qualifizierten
  CURIOSITY-Kandidaten (0.6324 ≫ 0.20) zurückhält.
- **Geringste Änderung:** eine Stellschraube, eine Datei im Kern der Zustandsfortschreibung,
  keine Migration, keine RLS-, Schwellen-, Prompt- oder Listening-Änderung.
- **Risiko:** niedrig und quantifiziert; das Restrisiko ist Frage-Häufigkeit und wird über
  Erholungsrate und Deckel gesteuert, nicht über Schwellen.
- **Regression:** Memory-Formeln, Schwelle 0.35, Verfall, Abruf, Verbindungen, Eligibility,
  Cooldowns, Duplikatprüfung, SDK-Vertrag unberührt. Nebenwirkung: FOLLOW_UP und SMALLTALK
  (Tor 0.12) werden ebenfalls wieder erreichbar — das ist die **tested** Vorlage aus dem
  Natural-Conversation-Release und war bei Case 2 (Energie 0.618) der Normalzustand.
- **Autonomiequalität:** unverändert selektiv, weil alle inhaltlichen Prüfungen bleiben.
- **Spam-Risiko:** beherrschbar nur **mit** Deckel; ohne Deckel wäre es die in Abschnitt 9
  genannte Zwei-Minuten-Kadenz.
- **Case 1:** unberührt (IMPULSE hat kein Energietor) — reproduzierbar, sobald wieder ein
  wichtiger, unverbundener Knoten existiert.
- **Case 2:** direkt reproduzierbar.

Nicht empfohlen: A (keine Änderung — Autonomie bliebe dauerhaft blockiert),
C (Themen-Ranking allein — verändert die Selektivität des IMPULSE-Pfads um Faktor 1.67 und
hebt gerade die schwächsten Beobachtungskandidaten),
D (beides zugleich — zwei Risiken für einen Nutzen, nicht minimal).

Dies ist ein Analyseergebnis. **Nicht implementiert.**

---

## 15. Implementation Plan (nur Vorschlag)

| Phase | Ziel | Betroffene Komponenten | Erwartetes Ergebnis | Abbruchkriterium | Rollback |
|---|---|---|---|---|---|
| 1 — kleinste Codeänderung | begrenzte Energie-Erholung in der serverseitigen Zustandsfortschreibung, neue Konstanten (Rate, Deckel) | `src/orb-core/core.ts` (oder `engine.server.ts` an der Rückschreibestelle) | Energie kann das 0.15-Tor erreichen, Verbrauch unverändert | Typecheck/Lint rot, Formeländerung ausserhalb Energie | Rückbau der Änderung; keine Datenänderung nötig |
| 2 — Unit-Tests | Erholung, Deckel, Verbrauch > Erholung bei aktivem Gespräch | `tests/orb-*.test.ts` | neue Tests grün, 1073 bestehende Tests grün | irgendein bestehender Test rot | Testdateien und Änderung zurücknehmen |
| 3 — Replay Case 1 | IMPULSE-Verhalten unverändert | `impulse.ts`, `gaps.ts` (nur lesend) | P2-Kandidat mit 0.36288 ergibt weiterhin SPEAK | abweichender Wert | wie Phase 1 |
| 4 — Replay Case 2 | CURIOSITY-Verhalten wiederhergestellt | `curiosity.ts` | bei Energie 0.618 und Wert 0.40446 weiterhin ASK; bei 0.15 ASK | WAIT trotz ausreichender Energie | wie Phase 1 |
| 5 — Negativtests | Selektivität | `presence.ts`, Duplikatprüfung, `readUserControl` | alle elf Fälle aus Abschnitt 9 wie tabelliert | eine Frage in einem DO-NOT-ASK-Fall | wie Phase 1 |
| 6 — Staging | Verhalten im laufenden System | Staging-Umgebung | Fragen selten, inhaltlich gebunden, kein Dauerfeuer | mehr als eine Frage je Leerlaufphase | Staging zurücksetzen |
| 7 — Production Verification | belegtes Verhalten | Production (lesend) | ein `orb_questions`-Eintrag mit `proactive: true`, passende `orb_metrics`-Zeile, Energie bleibt unter dem Deckel | Frage-Kadenz über Erwartung | Backup-Rückbau, Energie-Erholung deaktivieren |

Jede Phase setzt die ausdrückliche Freigabe voraus; vor Phase 1 gehört ein
verifiziertes Production-Backup an den Anfang.

---

## 16. Test Plan (Erfolgskriterien 1–14)

1. normale Eingabe funktioniert — bestehende Chat-Tests
2. Listening funktioniert — `presence`-Tests (`listening` → kein Impuls)
3. aktives Zuhören verhindert Zwischenfragen — `typing`/`speaking`/`pending`-Fälle
4. Leerlauf löst Bewertung aus — Idle ≥ 40 s, < 15 min
5. IMPULSE funktioniert — Case-1-Parameter → SPEAK
6. CURIOSITY funktioniert — Case-2-Parameter → ASK
7. autonome Frage möglich — Energie 0.15 + Wert 0.6324 → ASK
8. nicht bei jedem Leerlauf — Cooldown-Test + Energieverbrauch je Frage
9. keine Duplikate — Ähnlichkeit ≥ 0.6 → still
10. Cooldowns wirken — 120/180/300 s je Neugierband
11. Memory unverändert — Schwelle 0.35, Verfall, Abruf, 1073 bestehende Tests
12. Case 1 reproduzierbar — Replay Phase 3
13. Case 2 reproduzierbar — Replay Phase 4
14. Ablehnungen nachvollziehbar — nur erfüllt, wenn Abschnitt 11 später umgesetzt wird;
    ohne diesen Schritt bleibt Kriterium 14 **offen**

---

## 17. Rollback Plan

- Reiner Code-Rückbau: die Energie-Erholung ist ein additiver Term ohne Datenmigration,
  ohne Schemaänderung, ohne RLS-Änderung. Rücknahme stellt exakt den heutigen Zustand her.
- Production-Backup vor Phase 1 unter `.lovable/backup/` mit Commit-Stand davor/danach.
- Keine Datenkorrektur nötig: Energie ist eine laufende Zustandsgrösse; nach dem Rückbau
  fällt sie wieder monoton und erreicht ihren alten Wert.
- Abbruchsignal im Betrieb: mehr als eine autonome Frage je Leerlaufphase oder eine Frage
  während aktiver Nutzereingabe → sofortiger Rückbau.

---

## 18. FINDINGS — NO CHANGE MADE

1. **F-1:** `energy` wird an keiner Stelle des Codes erhöht; sie ist eine rein fallende
   Grösse und seit 2026-09-19 in Production 0. (`core.ts:164`, `engine.server.ts:2313`)
2. **F-2:** Der CURIOSITY-Kandidat ist inhaltlich seit Tagen ASK-reif (Wert 0.6324 gegen
   Schwelle 0.20); ausschliesslich das Energie-Tor verhindert die Frage.
3. **F-3:** Der in der Vorgängeranalyse genannte Wert 0.10 gilt nur für den IMPULSE-Pfad;
   die beiden Bewerter sind unterschiedlich weit vom Auslösen entfernt.
4. **F-4:** `conversationalFit` wirkt im IMPULSE-Pfad hart multiplikativ (0.6) und damit
   faktisch als Filter, im CURIOSITY-Pfad nur gedämpft (`soft` → 0.8) als Rangfaktor.
   Diese Asymmetrie ist nicht dokumentiert.
5. **F-5:** Der IMPULSE-Pfad prüft Energie nicht, der CURIOSITY-Pfad prüft sie mit 0.15.
   Bei Energie 0 kann daher nur der IMPULSE-Pfad autonom sprechen (bekannt aus Case 1).
6. **F-6:** Stille Ablehnungen werden nirgends festgehalten; deshalb war die
   Dauerblockade seit 2026-09-19 nur durch nachträgliche Offline-Nachrechnung feststellbar.
7. **F-7:** Der Knoten „Nicht faktisch falsch" ist heute verbunden und fällt damit von
   `missing_information` (P2) auf `missing_context` (P3); die Case-1-Bedingung ist ein
   Datenzustand, keine Schwellenfrage.
8. **F-8:** Eine Neutralisierung des Themenfaktors würde als besten Kandidaten genau die
   bereits gestellte und beantwortete Case-1-Frage hervorbringen; nur die semantische
   Duplikatprüfung verhindert die Wiederholung.
9. **F-9:** Das Energie-Tor 0.12 sperrt neben eigenen Fragen auch FOLLOW_UP und SMALLTALK
   (`conversation.ts:180/194`) sowie `decide` → `stay_silent` (`core.ts:179`).

Keine dieser Feststellungen wurde korrigiert. Kein Code, keine Daten, keine Konfiguration
verändert. Keine autonome Frage ausgelöst.
