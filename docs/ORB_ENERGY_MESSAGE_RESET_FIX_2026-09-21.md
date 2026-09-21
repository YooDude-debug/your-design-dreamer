# ORB Core – Energy-Reset bei normaler Benutzer-Nachricht

Datum: 2026-09-21 · Umgebung: Production · Umfang: STRICT SCOPE (nur nachgewiesene Ursache)

## 1. Problem

Sobald der Benutzer ORB Core eine normale Nachricht schreibt, zeigt der Zustand
unmittelbar Energie 0 bzw. nahezu 0. Die Energy-Recovery (+0.02/min, Cap 0.25)
war implementiert und nachweislich zeitweise wirksam, wurde aber praktisch nie
sichtbar akkumuliert.

## 2. Forensische Analyse (Datenfluss)

| Frage | Befund |
| --- | --- |
| 1. Wo wird Energy gelesen? | `ensureState()` liest `orb_state.*` (engine.server.ts:272-282) |
| 2. Wo wird Energy berechnet? | `toState()` (engine.server.ts:258-268) ruft `recoverEnergy(row.energy, row.updated_at, now)` |
| 3. Wo wird Energy persistiert? | `processInput()` (engine.server.ts:1485-1499, `energy: updated.energy`), autonome Frage (engine.server.ts:2313-2320, `energy - 0.03`) |
| 4. Wo wird der Recovery-Timestamp persistiert? | Kein eigenes Feld: `orb_state.updated_at`, gesetzt durch DB-Trigger |
| 5. Funktion beim normalen Senden | `processInput()` → danach `getSnapshot()` für die Anzeige |
| 6. Wird `orb_state` geschrieben? | Ja, an drei Stellen: `processInput`, `getSnapshot` (Kennzahl `decay_computations`), `recordLearning` |
| 7. Wird ein Energy-Wert geschrieben? | Nur in `processInput` und im autonomen Pfad – NICHT in `getSnapshot`/`recordLearning` |
| 8. Wird ein Recovery-Timestamp geschrieben? | Implizit bei JEDEM Update durch den Trigger |
| 9. DB-Trigger? | Ja, bewiesen: `CREATE TRIGGER orb_state_updated_at BEFORE UPDATE ON public.orb_state FOR EACH ROW EXECUTE FUNCTION set_updated_at()` |
| 10. Löst das Lesen eines Snapshots indirekt einen Write aus? | Ja – `getSnapshot()` schrieb `decay_computations` bei jedem Aufruf (engine.server.ts:409-414) |
| 11. Wird der gespeicherte Energy-Wert auf 0 gesetzt? | Ja, faktisch: der gespeicherte Wert war 0, weil die Erholung nie gespeichert wurde und die Nachrichtenkosten auf einen nicht erholten Wert angewendet wurden |
| 12. Nur Berechnung/Anzeige? | Nein – beides: die berechnete Erholung verfiel und der gespeicherte Wert blieb bei 0 |

### STORED vs. CALCULATED vs. DISPLAYED

- STORED ENERGY: `orb_state.energy` – wurde durch Snapshot-Writes nicht mit dem
  erholten Wert aktualisiert.
- CALCULATED ENERGY: `recoverEnergy(stored, updated_at, now)` – hängt vollständig
  von `updated_at` ab.
- DISPLAYED ENERGY: identisch mit CALCULATED (UI rechnet nichts eigenes).

## 3. Reproduktion / Production-Evidenz (lesend)

```sql
select energy, updated_at, now() - updated_at as idle from orb_state
where user_id = '9ce1d1b0-…';
-- energy: 0 · updated_at: 2026-09-21 10:19:39Z · idle: 00:02:11
```

BEFORE MESSAGE
- STORED ENERGY: 0
- CALCULATED ENERGY: ~0 (Ruhezeit durch jeden Snapshot-Write zurückgesetzt)
- DISPLAYED ENERGY: 0 %
- RECOVERY TIMESTAMP: jeweils Zeitpunkt des letzten Snapshot-Aufrufs

AFTER MESSAGE
- STORED ENERGY: 0 (`clamp01(0 − 0.03 − 0.04·I)` = 0)
- CALCULATED ENERGY: 0
- DISPLAYED ENERGY: 0 %
- RECOVERY TIMESTAMP: Zeitpunkt der Nachricht, danach erneut jeder Snapshot

Nach Wartezeit blieb die Anzeige bei ~0, weil der nächste Snapshot-Write die
Ruhezeit-Uhr erneut zurücksetzte, ohne die Erholung zu sichern.

## 4. Root Cause

`orb_state` hat einen `BEFORE UPDATE`-Trigger, der `updated_at` neu setzt. Die
Energy-Recovery leitet die Ruhezeit ausschließlich aus `updated_at` ab. Zwei
Schreibvorgänge berühren die Zeile OHNE `energy` mitzuschreiben:

1. `getSnapshot()` – Kennzahl `decay_computations` (bei jedem Lesen/Polling)
2. `recordLearning()` – `cracks`, `fear`, `uncertainty`

Jeder dieser Writes setzte die Ruhezeit auf 0, während der gespeicherte
Energiewert unverändert niedrig blieb. Die bereits erholte Energie verfiel damit
sofort; die Nachrichtenkosten wurden anschließend auf einen nicht erholten Wert
angewendet, wodurch `clamp01()` exakt 0 ergab.

## 5. Fix (minimal)

Datei: `src/orb-core/engine.server.ts`
Funktionen: `getSnapshot()` (Kennzahl-Write) und `recordLearning()` (Zustands-Write)

Beide Updates schreiben jetzt zusätzlich `energy: toState(stateRow).energy`, also
genau den zum Lesezeitpunkt erholten Wert. Der neue Zeitstempel gehört damit zum
neuen Basiswert: die Erholung geht nicht mehr verloren und ist weiterhin
zeitbasiert, monoton und aufrufunabhängig.

Warum der Fix korrekt ist: `recoverEnergy` ist eine reine Funktion von
(gespeicherter Wert, verstrichene Zeit). Wird der Zeitstempel zurückgesetzt, ist
das Mitschreiben des erholten Werts die einzige verlustfreie Variante. Häufigere
Aufrufe erzeugen keinen zusätzlichen Gewinn, weil der Cap und die Rate unverändert
bleiben.

## 6. Unverändert

Recovery-Rate 0.02/min · Cap 0.25 · Nachrichtenkosten (`nextState`: −0.03 − 0.04·I)
· autonome Fragekosten −0.03 · `CURIOSITY_MIN_ENERGY` 0.15 · Schwelle 0.12
(WAIT/Stille) · `CURIOSITY_ASK_THRESHOLD` 0.2 · Curiosity, Impulse, Duplikatprüfung,
Cooldowns, Fragegenerierung, Memory, Graph, Messenger, Translation, E2EE, UI,
Timer, DB-Schema, RLS, APIs.

## 7. Regression Tests

Neu: `tests/orb-energy-message-reset.test.ts` (6 Tests)
- Vertrag: jeder `orb_state`-Update im Kern schreibt `energy` mit
- A) Energie > 0 bleibt nach einer Nachricht erhalten (nur Kosten)
- B) mehrere Nachrichten senken nur um bestehende Kosten (0.25 → 0.16)
- C) niedrige Energie wird nicht künstlich genullt
- D) Erholung übersteht einen zwischenzeitlichen Write (0.12 → 0.18)
- E) Cap bleibt 0.25

Bestehend geprüft: `orb-energy-recovery` (13), `orb-presence` (20),
`orb-curiosity` (28) – WAIT-Gates und autonome Fragen unverändert.

## 8. Risikoanalyse

- Niedrig: der Write, der bereits stattfand, transportiert nun ein zusätzliches,
  bereits berechnetes Feld. Keine neue Abfrage, kein neuer Timer, kein Job.
- Kein Risiko der Energie-Inflation: der Cap 0.25 und die Rate bleiben gleich;
  `recoverEnergy` senkt Werte oberhalb des Caps nicht und erhöht nie über den Cap.
- Kein Einfluss auf Autonomie-Entscheidungen außer über den korrekt erholten Wert,
  der genau die beabsichtigte Wirkung der bereits freigegebenen Recovery ist.
- Restbeobachtung (OFFEN): der gespeicherte Wert steht aktuell bei 0; der Anstieg
  muss im Live-Betrieb noch beobachtet werden.

---

Files changed: 2 (`src/orb-core/engine.server.ts`, `tests/orb-energy-message-reset.test.ts`)
Database changes: 0
Migrations: 0
Deployments: 0
Tests: 1095 Logik-Tests bestanden · 77 DB/Security-Tests bestanden
Typecheck: bestanden
Lint: geänderte Dateien ohne Befund
Build: build OK
