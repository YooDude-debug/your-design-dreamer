# ORB CORE — ENERGY RECOVERY IMPLEMENTATION (Controlled Production Live Test)

DATUM: 2026-09-21
UMGEBUNG: PRODUCTION (bewusst als Live-Testumgebung freigegeben)
SCOPE: ausschliesslich Energie-Erholung 0.02/min mit Cap 0.25; Kosten 0.03 unverändert
PRODUCTION CHANGED: **JA (Code)** · DATABASE CHANGED: **NEIN** · SCHEMA/RLS CHANGED: **NEIN** · THRESHOLDS CHANGED: **NEIN**

---

## 1. Executive Summary

Die einzige freigegebene Änderung wurde umgesetzt: eine zeitbasierte, gedeckelte Energie-Erholung. Sie besteht aus einer neuen reinen Funktion `recoverEnergy()` in `src/orb-core/core.ts` und einem Aufruf an genau einer Lesestelle (`toState()` in `src/orb-core/engine.server.ts`). Es wurde keine Schwelle, keine Entscheidungslogik, kein Cooldown, keine Duplikatprüfung, kein Listening, kein Schema, keine API und keine UI berührt. Die Energiekosten einer eigenen Frage bleiben exakt 0.03.

Alle Prüfungen sind grün: Typecheck, ESLint (`src/orb-core` + neue Testdatei), 1086 Logiktests in 70 Dateien, 77 DB-/Sicherheitstests in 9 Dateien, Build OK.

Der Live-Test mit dem realen mobilen Client ist damit möglich. Der Zustand des Testnutzers ist unverändert gespeichert (`energy = 0`, `updated_at 2026-09-21 06:30:27Z`); die Erholung wird erst beim Lesen berechnet. Abschnitte 8–12 und 15–17 dieses Berichts sind bis zum tatsächlichen Live-Ereignis **ausdrücklich offen** und werden nur mit echter Evidenz gefüllt — es wurde keine Frage künstlich ausgelöst und kein Energiewert gesetzt.

---

## 2. Production Baseline

| Punkt | Befund |
|---|---|
| Commit vor der Änderung | `cd1cde68956d605ff65f510bde27d0d4da4a4b5f` („Energy-Recovery-Plan simuliert") |
| Energie-Zustandsvariable | `orb_state.energy` (double precision, Default 0.8), in den Code gelesen über `toState()` (`engine.server.ts:258`) |
| Bestehende Kostenlogik | `core.ts:164` `energy − 0.03 − 0.04·importance` je Eingabe; `engine.server.ts:2314` `energy − 0.03` je eigener Frage |
| Schreibpfade | genau zwei: `engine.server.ts:1492` (Zustand nach Eingabe) und `:2314` (nach eigener Frage) |
| Kleinste Codestelle für Erholung | die Lesestelle `toState()` — dort fliesst `row.energy` als einziger Einstiegspunkt in jede Entscheidung |
| Persistenz vs. Berechnung | Erholung wird **nicht** persistiert, sondern beim Lesen aus `row.updated_at` berechnet; `updated_at` wird vom bestehenden Trigger `orb_state_updated_at` bei jedem Zustandsschreibvorgang gesetzt |
| Mehrere Tabs / Sessions | unkritisch: die Erholung ist eine reine Funktion von gespeichertem Wert und Uhrzeit; parallele Leser berechnen denselben Wert, es entsteht keine Addition |
| Race Conditions | keine neue: es gibt keinen zusätzlichen Schreibpfad. Zwei gleichzeitige Schreibvorgänge verhielten sich schon vor der Änderung als „last write wins"; der Cap begrenzt das Ergebnis in jedem Fall |
| Production-Zustand Testnutzer `9ce1d1b0…` | `energy 0`, `curiosity 0.9925`, `updated_at 2026-09-21 06:30:27.017903Z`, 3 eigene Fragen (alle beantwortet), letzte eigene Frage 2026-09-20 07:26 |
| Backup | `.lovable/backup/pre_orb_energy_recovery_2026-09-21/` mit `core.ts` und `engine.server.ts` im Stand vor der Änderung |

---

## 3. Exact Code Change

Zwei Dateien, drei Stellen:

1. `src/orb-core/core.ts` — neu nach `shouldPersist()`:

```ts
export const ENERGY_RECOVERY_PER_MIN = 0.02;
export const ENERGY_RECOVERY_CAP = 0.25;

export function recoverEnergy(stored: number, updatedAtMs: number, nowMs: number): number {
  const base = clamp01(stored);
  if (base >= ENERGY_RECOVERY_CAP) return base;
  if (!Number.isFinite(updatedAtMs) || !Number.isFinite(nowMs)) return base;
  const elapsedMin = Math.max(0, nowMs - updatedAtMs) / 60_000;
  return Math.min(ENERGY_RECOVERY_CAP, base + elapsedMin * ENERGY_RECOVERY_PER_MIN);
}
```

2. `src/orb-core/engine.server.ts:28` — `recoverEnergy` dem bestehenden Core-Import hinzugefügt.

3. `src/orb-core/engine.server.ts:258` — `toState()`:

```ts
energy: recoverEnergy(row.energy, new Date(row.updated_at).getTime(), Date.now()),
```

Neu ausserdem: `tests/orb-energy-recovery.test.ts` (13 Tests, nur Prüfcode).

**Nicht angefasst:** `curiosity.ts` (Schwellen 0.20 / 0.15), `impulse.ts` (0.20 / 0.6), `presence.ts` (Idle-Fenster, Cooldowns), `conversation.ts` (Follow-up/Smalltalk), `avatar.ts`, `askProactively()`-Entscheidungslogik, Idle Observer, Action Dispatch, Schema, RLS, API, UI, Memory.

---

## 4. Energy Recovery Implementation

Die Erholung ist zeitbasiert und aufrufunabhängig — `E = min(0.25, E₀ + Δt_min · 0.02)`, wobei `Δt` aus `orb_state.updated_at` stammt. Getestete Werte (`tests/orb-energy-recovery.test.ts`):

| Δt | Energie |
|---|---|
| 0 min | 0.00 |
| 1 min | 0.02 |
| 5 min | 0.10 |
| 7.5 min | 0.15 (Neugier-Tor öffnet) |
| 10 min | 0.20 |
| 12.5 min | 0.25 (Cap) |
| > 12.5 min | 0.25 |

Zusätzlich abgesichert: negative Zeitdifferenzen und ungültige Zeitstempel liefern den gespeicherten Wert; ein gespeicherter Wert über dem Cap (z. B. der Startwert 0.8) wird **nicht** gesenkt.

---

## 5. Energy Cap

Cap 0.25, erzwungen innerhalb der reinen Funktion (`Math.min`). Der Cap gilt damit unabhängig von Leerlaufdauer, Aufrufzahl, Eventzahl, parallelen Tabs und parallelen Berechnungen, weil kein Vorgang addiert, sondern jeder Aufruf den Wert neu aus Speicherwert und Uhrzeit bestimmt. Test: 13 min, 600 min und 10 000 min ergeben exakt 0.25.

---

## 6. Energy Cost

Unverändert. `core.ts:164` (−0.03 − 0.04·importance je Eingabe) und `engine.server.ts:2314` (−0.03 je eigener Frage) wurden nicht berührt; ein Test fixiert den Verbrauch (0.25 → 0.20 bei importance 0.5) und die Parameter (`0.02`, `0.25`, `CURIOSITY_MIN_ENERGY = 0.15`).

---

## 7. Build / Deployment Result

| Prüfung | Ergebnis |
|---|---|
| Typecheck (`tsgo --noEmit`) | grün, keine Ausgabe |
| ESLint (`src/orb-core`, neue Testdatei) | grün, keine Ausgabe |
| Logiktests (`vitest run`) | **1086 Tests in 70 Dateien grün** (vorher 1073 in 68/69 Dateien; +13 neue Tests) |
| DB-/Sicherheitstests (`test:db`) | **77 Tests in 9 Dateien grün**, inkl. RLS-Vertrag und Wertebereich 0..1 auf allen ORB-Tabellen |
| Build | `build OK` (Buildprotokoll 2026-09-21T07:27:53Z und später) |
| Commit-Stand nach der Änderung | `42d804f128fc41369850430f1692449bb8ac69ef` (vor Veröffentlichung) |
| Veröffentlichung Production | im Anschluss an diesen Bericht angefordert |

---

## 8. Mobile Live Test

**OFFEN — durch den Nutzer am realen mobilen Client durchzuführen.**
Vorgehen wie freigegeben: kein künstliches Setzen von Energie, keine Schwellenänderung, kein manuelles Auslösen. Erwartung ab dem Deploy:

- gespeicherter Wert bleibt 0; die Erholung wirkt ab dem letzten Zustandsschreibvorgang
- `updated_at` des Testnutzers war beim Abschluss der Implementierung 58.5 Minuten alt ⇒ beim ersten Lesen nach dem Deploy liegt die Energie rechnerisch am Cap 0.25
- erst eine neue Eingabe senkt sie wieder (0.03–0.07), danach greift die Erholung mit 0.02/min
- eine eigene Frage ist möglich, sobald ≥ 0.15 **und** ein Kandidat ≥ 0.20 vorliegt und alle bestehenden Tore erfüllt sind (Idle 40 s–15 min, keine offene Frage, Cooldown, kein Duplikat)

---

## 9. Energy Timeline

**OFFEN** — wird nach dem Live-Test aus `orb_state` und `orb_messages.state_snapshot` (Feld `energy`) gefüllt. Zu erfassen: Zeitpunkt des Überschreitens von 0.12, von 0.15 und von 0.20.

---

## 10. First Autonomous Question Event

**OFFEN** — beim ersten Ereignis zu sichern: Zeitstempel, Energie vor/nach, Kandidat, Score, Curiosity, Impuls, Gap, Topic, Priority, `proactive: true`, `question_id`, zugehörige Zeile in `orb_questions` und `orb_metrics kind=proactive`, Nachweis Kosten 0.03.

---

## 11. Runtime Evidence

Bis zum Live-Ereignis liegt nur Baseline-Evidenz vor (Abschnitt 2, gelesen 2026-09-21 07:28:57Z): `energy 0`, `updated_at 06:30:27Z`, Leerlauf 58.51 min. Kein Datensatz wurde geschrieben.

---

## 12. Spam / Frequency Test

**OFFEN** im Live-Betrieb. Unverändert wirksame Bremsen (durch Tests belegt, Abschnitt 4 der Testdatei):

| Schutz | Status am Cap 0.25 |
|---|---|
| kein Kandidat | `DO_NOTHING` — belegt |
| schwacher Kandidat (0.10 < 0.20) | `WAIT` — belegt |
| offene, unbeantwortete Frage | `WAIT` — belegt |
| Cooldown (120 s bei `very_high`) | `WAIT` — belegt |
| semantische Duplikatprüfung (≥ 0.6) | unverändert im Code |
| Idle-Fenster 40 s … 15 min | unverändert im Beobachter |

Energie ermöglicht also nur die Aktivierung und entscheidet nicht allein über ASK.

---

## 13. Case 1 Regression

Case 1 (2026-09-20 07:26:11.726Z, Impulsweg, `energy = 0`, Score 0.36288, Frage `a95656dc…`) ist unverändert: `impulse.ts` enthält kein Energietor und wurde nicht angefasst. Die Änderung kann das damalige Ergebnis nicht verschieben, weil sie nur den Wert erhöht, den der Impulsweg ohnehin nicht liest. Alle bestehenden Impuls-Tests bleiben grün.

---

## 14. Case 2 Regression

Case 2 (2026-09-19 18:05:12.998Z, Neugier-Weg, `energy 0.618`, Score 0.40446, Frage `145b70ef…`, Replikation nach 121 s) bleibt reproduzierbar: bei Energie am Cap 0.25 (≥ 0.15) und Score 0.404 (≥ 0.20) entscheidet `decideCuriosity` weiterhin `ASK`; der 121-s-Abstand war cooldown- und nicht energiebegrenzt, und nach Kosten 0.03 liegt die Energie mit 0.22 weiter über der Schwelle. Entscheidungslogik unverändert.

---

## 15. Follow-up / Smalltalk Observation

Die 0.12-Tore in `conversation.ts:180` (FOLLOW_UP) und `:194` (SMALLTALK) sowie `core.ts:179` (`decide()` → `stay_silent`) werden durch die Erholung faktisch wieder passierbar. **Code unverändert.** Im Live-Test zu beobachten und zu dokumentieren: Zeitpunkt des Überschreitens von 0.12, ob FOLLOW_UP auftritt, ob SMALLTALK auftritt, ob die übrigen Bedingungen (Konfidenz, Kontextmenge, Gesprächsanschluss) weiter korrekt greifen. **OFFEN.**

---

## 16. Avatar Observation

`avatar.ts:130` macht die Atembewegung ab Energie ≥ 0.20 sichtbar. Cap 0.25 überschreitet diese Grenze. **Code unverändert**, Beobachtung im Live-Test **OFFEN.**

---

## 17. Multi-Tab / Race Analysis

| Frage | Ergebnis |
|---|---|
| Kann Energie doppelt erhöht werden? | Nein — kein Aufruf addiert; jeder Leser berechnet `min(cap, stored + Δt·rate)` neu |
| Kann der Cap umgangen werden? | Nein — `Math.min` innerhalb der reinen Funktion, unabhängig von Aufrufzahl |
| Kann Zustand überschrieben werden? | Nur über die bereits vorhandenen zwei Schreibpfade; Verhalten wie vor der Änderung („last write wins") |
| Mehrfache Erholungsberechnungen? | Ja, aber idempotent — identische Eingaben liefern identische Ergebnisse (Test „aufrufunabhängig") |
| Neue Architektur eingeführt? | Nein |

Kein blockierendes Problem gefunden, daher kein STOPP.

---

## 18. Unexpected Findings

1. **U-1** `updated_at` wird auch von der Fragebuchung (`engine.server.ts:2314`) gesetzt. Eine eigene Frage setzt damit die Erholungsuhr zurück — Nebenwirkung des gewählten Zeitankers, sie wirkt zusätzlich dämpfend und wurde nicht verändert.
2. **U-2** Da der gespeicherte Wert des Testnutzers seit 06:30 unverändert ist, liegt die Energie beim ersten Lesen nach dem Deploy sofort am Cap. Der Zeitverlauf 0 → 0.15 lässt sich daher erst nach der nächsten Eingabe beobachten (die Energie senkt) — das ist keine Fehlfunktion, sondern Folge der Zeitbasis.
3. **U-3** Beim nächsten regulären Zustandsschreibvorgang wird der erholte Wert mitgeschrieben (`engine.server.ts:1492` schreibt das Ergebnis von `nextState()` auf dem gelesenen Zustand). Der persistierte Wert steigt damit indirekt bis maximal Cap minus Verbrauch. Erwartet und durch den Cap begrenzt; nicht verändert.

---

## 19. Rollback Status

- Rollback-Stand: Commit `cd1cde68956d605ff65f510bde27d0d4da4a4b5f`; Dateikopien in `.lovable/backup/pre_orb_energy_recovery_2026-09-21/`.
- Rollback = Entfernen der Funktion in `core.ts`, des Importeintrags und des Aufrufs in `toState()`. Keine Datenmigration nötig, da kein Schema und kein Datensatz geändert wurde.
- Sofortabschaltung ohne Revert: `ENERGY_RECOVERY_CAP` müsste dazu geändert werden — das wäre eine Parameteränderung und ist **nicht** vorab freigegeben; im Zweifel gilt der reguläre Revert.
- Abbruchkriterien für den Live-Test: mehr als eine unbeantwortete eigene Frage, Frageabstand < 120 s, Duplikatfrage, Energie > 0.25, veränderte Gedächtniswerte.

---

## 20. Final Result

| Erfolgskriterium | Status |
|---|---|
| 1 Energie regeneriert kontrolliert von 0 | erfüllt (Code + Tests), Live-Beobachtung offen |
| 2 Energie nie > 0.25 | erfüllt (Test 13/600/10 000 min) |
| 3 zeitbasiert, nicht aufrufbasiert | erfüllt (Test „aufrufunabhängig") |
| 4 autonome Kandidaten wieder erreichbar | erfüllt in der Logik (0.15-Tor öffnet ab 7.5 min), Live offen |
| 5 CURIOSITY unverändert | erfüllt |
| 6 IMPULSE unverändert | erfüllt |
| 7 Schwellen unverändert | erfüllt (Test fixiert 0.15) |
| 8 Listening unverändert | erfüllt |
| 9 Duplikatprüfung unverändert | erfüllt |
| 10 Cooldowns unverändert | erfüllt |
| 11 Kosten 0.03 | erfüllt (Test) |
| 12 keine Spam-Schleife | erfüllt in der Logik (Tests zu offener Frage, Cooldown, schwachem Kandidaten), Live offen |
| 13 Case 1 unverändert | erfüllt (Abschnitt 13) |
| 14 Case 2 unverändert | erfüllt (Abschnitt 14) |
| 15 mobile Production-Runtime | **offen** — Live-Test durch den Nutzer |
| 16 erstes neues autonomes Ereignis forensisch nachweisbar | **offen** — Abschnitte 9–11 werden nach dem Ereignis ergänzt |

---

## 21. FINDINGS — NO CHANGE MADE

1. **F-1** Der Impulsweg prüft weiterhin keine Energie, der Neugier-Weg 0.15 — asymmetrische Tore am gemeinsamen autonomen Pfad. *Nicht geändert.*
2. **F-2** Stille Ablehnungen des autonomen Pfades werden weiterhin nicht persistiert; die Wirkung der Erholung ist nur indirekt messbar. *Nicht geändert.*
3. **F-3** Die zulässige Erholungsrate ist an `PROACTIVE_MAX_IDLE_MS` (15 min) gekoppelt: Raten ≤ 0.01/min könnten im selben Leerlauffenster nie eine Frage erzeugen. Diese Kopplung ist im Code nicht dokumentiert. *Nicht geändert.*
4. **F-4** Der Gesprächsverbrauch (0.03–0.07 je Nachricht) leert den Cap 0.25 nach ca. 4–8 Nachrichten. *Nicht geändert.*
5. **F-5** Zwei bekannte Sicherheitswarnungen ausserhalb des ORB-Bereichs (`moderation_actions.internal_note`, `reports.review_note`) bestehen unverändert. *Nicht geändert.*
6. **F-6** `orb_state.energy DEFAULT 0.8` liegt über dem Cap; neue Nutzer starten daher oberhalb des Erholungsdeckels, der Wert wird durch die Erholung nicht gesenkt. *Nicht geändert.*

---

**Grenze eingehalten:** geändert wurden ausschliesslich Erholung (0.02/min) und Cap (0.25) sowie eine neue Testdatei. Keine weitere Autonomielogik, kein Schema, keine Daten, keine Schwelle.

---

## Unexpected Finding During Implementation

**Befund:** Initial-Scroll-Regression in `src/components/orb/OrbChat.tsx`. Beim Öffnen des Chats mit vorhandener Historie blieb der Verlauf oben stehen; die neueste Nachricht war nicht sichtbar.

**Ursache:** Der Auto-Scroll-Effekt ersetzte `endRef.current?.scrollIntoView({ block: "end" })` durch die bedingte Bereichs-Scrollung `distance = pane.scrollHeight - pane.scrollTop - pane.clientHeight; if (distance <= 80) pane.scrollTop = pane.scrollHeight`. Beim ersten Rendern ist `scrollTop = 0`, die Historie aus `snapshot.messages` aber bereits gerendert (fester Container `h-[20rem]`/`sm:h-[24rem]`, `overflow-y-auto`), also ist `distance` deutlich > 80 — die Bedingung ist falsch und kein anderer Codepfad scrollt initial ans Ende (der Mount-Effekt fokussiert nur die Textarea). Bestätigt: ausschließlich die neue Näheprüfung verursacht das Verhalten; kein weiterer Initial-Scroll-Pfad existiert.

**Minimaler Fix (eine Datei, eine Stelle):** Trennung von initialem und laufendem Scrollen über `initialScrollDone`-Ref im bestehenden Effekt:
- Beim ersten Befüllen des Verlaufs (`messages.length > 0`): einmalig `pane.scrollTop = pane.scrollHeight`, ohne 80px-Bedingung.
- Danach unverändert: nur nachführen, wenn `distance <= 80`.
- Leerer Verlauf: kein Scroll, kein Fehler, Flag bleibt offen bis erste Nachrichten gerendert sind.
- Die 80px-Schwelle wurde weder entfernt noch abgeschwächt; kein neuer Schwellenwert eingeführt.

**Validierung:** Typecheck grün; ESLint grün; `tests/orb-chat-scroll.test.ts` um CASE A (Initial-Mount scrollt ans Ende), CASE B/C (80px-Verhalten unverändert), CASE D (leerer Verlauf) erweitert — 7/7 grün; vollständige Suite 1089/1089 grün (70 Dateien); DB-/Sicherheitstests 77/77 grün (9 Dateien); Build OK (07:34:19 UTC).

**Einordnung:** A — Regression, eingeführt durch die jüngste OrbChat-Auto-Scroll-Änderung (Ersetzung von `scrollIntoView` durch die bedingte Pane-Scrollung). Kein Bezug zur Energy Recovery; OrbChat wurde von dieser nicht berührt.

**Git-Diff-Zusammenfassung:** 2 Dateien — `src/components/orb/OrbChat.tsx` (+Ref-Flag, initiale Scrollverzweigung), `tests/orb-chat-scroll.test.ts` (+3 Regressionstests, +23 Zeilen). Keine weiteren Dateien oder Verhaltensweisen geändert; Nachrichtenladung, `snapshot.messages`, `channels.orb.tsx`, Chat-State, Reihenfolge, Persistenz, Autonomie, Energy Recovery, Listening, Memory, Datenbank, APIs, Security/RLS, Layout und Textarea-Fokus unberührt.
