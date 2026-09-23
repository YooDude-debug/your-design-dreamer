# ORB Core – P9 Diagnose-Count Optimierung (2026-09-23)

Status: abgeschlossen. Geänderte Datei: ausschliesslich `src/orb-core/engine.server.ts`
(Abfrage 2 der Momentaufnahme). Referenz: `docs/ORB_P8_PROPOSAL_DIAGNOSTIC_FORENSIC_RESULT_2026-09-23.md`

Befunde sind als **BEWIESEN**, **WAHRSCHEINLICH** oder **UNBEKANNT** gekennzeichnet.

---

## 1. P8-Ausgangslage

P8 klassifizierte Abfrage 1 (Vorschlagsliste, limit 20) als **A) NOTWENDIG** und
Abfrage 2 (Statuszählung, limit 500) als **C) NUR DIAGNOSE**. Abfrage 1 wurde in
P9 nicht berührt.

## 2. Bestehende Abfrage 2 (vorher)

```ts
db.from("orb_suggestions")
  .select("status")
  .eq("user_id", userId)
  .in("status", ["accepted", "rejected"])
  .limit(500)
```

- geladene Zeilen: alle entschiedenen Vorschläge des Benutzers, höchstens 500
- geladene Felder: nur `status`
- Filter: `user_id = <Benutzer>` und `status in (accepted, rejected)`
- Reihenfolge: **keine** `order`-Klausel → Reihenfolge nicht definiert

## 3. Bestehende Count-Logik (vorher)

```ts
suggestionsAccepted: countRes.data.filter((s) => s.status === "accepted").length,
suggestionsRejected: countRes.data.filter((s) => s.status === "rejected").length,
```

Beide Zahlen entstehen also in JavaScript aus derselben geladenen Zeilenmenge.
Verhalten (gemessen, Attrappe, vorher):

| Fall | DB-Ops Momentaufnahme | gelesene Zeilen (Vorschläge) | angezeigt accepted / rejected |
| --- | --- | --- | --- |
| 0 Entscheidungen | 9 | 3 (nur Abfrage 1) | 0 / 0 |
| 1 accepted | 9 | 4 | 1 / 0 |
| 1 rejected | 9 | 4 | 0 / 1 |
| 5 accepted / 7 rejected | 9 | 15 | 5 / 7 |
| genau 500 (250/250) | 9 | 503 | 250 / 250 |
| 2000 (1000/1000) | 9 | 503 | **500 / 0** (falsch) |

## 4. Analyse der 500er-Grenze

**BEWIESEN** – die Grenze ist ein technisches Ladelimit, nicht Fachlogik:

1. Kein Kommentar, keine Konstante, keine Dokumentation und kein Test beschreibt
   eine fachliche „letzte 500"-Regel (Suche in `src/` und `tests/`: keine Treffer).
2. Die Abfrage hat **keine** Sortierung. Welche 500 Zeilen ankommen, ist damit
   nicht definiert – eine fachliche Semantik („die letzten 500") ist so nicht
   ausdrückbar.
3. Die Anzeige ist mit „Vorschläge angenommen / abgelehnt" beschriftet, also als
   Gesamtzahl, nicht als Stichprobe.
4. Der gemessene Fall 2000 Entscheidungen liefert 500 / 0 – abhängig von der
   Lieferreihenfolge, also ein sichtbarer Defekt, keine gewollte Begrenzung.

→ Der Ersatz durch echte Counts ist zulässig. **Ausdrücklich dokumentierte
Verhaltensänderung:** oberhalb von 500 entschiedenen Vorschlägen zeigt die
Diagnosekachel nun die tatsächlichen Gesamtzahlen statt abgeschnittener Werte.
Bis 500 Entscheidungen sind alte und neue Werte identisch.

## 5. Beweis der Count-Äquivalenz

| Merkmal | vorher | nachher |
| --- | --- | --- |
| Datenquelle | `public.orb_suggestions` | identisch |
| Filter Benutzer | `eq user_id` | identisch |
| Bedingung accepted | Zeile geladen mit `status in (accepted,rejected)`, dann `status === "accepted"` | `eq status 'accepted'` |
| Bedingung rejected | dito mit `"rejected"` | `eq status 'rejected'` |
| Statuswerte | Enum `orb_suggestion_status` | identisch |
| NULL-Fälle | keine möglich | keine möglich |
| fehlender Status | keine möglich | keine möglich |
| Zählweise | `Array.filter().length` | `count: "exact"` der Datenbank |
| Begrenzung | 500 (technisch) | keine |

**BEWIESEN** – `orb_suggestions.status` ist `NOT NULL` mit Default `'pending'`
(Schemaprüfung der Datenbank). NULL- oder fehlende Werte können nicht auftreten,
daher entfällt jede NULL-Sonderbehandlung. Die Mengenbedingung
`status in (accepted,rejected)` + JS-Filter `=== 'accepted'` ist mengengleich mit
`status = 'accepted'`. Damit sind beide Zahlen bis zur 500er-Grenze exakt
identisch definiert.

Entscheidungsregel aus der Freigabe: A) erfüllt, B) erfüllt, C) erfüllt,
D) erfüllt (Abschnitt 4), E) erfüllt (Anzeige bleibt „angenommen/abgelehnt",
nun korrekt), F) erfüllt (P8: keine ORB-Entscheidung nutzt die Werte).

## 6. Durchgeführter Patch

Eine Stelle in `src/orb-core/engine.server.ts` (innerhalb `getSnapshot`):

- Die eine Ladeabfrage (`select("status") … in(...) … limit(500)`) wurde durch
  zwei reine Zählabfragen ersetzt:
  `select("id", { count: "exact", head: true }).eq("user_id", …).eq("status", "accepted")`
  und dieselbe Abfrage für `"rejected"`.
- `metrics.suggestionsAccepted/Rejected` lesen nun `count ?? 0`.
- Fehlerprüfung entsprechend auf die zwei neuen Ergebnisse umgestellt.
- Beide Abfragen laufen im bestehenden `Promise.all`, also parallel wie vorher.

Kein Cache, keine Schemaänderung, kein Index, keine neue RPC, keine neue
Architektur. `head: true` bedeutet: die Datenbank liefert nur die Anzahl,
keine Zeilen.

## 7. Vorher-/Nachher-Messungen (Attrappe, 0 Modellaufrufe)

| Fall | DB-Ops vorher | DB-Ops nachher | Zeilen vorher | Zeilen nachher | accepted/rejected vorher | accepted/rejected nachher |
| --- | --- | --- | --- | --- | --- | --- |
| 0 Entscheidungen | 9 | 10 | 3 | 3 | 0 / 0 | 0 / 0 |
| 1 accepted | 9 | 10 | 4 | 3 | 1 / 0 | 1 / 0 |
| 1 rejected | 9 | 10 | 4 | 3 | 0 / 1 | 0 / 1 |
| 5 / 7 | 9 | 10 | 15 | 3 | 5 / 7 | 5 / 7 |
| 500 (250/250) | 9 | 10 | 503 | 3 | 250 / 250 | 250 / 250 |
| 2000 (1000/1000) | 9 | 10 | 503 | 3 | 500 / 0 | 1000 / 1000 |

Messdauer der Momentaufnahme in der Attrappe: vorher bis 1,6 ms bei 500 Zeilen,
nachher konstant ~0,1–0,2 ms. Diese Zeiten enthalten keine Netz-/DB-Latenz
(**UNBEKANNT** für die Produktion).

## 8. DB-Operationsersparnis

**BEWIESEN** – die Zahl der Operationen steigt um **+1** (eine Ladeabfrage → zwei
Zählabfragen); die Momentaufnahme liegt damit bei 10 statt 9 Operationen
(zusätzlich der bedingte `orb_state`-Write). Eingespart wird nicht eine
Operation, sondern die übertragene Datenmenge. Beide Zählabfragen laufen
parallel im bestehenden `Promise.all`, es entsteht keine zusätzliche Rundreise
in Serie.

Eine Variante mit nur einer Operation wäre nur über eine gruppierende RPC oder
eine Datenbank-Sicht möglich – beides war in P9 ausdrücklich nicht freigegeben.

## 9. Gelesene Zeilen vorher/nachher

- vorher: 0–500 Zeilen je Vorgang für zwei Zahlen.
- nachher: **0 Zeilen** je Vorgang (nur zwei Zählwerte).
- Produktionsstand heute: 1 Vorschlag, 0 entschieden → praktische Einsparung
  aktuell ~0 Zeilen; die Einsparung wirkt erst mit wachsender Nutzung
  (**BEWIESEN** für den heutigen Datenstand).

## 10. Ergebnisvergleich

Identische Werte in allen Fällen bis 500 Entscheidungen. Abweichung nur oberhalb
von 500: dort liefert der neue Stand die tatsächlichen Gesamtzahlen, der alte
Stand abgeschnittene und von der Lieferreihenfolge abhängige Werte.

## 11. Edge Cases

| Fall | vorher | nachher | Bewertung |
| --- | --- | --- | --- |
| 0 / 0 | 0 / 0 | 0 / 0 | gleich |
| 1 / 0 | 1 / 0 | 1 / 0 | gleich |
| 0 / 1 | 0 / 1 | 0 / 1 | gleich |
| mehrere accepted | korrekt | korrekt | gleich |
| mehrere rejected | korrekt | korrekt | gleich |
| gemischt (5/7) | 5 / 7 | 5 / 7 | gleich |
| NULL-Status | nicht möglich (NOT NULL) | nicht möglich | kein Fall |
| fehlender Status | nicht möglich (Default `pending`) | nicht möglich | kein Fall |
| genau 500 | 250 / 250 | 250 / 250 | gleich |
| 2000 | 500 / 0 (abgeschnitten) | 1000 / 1000 | korrigiert, dokumentiert |
| `count` fehlt/null | – | `?? 0` → 0 / 0 | defensiv |

## 12. Regressionstests

- Logiktests: 1371/1371 grün
- DB-/Sicherheitstests: 102/102 grün
- Typprüfung (`tsgo --noEmit`): fehlerfrei
- Lint der geänderten Datei: fehlerfrei (Datei mit Prettier formatiert)
- Build: OK
- Gezielt geprüft (Attrappe): normale Nachricht unverändert (Momentaufnahme
  liefert dieselben Werte), Vorschlagsanzeige unverändert (Abfrage 1 liefert
  weiterhin bis 20 Einträge, gemessen 3 sichtbare), Diagnoseanzeige mit 0 / nur
  accepted / nur rejected / gemischt / >500 Entscheidungen korrekt.

## 13. Unveränderte Bereiche

Abfrage 1 (Vorschlagsliste inkl. `posts(title)`), alle übrigen Abfragen der
Momentaufnahme, der `orb_state`-Write, Memory, Graph, Connections, Thought
Threads, Curiosity, Energy, autonome Fragen, Silent-Logik, Modellaufrufe,
Prompts, Modellauswahl, Korrekturpfad (P6), ChatBridge (nicht vorhanden),
Datenbankschema, Indizes, RLS.

## 14. Offene Punkte (jeweils eigene Freigabe nötig)

- Die Diagnosezahlen werden weiterhin bei **jedem** Vorgang erhoben, obwohl sie
  nur im eingeklappten Testbereich sichtbar sind. Eine Bedarfsabfrage beim
  Öffnen würde 2 Operationen je Vorgang sparen (**nicht** freigegeben, nicht
  umgesetzt).
- `db_queries` erfasst die Momentaufnahme weiterhin nicht (P7, konstant 10–11
  Operationen Untererfassung).
- Umfang der Momentaufnahme (`style`, übrige `metrics`) unverändert offen.
- Produktionsfälle mit 40/43 Abfragen weiterhin **nicht eindeutig zuordenbar**.
- 134 historische Modellaufrufe (P2) weiterhin ungeklärt.
- Ausführungszeit der neuen Zählabfragen in der Produktion **UNBEKANNT** (nur
  Attrappe gemessen).

## Kosten der Messung

Temporäres Skript ausserhalb des Projekts (`/tmp/p9measure.ts`, nach der Messung
entfernt), Test-Attrappe statt Datenbank. **0 Modellaufrufe.** Produktive
DB-Last: eine lesende Schemaabfrage. Kein Deployment, keine Migration.

---

**STOPP** – keine weitere DB-Optimierung, keine Migration, kein Deployment,
keine Änderung an Abfrage 1, keine Arbeit an den 40/43-Fällen.
