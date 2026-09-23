# ORB CORE – P6 GEZIELTE DB-OPTIMIERUNG (Korrekturpfad)

**Datum:** 2026-09-23
**Umfang:** ausschliesslich die nachweislich verworfene Momentaufnahme im
Korrekturpfad. Keine allgemeine DB-Optimierung, keine Migration, kein
Deployment, keine ChatBridge, kein neues Feature.
**Referenz:** `docs/ORB_P5_DB_FORENSIC_RESULT_2026-09-23.md`

## 1. P5-Befund

Im Korrekturpfad („… war ein Tippfehler") ruft `processInput` für jede
betroffene abgerufene Erinnerung `recordFeedback` auf. `recordFeedback` endet
mit einer vollständigen Momentaufnahme (9 Reads + bis zu 1 Write), deren
Rückgabewert an dieser Stelle verworfen wird. Gemessener Einzelfall: 193
Datenbankoperationen bei 32 gezählten.

## 2. Genauer betroffener Codepfad

- `src/orb-core/engine.server.ts`, Abschnitt „1b. Ausdrückliche Korrektur"
  in `processInput` (Schleife über `recalled`).
- `src/orb-core/engine.server.ts`, `recordFeedback` → Schlusszeile
  `return getSnapshot(db, userId)`.
- Öffentlicher Aufrufer der Rückmeldung: `sendOrbFeedback`
  (`src/integrations/y-dude-orb/orb.functions.ts`) über
  `src/orb-sdk/orb-core.server.ts` → `core.recordFeedback`.

## 3. Beweis der Redundanz

| Kriterium | Nachweis |
| --- | --- |
| A) Momentaufnahme wird geladen | `recordFeedback` endet mit `getSnapshot`; in der Messung 1 Momentaufnahme je betroffener Erinnerung (bis zu 4 zusätzliche gemessen) |
| B) Ergebnis wird nicht verwendet | Aufrufstelle lautete `await recordFeedback(...)` ohne Zuweisung; der Rückgabewert wurde nicht gelesen |
| C) Kein versteckter Seiteneffekt | Die 9 Abfragen der Momentaufnahme sind SELECTs; der einzige Write ist `orb_state.decay_computations`/`energy` – ein reiner Zählerfortschritt, der keinen Gedächtnis-, Graph-, Faden-, Neugier- oder Energiewert gegenüber dem Zug verändert (der Zug schreibt Energie und Zustand am Ende selbst) |
| D) Kein intervenierender Write erfordert sie | Der Zug liest am Ende (`processInput`, Zeile ~1690) ohnehin eine eigene, spätere Momentaufnahme; die frühere konnte nur veraltete Werte liefern |
| E) Keine Abhängigkeit der Kernlogik | Die Wirkung der Rückmeldung (Kantengewichte, Interessen, Knotenzustand) steht vollständig vor dem `getSnapshot`-Aufruf und ist unverändert |
| F) Korrektur selbst unverändert | Erkennung (`correctedTerm`), Auswahl der betroffenen Erinnerungen und negative Rückmeldung sind unangetastet |

## 4. Vorher-Messung (Attrappe, kein echter Modellaufruf)

| Fall | betroffene Erinnerungen | DB-Operationen | Reads | Writes | Momentaufnahmen | gezählt (`db_queries`) | Entscheidung |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Korrektur | 1 | **58** | 34 | 24 | 2 | 22 | answer |
| Korrektur | 2 | **85** | 46 | 39 | 3 | 24 | remind |
| Korrektur | 6 angeboten (4 abgerufen betroffen) | **139** | 70 | 69 | 5 | 28 | remind |
| Korrektur ohne Treffer | 0 | 31 | 22 | 9 | 1 | 20 | answer |
| normale Nachricht (Gegenprobe) | – | 27 | 21 | 6 | 1 | 16 | answer |

Nutzung der Snapshot-Ergebnisse im Korrekturpfad: **keine** (Rückgabewert
verworfen). Die mengenabhängige Wirkung ist damit belegt: je betroffener
Erinnerung +10 Operationen (9 Reads + 1 Write).

## 5. Durchgeführte minimale Änderung

Eine Datei, `src/orb-core/engine.server.ts`:

1. Die bestehende Rückmeldelogik wurde in `applyFeedback` umbenannt – gleicher
   Code, gleiche Reihenfolge, gleiche Abfragen, **ohne** Schluss-Momentaufnahme.
2. `recordFeedback` bleibt öffentlich und unverändert im Verhalten:
   `applyFeedback` + `getSnapshot` (die Oberfläche zeigt sie an).
3. Der Korrekturpfad in `processInput` ruft nun `applyFeedback` statt
   `recordFeedback` auf.

Kein Cache, keine globale Variable, keine neue RPC, keine neue Abfrage, keine
Schemaänderung, keine geänderte Zählung.

## 6. Nachher-Messung (identische Fälle)

| Fall | DB-Operationen | Reads | Writes | Momentaufnahmen | `db_queries` | Entscheidung | Antwort |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Korrektur, 1 | **48** (vorher 58) | 25 | 23 | **1** (vorher 2) | 22 (unverändert) | answer | unverändert |
| Korrektur, 2 | **65** (vorher 85) | 28 | 37 | **1** (vorher 3) | 24 (unverändert) | remind | unverändert |
| Korrektur, 6/4 | **99** (vorher 139) | 34 | 65 | **1** (vorher 5) | 28 (unverändert) | remind | unverändert |
| Korrektur ohne Treffer | 31 (unverändert) | 22 | 9 | 1 | 20 | answer | unverändert |
| normale Nachricht | 27 (unverändert) | 21 | 6 | 1 | 16 | answer | unverändert |

Die Zahl der Knoten-Updates (Reaktivierung + Rückmeldung) ist in allen Fällen
identisch geblieben (2 / 4 / 8 / 0 / 0) – die Korrektur wirkt unverändert.
Keine Fehler, keine geänderte Entscheidung, kein geänderter Antworttext.

## 7. Tatsächliche Einsparung (gemessen)

| Fall | Einsparung |
| --- | --- |
| 1 betroffene Erinnerung | **−10** DB-Operationen (−17 %), −1 Momentaufnahme |
| 2 betroffene Erinnerungen | **−20** DB-Operationen (−24 %), −2 Momentaufnahmen |
| 4 betroffene Erinnerungen (Fall „6") | **−40** DB-Operationen (−29 %), −4 Momentaufnahmen |
| ohne Treffer / normale Nachricht | 0 (unverändert, wie beabsichtigt) |

Rechnerisch auf den in P5 gemessenen 193-Operationen-Fall (6 Rückmeldungen)
übertragen: −60 Operationen, also 133 statt 193 – gemessen wurde in P6 der
Fall mit 4 Rückmeldungen (139 → 99).

## 8. Regressionstests

| Prüfung | Ergebnis |
| --- | --- |
| Logiktests (`bunx vitest run`) | 1371 / 1371 grün |
| Datenbank-/Sicherheitstests (`bun run test:db`) | 102 / 102 grün |
| Typprüfung (`tsgo --noEmit`) | fehlerfrei |
| Lint | berührte Datei sauber (nur die bekannten Altlasten in `backups/`, `release/`, `remotion/` u. a.) |
| Build | erfolgreich |

Gezielt geprüft (Messung + bestehende Suiten): normale Nachricht, Korrektur mit
einer, zwei und mehreren Erinnerungen, Korrektur ohne betroffene Erinnerung,
Korrektur ohne gültige Referenz (kein Treffer), Gedächtnis-, Graph- und
Fadenverhalten (Knoten-Updates, Kantengewichte, Fadenzuordnung unverändert).

## 9. Unveränderte Bereiche

Normale Nachrichten, autonome Fragen, Hintergrundanalyse, Reaktivierungen,
Verbindungen, Gedankenfäden und deren Pausieren, Gedächtnis, Graph, Neugier,
Energie, stille Züge, Modellaufrufe, Prompts, Modellauswahl, öffentliche
Rückmeldung (`sendOrbFeedback` liefert weiterhin die Momentaufnahme),
`db_queries`-Zählung, Datenbankschema, Indizes, RLS. Die 40/43-Ausreisser
wurden **nicht** angefasst.

## 10. Offene Punkte (für eine spätere, eigene Freigabe)

- Die `db_queries`-Zählung erfasst weiterhin nicht die Momentaufnahme am
  Zugende; Vorher-/Nachher-Werte in der Produktion bleiben dadurch zu niedrig.
- Die zwei `orb_suggestions`-Reads der Momentaufnahme (P5, POTENZIELL).
- Umfang der Momentaufnahme nach jedem Zug (P5, Oberflächenbedarf unbewiesen).
- Produktionsfälle mit 40/43 Abfragen bleiben nicht eindeutig zuordenbar.
- Häufigkeit des Korrekturpfads in der Produktion ist nicht messbar.
- Die 134 historischen Modellaufrufe bleiben unverändert ungeklärt.

**STOPP.** Keine weitere Optimierung, keine Migration, kein Deployment.
