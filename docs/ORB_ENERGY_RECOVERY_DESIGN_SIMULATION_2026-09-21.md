# ORB CORE — ENERGY RECOVERY DESIGN & COUNTERFACTUAL SIMULATION

DATUM: 2026-09-21
MODUS: STRICT READ-ONLY / SIMULATION ONLY
UMGEBUNG: PRODUCTION (nur lesend) + Source Code
STATUS: **NO CHANGE MADE** — kein Code, keine DB, keine Migration, keine Schwelle, kein Deployment, keine echte autonome Frage ausgelöst.

---

## 1. Executive Summary

1. Der Energie-Lebenszyklus ist im aktuellen Code **monoton fallend**. Es existiert **keine einzige Stelle**, die `energy` erhöht (Belege in Abschnitt 2). Der einzige „Aufwärts"-Weg ist der Spaltendefault `0.8` beim allerersten Anlegen der Zustandszeile (`orb_state.energy DEFAULT 0.8`).
2. Production-Zustand (Testnutzer `9ce1d1b0…`, gelesen 2026-09-21): `energy = 0`, `curiosity = 0.9925`, `updated_at = 2026-09-21 06:30:27Z`. Der Neugier-Weg ist inhaltlich bereit (bester Lückenwert 0.6324 ≥ Schwelle 0.20) und scheitert **ausschließlich** an `energy < CURIOSITY_MIN_ENERGY (0.15)`.
3. **Zentraler neuer Befund dieser Simulation:** Die Erholungsrate ist nicht frei wählbar. Der Browser-Beobachter fragt nur im Fenster `idleMs ∈ [40 s, 15 min]` (`PROACTIVE_MIN_IDLE_MS`, `PROACTIVE_MAX_IDLE_MS`). Eine Rate, die 0.15 erst nach ≥ 15 Minuten Leerlauf erreicht, erzeugt **im selben Leerlauffenster nie** eine Frage. Damit ist jede Rate ≤ 0.01/min für den Same-Session-Fall praktisch wirkungslos.
4. **Spam ist nicht durch Energie begrenzt, sondern durch bereits vorhandene Tore.** Die maximale tatsächliche Frequenz wird durch `openQuestion` (eine unbeantwortete eigene Frage ⇒ WAIT, in *beiden* Bewertern), den Band-Cooldown (very_high = 120 s), die Duplikatprüfung (Ähnlichkeit ≥ 0.6) und die Kandidatenerschöpfung bestimmt. Historischer Beleg: die zwei bestätigten Fragen vom 19.09. liegen **121 s** auseinander (18:05:15 → 18:07:16) — genau der Cooldown, nicht die Energie.
5. Empfehlung: **Modell B/C — gedeckelte lineare Zeit-Erholung, berechnet beim Lesen des Zustands aus `now − orb_state.updated_at`**, Rate **0.02/min**, Cap **0.25**, Kosten **unverändert 0.03** je eigener Frage, bestehende Verbräuche unverändert. Kein neues Feld, keine Migration, keine Schwellenänderung. Begründung in Abschnitt 18.
6. Nicht implementiert. Der Plan (Abschnitt 19) ist erst nach ausdrücklicher Freigabe umzusetzen.

---

## 2. Current Energy Lifecycle (Code-Belege)

| Vorgang | Ort | Wirkung |
|---|---|---|
| Initialisierung | `orb_state.energy DEFAULT 0.8` (DB-Spaltendefault, gelesen aus `information_schema`); Zeile entsteht in `ensureState()` — `src/orb-core/engine.server.ts:268` (`insert({ user_id })`, keine Energieangabe) | einmalig 0.8 |
| Lesen | `toState()` — `engine.server.ts:264` (`energy: row.energy`) | unverändert |
| Weitergabe | `engine.server.ts:1061`, `:1128`, `:2065`, `:2074`, `:2199`; Prompt-Text `llm/prompt.server.ts:49`; Avatar `integrations/y-dude-orb/avatar.ts:52,57,59,69,130` | nur lesend |
| Verbrauch je Eingabe | `core.ts:164` — `energy: clamp01(state.energy - 0.03 - 0.04 * i)` (i = importance) ⇒ **0.03 bis 0.07 pro verarbeiteter Nachricht** | fallend |
| Verbrauch je eigener Frage | `engine.server.ts:2313` — `energy: Math.max(0, ctx.state.energy - 0.03)` | fallend |
| Persistenz | `engine.server.ts:1491` (Schreiben von `nextState()`-Ergebnis) und `:2313` | nur diese zwei Schreibpfade |
| Erhöhung | **keine** — `rg -n "energy" src/orb-core src/orb-sdk src/integrations/y-dude-orb` liefert keinen Ausdruck, in dem `energy` ein positives Delta erhält; die einzigen Zuweisungen sind `:164` (−) und `:2313` (−) | — |
| Reset | keiner (kein Tages-/Sitzungs-Reset, kein Cron, kein Trigger) | — |
| `updated_at` | Trigger `orb_state_updated_at BEFORE UPDATE … set_updated_at()` (verifiziert in Production) | wird bei **jedem** Zustandsschreibvorgang gesetzt |

**Bestätigung:** Energie wird aktuell **nirgendwo** erhöht. Der Trigger auf `updated_at` ist bedeutsam: er liefert ohne neue Spalte einen deterministischen Zeitanker „letzte Zustandsänderung".

Leser von Energieschwellen (wichtig für Nebenwirkungen):

| Schwelle | Ort | Bedeutung |
|---|---|---|
| `< 0.12` | `core.ts:179` | `decide()` → `stay_silent` |
| `< 0.12` | `conversation.ts:180`, `:194` | FOLLOW_UP und SMALLTALK gesperrt |
| `< 0.15` | `curiosity.ts:285` (`CURIOSITY_MIN_ENERGY`) | Neugier-Weg → WAIT |
| `≥ 0.20` | `avatar.ts:130` | Atembewegung des Avatars sichtbar |
| keine | `impulse.ts` | **Impulsweg prüft Energie nicht** |

---

## 3. Current Blocker

Baseline, mit echter Kernlogik und aktuellen Production-Daten:

| Größe | Wert | Schwelle | Ergebnis |
|---|---|---|---|
| energy | 0.00 | 0.15 (curiosity) | **BLOCK** |
| curiosity | 0.9925 (`very_high`) | > `low` | ok |
| bester Neugier-Lückenwert | 0.6324 (kind `detail`, Topic `reisen`) | 0.20 | ok |
| bester Impuls-Kandidat | 0.1041 (P2 `incomplete_goal`) | 0.20 | BLOCK (unabhängig von Energie) |
| offene eigene Frage | keine (alle 3 `answered = true`) | — | ok |
| Cooldown | letzte eigene Frage 2026-09-20 07:26 | 120 s | ok |
| Idle-Fenster | vom Beobachter geprüft | 40 s … 15 min | ok |

`decideCuriosity` → `WAIT ("Zu wenig Energie")`; `decideImpulse` → `STAY_SILENT ("Mehrwert zu gering")`; `askProactively` kehrt bei `engine.server.ts:2238` still zurück. **Genau eine Größe blockiert den qualitativ bereits erfüllten Weg: Energie.**

---

## 4. Model A — Linear Time Recovery (ohne Cap)

`energy = clamp01(stored + r · Δt)`, Δt = Minuten seit `updated_at`.

Zeit bis `0.15` (erste Frage möglich):

| r /min | 0 | 1 | 2 | 5 | 10 | 20 | 30 | 60 | 120 min | ASK möglich ab | im 15-min-Fenster? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0.005 | 0 | .005 | .01 | .025 | .05 | .10 | .15 | .30 | .60 | 30 min | **nein** |
| 0.010 | 0 | .01 | .02 | .05 | .10 | .20 | .30 | .60 | 1.00 | 15 min | **Grenzfall, praktisch nein** |
| 0.020 | 0 | .02 | .04 | .10 | .20 | .40 | .60 | 1.00 | 1.00 | 7.5 min | **ja** |
| 0.050 | 0 | .05 | .10 | .25 | .50 | 1.00 | 1.00 | 1.00 | 1.00 | 3 min | ja |

Bewertung Modell A: funktioniert, aber ohne Cap steigt Energie auf 1.00. Dann kostet eine Frage 0.03 von 1.00 ⇒ rund **28 Fragen hintereinander** ohne Energiebremse; die Begrenzung läge allein bei Cooldown/openQuestion/Duplikat. Energie verliert damit jede regulierende Funktion. **Nicht empfohlen.**

---

## 5. Model B — Capped Linear Recovery

`energy = min(cap, stored + r · Δt)`. Kosten unverändert 0.03 je Frage.

Mit r = 0.02/min:

| Cap | Zeit bis 0.15 | Zeit bis Cap (von 0) | Burst aus dem Cap (`⌊(cap−0.15)/0.03⌋+1`) | Frage-Mindestabstand im Dauerbetrieb | Nebenwirkung |
|---|---|---|---|---|---|
| 0.15 | 7.5 min | 7.5 min | 1 | max(120 s, 90 s) = 120 s, aber nach jeder Frage 0.12 ⇒ +90 s Nachladen | FOLLOW_UP/SMALLTALK (0.12) bleiben meist gesperrt |
| 0.20 | 7.5 min | 10 min | 2 | 120 s | Avatar-Atmung erreicht Grenze 0.20 |
| 0.25 | 7.5 min | 12.5 min | 4 | 120 s (Cooldown dominiert, Nachladen 90 s) | Atmung sichtbar, FOLLOW_UP/SMALLTALK wieder möglich |
| 0.30 | 7.5 min | 15 min | 6 | 120 s | wie 0.25, mehr Puffer gegen Gesprächsverbrauch |
| 0.40 | 7.5 min | 20 min | 9 | 120 s | Energie wird kaum noch limitierend |
| 0.50 | 7.5 min | 25 min | 12 | 120 s | Energie praktisch wirkungslos |

Wichtig: ab Cap ≈ 0.25 dominiert **nicht mehr die Energie**, sondern der Cooldown. Der Cap steuert also nur noch die **Burst-Tiefe** und die Widerstandsfähigkeit gegen den Gesprächsverbrauch (0.03–0.07 je Nachricht, d. h. ein Cap von 0.25 wird von ca. 4–8 Nachrichten geleert).

---

## 6. Model C — Decay + Recovery

Modell C ist **kein zusätzliches System**: die Abwärtsseite existiert bereits vollständig (`core.ts:164` je Nachricht, `engine.server.ts:2313` je eigener Frage). Modell B auf dem bestehenden Verbrauch **ist** Modell C.

Simulierte Kombinationen (r = 0.02/min, Cap 0.25):

| Ablauf | Energieverlauf | Ergebnis |
|---|---|---|
| 10 min Leerlauf → Frage | 0 → 0.20 → 0.17 | eine Frage, danach weiter über Schwelle |
| 6 Nachrichten Chat (i≈0.5) | 0.25 → 0 (6 × 0.05) | aktives Gespräch entzieht Autonomie — gewünscht |
| Chat, dann 8 min Pause | 0 → 0.16 | eine Frage möglich |
| Frage unbeantwortet | Energie steigt weiter bis Cap | `openQuestion` ⇒ WAIT, **keine zweite Frage** |
| Explizites Abwinken | `impulseDecision.suppressed` | still, unabhängig von Energie |

Eine zusätzliche Energiestrafe bei Ablehnung ist **nicht erforderlich** — `suppressed` und der Cooldown greifen bereits.

---

## 7. Model D — Event-Based Recovery

Energie steigt nur bei Zustandsänderungen (neue Information, erkannte Lücke, Kontextwechsel, relevante Äußerung).

| Kriterium | Bewertung |
|---|---|
| Qualitätsschutz | scheinbar besser, faktisch schlechter: „neue Information" korreliert mit **Chat-Aktivität**, also genau dem Zustand, in dem ORB *nicht* fragen soll |
| Determinismus | schwächer — Energie hängt an Klassifikationsergebnissen, nicht an einer Uhr; forensisch schwer zu rekonstruieren |
| Dauerblockade | nicht gelöst: ohne Gespräch nie Erholung; nach reinem Verbrauch (aktueller Zustand) bleibt 0 |
| Doppelgewichtung | Lücken- und Neuheitssignale sind schon im Kandidatenwert (`gap.score`, `impulseScore`) enthalten — Energie würde sie ein zweites Mal bewerten |
| Aufwand | neue Eventpfade, neue Zustände, neue Tests |

**Nicht empfohlen.** Modell D verlagert Qualität in die Aktivierung, obwohl Qualität schon im Kandidatenfilter liegt (Abschnitt 11).

---

## 8. Energy Cap Analysis

| Cap | erste Frage (r=0.02) | theoretisch mögliche Fragen ohne Nachladen | Nachladezeit je Frage | Spam möglich? | Verhalten bei langem Leerlauf |
|---|---|---|---|---|---|
| 0.15 | 7.5 min | 1 | 90 s | nein | Energie am Minimum, jede Nachricht blockiert erneut |
| 0.20 | 7.5 min | 2 | 90 s | nein | knapper Puffer |
| 0.25 | 7.5 min | 4 | 90 s | nein (Cooldown 120 s + `openQuestion`) | stabil, Puffer für ~4 Nachrichten |
| 0.30 | 7.5 min | 6 | 90 s | nein, aber Energie kaum limitierend | Puffer für ~6 Nachrichten |
| 0.50 | 7.5 min | 12 | 90 s | Energie wirkungslos | — |
| 1.00 | 7.5 min | 28 | 90 s | Energie wirkungslos | — |

Entscheidend: Leerlauf > 15 min sperrt die Frage **ohnehin** (`PROACTIVE_MAX_IDLE_MS`). Ein hoher Cap erzeugt daher keine Fragen während der Abwesenheit, sondern nur einen **Vorratszustand** für die Rückkehr des Nutzers.

---

## 9. Energy Cost Analysis

Nachladezeit je Frage `= cost / r` (r = 0.02/min), Mindestabstand `= max(120 s Cooldown, cost/r)`:

| Cost | Nachladen | effektiver Mindestabstand | theoretische Maximalfrequenz | Bewertung |
|---|---|---|---|---|
| 0.05 | 2.5 min | 150 s | 24/h | Kosten dominieren leicht |
| 0.10 | 5 min | 300 s | 12/h | deutlich konservativer |
| 0.15 | 7.5 min | 450 s | 8/h | sehr zurückhaltend |
| 0.20 | 10 min | 600 s | 6/h | Autonomie fast wieder blockiert |
| 0.25 | 12.5 min | 750 s | ~5/h | zu restriktiv |
| 0.30 | 15 min | 900 s | 4/h | Konflikt mit 15-min-Fenster |
| **0.03 (bestehend)** | 1.5 min | **120 s (Cooldown)** | 30/h theoretisch | **unverändert lassen** |

Beispiel (Cost 0.03, r 0.02, Cap 0.25): Energie 0.20 → ASK → 0.17 → nach 90 s 0.20 → nächster ASK erst nach 120 s Cooldown **und** nur wenn die vorige Frage beantwortet ist und ein nicht-duplikater Kandidat ≥ Schwelle existiert.

**Empfehlung: Kosten nicht anfassen.** Eine Kostenerhöhung wäre eine verdeckte zweite Schwellenänderung; die Frequenz wird schon vom Cooldown bestimmt.

---

## 10. User Activity Analysis

| Ereignis | heutige Wirkung auf Energie | Empfehlung |
|---|---|---|
| USER ACTIVE (Nachricht) | −0.03 − 0.04·i (`core.ts:164`) | unverändert — wirkt korrekt als Autonomiedämpfer |
| USER SILENT | keine | **einzige Änderung**: + r·Δt, gedeckelt |
| USER ANSWERS QUESTION | −0.03 − 0.04·i (normale Eingabe); `answered = true` hebt `openQuestion` | unverändert |
| USER IGNORES QUESTION | keine; `openQuestion` bleibt ⇒ WAIT in beiden Bewertern | unverändert — bereits wirksamste Bremse |
| USER REJECTS QUESTION | `impulseDecision.suppressed` ⇒ still | unverändert, **keine** Energiestrafe nötig |
| ORB fragt selbst | −0.03 (`:2313`) | unverändert |

Zusätzlich: Tippen, Sprechen, Mikrofon, Tabwechsel setzen die Leerlaufuhr im Beobachter zurück (`use-orb-presence.ts:84–95`) — unverändert.

---

## 11. Quality Gate Analysis

Energie ist in der Kette nur das **Aktivierungstor**, nicht das Qualitätsmaß. Bestehende, unangetastete Tore in Ausführungsreihenfolge:

```
Beobachter: Tab sichtbar · nicht tippend · Mikro aus · ORB spricht nicht ·
            nichts pending · 40 s ≤ idle ≤ 15 min · Band ≠ low · Cooldown
   ↓
askProactively → decideCuriosity: Lücken vorhanden · Neugierband ·
            ENERGIE ≥ 0.15 · keine offene Frage · Cooldown · Wert ≥ 0.20
   ↓        decideImpulse: suppressed · Duplikat · bekannte Antwort ·
            Kandidatenwert ≥ 0.20 · offene Frage · Cooldown
   ↓
Sprachschicht verfügbar → semantische Duplikatprüfung (≥ 0.6) → Frage
```

Energie öffnet ausschließlich das Tor in Zeile 2. Alle Qualitätsurteile (Lücke, Wichtigkeit, Konfidenz, Zukunftsrelevanz, Themenpassung, Duplikat) bleiben unverändert. Ohne guten Kandidaten führt **jede** Energiehöhe zu Stillschweigen (`DO_NOTHING` bei `gaps.length === 0`).

---

## 12. Current Case Replay (echte Daten, 2026-09-21)

Ausgang: `energy 0`, `curiosity 0.9925`, `updated_at 06:30:27Z`, bester Neugier-Wert 0.6324 (`detail`, Topic `reisen`), bester Impuls-Wert 0.1041, Themenfaktor 0.6 (Gespräch handelt von ORB selbst).

| Modell | Parameter | erste autonome Frage | welche Frage | warum |
|---|---|---|---|---|
| A linear | r 0.005 | nie im selben Fenster; nur nach Rückkehr des Nutzers | Detail-Frage zu `reisen` | 0.15 erst nach 30 min, Fenster endet bei 15 min |
| A linear | r 0.02 | 7.5 min Leerlauf | Detail-Frage zu `reisen` (Wert 0.63) | Energie 0.15 erreicht, Wert bereits über Schwelle |
| B Cap 0.20 | r 0.02 | 7.5 min | dito | Cap über Schwelle |
| **B/C Cap 0.25** | **r 0.02, Cost 0.03** | **7.5 min** | **dito** | empfohlene Variante |
| B Cap 0.15 | r 0.02 | 7.5 min | dito | funktioniert, aber ohne Puffer |
| D event-based | — | unbestimmt | — | Erholung nur bei Aktivität, die selbst blockiert |

Der Impulsweg bleibt in allen Varianten still (0.1041 < 0.20) — Energie ändert daran nichts, weil `impulse.ts` Energie nicht prüft.

---

## 13. Case 1 Replay (2026-09-20 07:26:11.726Z)

Fakten (unverändert übernommen): Impulsweg, `energy = 0`, `gap_kind kontext`, Score 0.36288, Knoten „Nicht faktisch falsch" (importance 0.8, 0 Verbindungen), Frage `a95656dc…`.

| Modell | Ergebnis |
|---|---|
| A / B / C / D | **identisch reproduzierbar** — der Impulsweg enthält kein Energietor; Case 1 ist ein Datenzustandsfall (wichtiger, unverbundener Knoten), kein Energiefall |

Case 1 verlangt **keine** Sonderlogik und wird von keinem Modell verändert.

---

## 14. Case 2 Replay (2026-09-19 18:05:12.998Z)

Fakten: Neugier-Weg, `energy = 0.618`, Wert 0.40446, `gap_kind detail`, Topic `erzähle`, Frage `145b70ef…`; Replikation `96e14f0d…` um 18:07:16.856 ⇒ Abstand **121 s** ≈ Cooldown 120 s.

| Modell | Energie zum Zeitpunkt | Ergebnis |
|---|---|---|
| A (ohne Cap) | 0.618 | reproduzierbar |
| B Cap 0.25 | auf 0.25 begrenzt | **reproduzierbar** (0.25 ≥ 0.15, Wert 0.404 ≥ 0.20) |
| B Cap 0.20 | 0.20 | reproduzierbar |
| B Cap 0.15 | 0.15 | reproduzierbar, aber die Replikation nach 121 s wäre nur knapp möglich (0.15 → 0.12 → 90 s Nachladen) |
| C | wie B | reproduzierbar |
| D | unbestimmt | nicht garantiert |

Wichtig: Die historisch akzeptierte Frequenz war **cooldown-begrenzt**, nicht energiebegrenzt. Ein Cap ≥ 0.20 erhält dieses bestätigte Verhalten exakt; Cap 0.15 verändert es leicht.

### Übersicht

| Model | Case 1 | Case 2 | Current Case |
|---|---|---|---|
| Linear (kein Cap) | reproduzierbar | reproduzierbar | Frage nach 7.5 min (r 0.02) |
| **Capped Linear (0.25 / 0.02 / 0.03)** | **reproduzierbar** | **reproduzierbar** | **Frage nach 7.5 min** |
| Decay + Recovery (= B auf bestehendem Verbrauch) | reproduzierbar | reproduzierbar | Frage nach 7.5 min |
| Event Based | reproduzierbar (Impuls) | nicht garantiert | unbestimmt |

---

## 15. Spam Simulation (r 0.02/min, Cap 0.25, Cost 0.03)

| Leerlauf | Energieverlauf | Kandidaten | tatsächlich mögliche Fragen | begrenzender Faktor |
|---|---|---|---|---|
| 30 min | 0 → 0.25 (nach 12.5 min) | mehrere | **1** (nur Minuten 0.67–15 erlaubt); danach `openQuestion` | Idle-Fenster + openQuestion |
| 1 h | am Cap | mehrere | 1 | Idle-Fenster 15 min |
| 2 h | am Cap | mehrere | 1 | dito |
| 4 h | am Cap | mehrere | 1 | dito |
| 8 h | am Cap | mehrere | 1 | dito |
| Nutzer kommt zurück, antwortet, pausiert 40 s | 0.25 → ~0.20 → ASK → 0.17 → … | abhängig von Antwort | ≤ 1 je 120 s, nur bei jeweils beantworteter Vorfrage und nicht-duplikatem Kandidaten | Cooldown + Duplikat + Kandidatenvorrat |

Theoretische Obergrenze 30 Fragen/h; **realistische** Obergrenze: der Nutzer müsste jede Frage innerhalb von ~2 min beantworten und es müsste jedes Mal ein neuer, nicht ähnlicher Kandidat ≥ 0.20 existieren. Der Kandidatenvorrat ist endlich (12 Knoten, 8 Interessen, Threads) und jede gestellte Frage sperrt ihr Thema per Duplikatprüfung.

---

## 16. Edge Cases

| Fall | Entscheidung | Grund |
|---|---|---|
| A kein Kandidat | DO NOT ASK | `gaps.length === 0` → `DO_NOTHING`, Energie irrelevant |
| B schlechter Kandidat | DO NOT ASK | Wert < 0.20 |
| C sehr guter Kandidat | ASK, wenn Energie ≥ 0.15 | Zielverhalten |
| D mehrere Kandidaten | ASK nur für den besten (`gaps[0]`) | Sortierung unverändert |
| E gleiche Frage erneut | DO NOT ASK | Duplikat in `deriveKnowledgeGaps`, `decideImpulse` und `isDuplicateQuestion` |
| F Nutzer antwortet sofort | Cooldown 120 s, dann erneut möglich | unverändert |
| G Nutzer ignoriert | DO NOT ASK auf Dauer | `openQuestion` ⇒ WAIT in beiden Bewertern |
| H Nutzer lehnt ab | DO NOT ASK | `impulseDecision.suppressed` |
| I langer Leerlauf (> 15 min) | DO NOT ASK | `PROACTIVE_MAX_IDLE_MS` |
| J kurzer Leerlauf (< 40 s) | DO NOT ASK | `PROACTIVE_MIN_IDLE_MS` |
| K Energie am Cap | ASK nur bei gutem Kandidaten | Qualitätstore bleiben |
| L knapp unter 0.15 (0.149) | DO NOT ASK | `< CURIOSITY_MIN_ENERGY` |
| M knapp über 0.15 (0.150) | ASK möglich | Vergleich ist `<`, 0.15 passiert |

---

## 17. Parameter Comparison

| Profil | Recovery | Cap | Cost | erste Frage (Leerlauf) | theoret. Max | Risiko |
|---|---|---|---|---|---|---|
| CONSERVATIVE | 0.01/min | 0.20 | 0.03 | 15 min → **außerhalb des Idle-Fensters**; nur nach Rückkehr | 20/h | Autonomie bleibt im laufenden Gespräch praktisch blockiert; Ziel womöglich nicht erreicht |
| **BALANCED (empfohlen)** | **0.02/min** | **0.25** | **0.03** | **7.5 min** | 30/h theoretisch, real ≪ | gering; Cooldown und `openQuestion` bleiben Frequenzregler |
| ACTIVE | 0.05/min | 0.40 | 0.03 | 3 min | 30/h | Energie verliert regulierende Wirkung; Fragen wirken aufdringlich |

Sinnvoller Ratenbereich, hergeleitet aus dem Code: `0.15/r < 15 min` ⇒ **r > 0.01/min**; und `0.15/r > 40 s` (nicht sofort nach jeder Zustandsänderung) ⇒ **r < 0.225/min**. Sinnvoller Cap: `≥ 0.15 + Cost` für eine Folgefrage und `≥ 0.20` zur Erhaltung des bestätigten Case-2-Verhaltens ⇒ **0.20–0.30**. Sinnvolle Kosten: unverändert 0.03, da die Frequenz ohnehin cooldown-begrenzt ist.

---

## 18. Recommended Model

**Modell B/C — gedeckelte lineare Zeit-Erholung, beim Lesen berechnet.**

Parameter: Recovery **0.02/min**, Cap **0.25**, Cost **unverändert 0.03**, Verbrauch je Nachricht unverändert.
Ort der Änderung: **eine** Stelle — `toState()` in `src/orb-core/engine.server.ts:257`, wo `row.energy` in den Zustand übernommen wird, ergänzt um `min(cap, row.energy + 0.02 · minutesSince(row.updated_at))`. Keine neue Spalte, keine Migration, kein Cron, kein neues Modul.

Warum:
- **Kleinste Änderung:** ein additiver Term an einer Lesestelle; reversibel durch Entfernen dieser Zeile.
- **Deterministisch:** Energie ist eine reine Funktion aus gespeichertem Wert und Uhrzeit; jede autonome Frage bleibt forensisch nachrechenbar.
- **Warum nicht Modell A:** ohne Cap verliert Energie jede regulierende Wirkung (bis 28 Fragen aus einem Vorrat).
- **Warum nicht Modell D:** Erholung hinge an Gesprächsaktivität — genau dem Zustand, der Autonomie unterdrücken soll; zusätzlich Doppelbewertung der Lückensignale und schlechtere Rekonstruierbarkeit.
- **Warum nicht Schwellen-/Kostenänderung:** würde die bestätigte Entscheidungslogik verändern; hier bleibt jede Schwelle unangetastet.
- **Case 1:** unverändert (Impulsweg ohne Energietor).
- **Case 2:** reproduzierbar, inklusive des 121-s-Abstands der Replikation (Cap 0.25 ≥ 0.15 + 0.03).
- **Current Case:** erste eigene Frage nach 7.5 min Leerlauf, Detail-Lücke zu Topic `reisen` (Wert 0.63).
- **Spam-Verhinderung:** Energie ist nicht der Frequenzregler — `openQuestion` (max. eine unbeantwortete Frage), Cooldown 120 s, Duplikatprüfung 0.6, Idle-Fenster 40 s–15 min, Kandidatenschwelle 0.20 bleiben vollständig unverändert.

Bewusst in Kauf genommene Nebenwirkungen (zu bestätigen vor Umsetzung):
1. Energie > 0.12 aktiviert auch wieder **FOLLOW_UP** und **SMALLTALK** (`conversation.ts:180,194`) sowie `decide()` jenseits von `stay_silent` (`core.ts:179`).
2. Energie ≥ 0.20 macht die Avatar-Atmung wieder sichtbar (`avatar.ts:130`).
3. Der im Prompt genannte Energiewert (`prompt.server.ts:49`) wird nicht mehr dauerhaft `0.00` sein.

---

## 19. Implementation Plan (erst nach ausdrücklicher Freigabe)

| Phase | Änderung | Test | Erfolgskriterium | Rollback |
|---|---|---|---|---|
| 1 — Energie-State definieren | keine Codeänderung; Konstanten `ENERGY_RECOVERY_PER_MIN = 0.02`, `ENERGY_RECOVERY_CAP = 0.25` dokumentieren, Herleitung aus Idle-Fenster festhalten | Review | Parameter aus dem Code hergeleitet, nicht gewählt | entfällt |
| 2 — Recovery | reine Funktion `recoverEnergy(stored, updatedAt, now)` in `src/orb-core/core.ts` (keine I/O) | Unit-Tests: 0/1/2/5/10/20/30/60/120 min | Werte identisch zur Tabelle in Abschnitt 4 | Datei-Revert |
| 3 — Cap | Cap in derselben Funktion; Anwendung in `toState()` (`engine.server.ts:257`) | Unit + Vertragstest SDK/Core | Cap nie überschritten, `stored` nie geschrieben | eine Zeile entfernen |
| 4 — Consumption | **keine Änderung** (0.03 / 0.03+0.04·i bleiben) | Regressionstests `nextState`, `askProactively` | Verbrauchswerte unverändert | entfällt |
| 5 — Tests | Testplan Abschnitt 20 | vollständige Suite + ORB-Tests | alle grün, keine Schwellen-Snapshots geändert | entfällt |
| 6 — Staging | Deploy nach Staging, Leerlauf 8 min beobachten | manueller Leerlauftest | genau eine Frage, danach Stille bis zur Antwort | Staging-Revert |
| 7 — Production Verification | Deploy nach Freigabe, danach Lesen von `orb_state`, `orb_questions`, `orb_metrics kind=proactive` | Vergleich mit Case-1-/Case-2-Fingerprint | `proactive: true` + `question_id` vorhanden, Abstände ≥ 120 s, keine Duplikate | Backup-Verzeichnis + Revert der einen Codestelle |

---

## 20. Test Plan

1. `recoverEnergy` liefert für Δt = 0 den gespeicherten Wert.
2. Monotonie: Δt ↑ ⇒ Energie nicht fallend.
3. Cap wird nie überschritten (Δt = 10 000 min).
4. Gespeicherter Wert wird durch Erholung nicht geschrieben (kein DB-Write).
5. `decideCuriosity` bleibt `WAIT` bei Energie 0.149 und wird `ASK` bei 0.150 (Kandidat ≥ 0.20).
6. Ohne Kandidaten bleibt es bei Energie am Cap `DO_NOTHING`.
7. `openQuestion = true` ⇒ WAIT trotz Energie am Cap.
8. Cooldown < 120 s ⇒ WAIT trotz Energie am Cap.
9. Duplikatfrage wird weiter verworfen (Ähnlichkeit ≥ 0.6).
10. `suppressed` (Abwinken) ⇒ still trotz Energie am Cap.
11. Idle < 40 s und > 15 min ⇒ Beobachter fragt nicht.
12. Case-1-Replay: Impulsweg entscheidet identisch bei Energie 0 und bei Energie am Cap.
13. Case-2-Replay: `ASK` mit Wert 0.404, gap_kind `detail`.
14. Gedächtnisverhalten unverändert: Wichtigkeit 0.35, Decay, Recall, Verbindungen, Eligibility — bestehende Tests unverändert grün.
15. Kein Endlospfad: zwei aufeinanderfolgende Ticks im selben Cooldown erzeugen genau eine Frage.

---

## 21. Rollback Plan

- Umfang der Änderung: eine neue reine Funktion + ein additiver Term in `toState()`. Rollback = Entfernen dieser beiden Stellen; keine Datenmigration nötig, da **kein** persistenter Wert verändert wird (`orb_state.energy` wird weiterhin nur von den bestehenden zwei Schreibpfaden gesetzt).
- Vor dem Deploy: Backupverzeichnis `.lovable/backup/pre_orb_energy_recovery_<datum>/`, Production-Commit vor/nach notieren.
- Abbruchkriterien: mehr als eine unbeantwortete eigene Frage, Frageabstand < 120 s, Duplikatfrage, Änderung an Gedächtniswerten, rote Tests.
- Sofortmaßnahme im Zweifel: Cap auf den gespeicherten Wert setzen (= Erholung aus), dann regulärer Revert.

---

## 22. FINDINGS — NO CHANGE MADE

1. **F-1** `energy` wird im gesamten Code nur verringert (`core.ts:164`, `engine.server.ts:2313`); es existiert kein Erhöhungs-, Reset- oder Regenerationspfad. Der Nullzustand seit 2026-09-19 ist strukturell, nicht datenbedingt. *Nicht geändert.*
2. **F-2** Der Impulsweg (`impulse.ts`) prüft Energie überhaupt nicht, der Neugier-Weg mit 0.15 — asymmetrische Tore am gemeinsamen autonomen Pfad. *Nicht geändert.*
3. **F-3** Erholungsraten ≤ 0.01/min können im selben Leerlauffenster nie eine Frage erzeugen, weil `PROACTIVE_MAX_IDLE_MS` bei 15 min sperrt. Rate und Idle-Fenster sind gekoppelt; diese Kopplung ist im Code nirgends dokumentiert. *Nicht geändert.*
4. **F-4** Der Gesprächsverbrauch (0.03–0.07 je Nachricht) übersteigt jede plausible Erholungsrate deutlich; ein Cap ≤ 0.30 wird von 4–6 Nachrichten vollständig geleert. *Nicht geändert.*
5. **F-5** Die Frequenzgrenze des autonomen Pfades ist faktisch `openQuestion` + Cooldown, nicht Energie. Historischer Beleg: 121 s Abstand zwischen `145b70ef…` und `96e14f0d…`. *Nicht geändert.*
6. **F-6** `orb_state.energy DEFAULT 0.8` ist der einzige Aufwärtsvorgang im System und wirkt nur einmal beim Anlegen der Zeile. *Nicht geändert.*
7. **F-7** Eine Energie-Erholung reaktiviert zwangsläufig auch die 0.12-Tore für FOLLOW_UP/SMALLTALK und `decide()` sowie die 0.20-Avatar-Atmung — Nebenwirkungen über den autonomen Pfad hinaus. *Nicht geändert.*
8. **F-8** Stille Ablehnungen des autonomen Pfades werden weiterhin nicht persistiert; die Wirksamkeit einer späteren Erholung ist ohne solche Einträge nur indirekt messbar. *Nicht geändert, kein Konzept implementiert.*
9. **F-9** Der Trigger `orb_state_updated_at` macht eine zeitbasierte Erholung ohne neue Spalte möglich; gleichzeitig wird `updated_at` auch von der Frage-Buchung (`:2313`) gesetzt, wodurch eine eigene Frage die Erholungsuhr zurücksetzt — das ist gewollt, aber implizit. *Nicht geändert.*

---

**READ-ONLY bestätigt:** Es wurden ausschließlich Quelldateien gelesen sowie lesende Abfragen auf `information_schema`, `pg_trigger`, `orb_state`, `orb_messages` und `orb_questions` ausgeführt. Keine Schreiboperation, keine Migration, kein Deployment, keine erzeugte autonome Frage.
