# ORB CORE – MEMORY & THREAD GROWTH FORENSIC AUDIT

**Datum:** 2026-09-22
**Modus:** READ-ONLY · 0 Codeänderungen · 0 Migrationen · 0 DB-Änderungen · 0 Deployment
**Primärquellen:** aktueller Quellcode, aktuelles DB-Schema (Indizes/Trigger), READ-ONLY
Produktionsabfragen, vorhandene Tests. Frühere Reports wurden nicht als Beweis verwendet.

---

## 0. Kernergebnis in einem Satz

Weder Memory noch Threads hören auf zu wachsen. Gespeichert sind **72 Erinnerungen** und
**77 Gedankenfäden** (Hauptnutzer). Sichtbar sind 40 bzw. 12, weil `getSnapshot()` genau diese
beiden Abfragelimits setzt: `GRAPH_LIMIT = 40` für `orb_nodes` und `.limit(12)` für `orb_threads`.

---

## 1. Datenbank-Realität (READ-ONLY, Produktionsstand)

Relevante Tabellen: `orb_nodes` (Erinnerungen/Graphknoten), `orb_connections`, `orb_threads`
(Gedankenfäden), `orb_node_history`, `orb_interests`.

```
orb_nodes   gesamt 76  |  Nutzer 9ce1d1b0…: 72   | Nutzer 221a1111…: 4
orb_threads gesamt 81  |  Nutzer 9ce1d1b0…: 77   | Nutzer 221a1111…: 4
orb_nodes lifecycle:  active 76  (kein forgotten/archived)
orb_nodes Nutzer 9ce1d1b0…: 72 Zeilen, 72 verschiedene norm_key, 54 verschiedene Topics,
                            0 Zeilen mit norm_key IS NULL, 70 von 72 mit importance >= 0.35
Zeitraum: 2026-09-19 bis 2026-09-22 (beide Tabellen, laufend neue Zeilen)
```

**Schema (`orb_nodes`)**
- PK `id`; FK `user_id`
- UNIQUE partiell: `orb_nodes_user_norm_key_uidx (user_id, norm_key) WHERE norm_key IS NOT NULL`
- Indizes auf `(user_id, importance DESC, last_accessed_at DESC)`, `(user_id, last_accessed_at DESC)`,
  `(user_id, lifecycle)`, `(user_id, topic)`, `(user_id, type)`
- Trigger: nur `orb_nodes_updated_at` (BEFORE UPDATE → `set_updated_at()`)

**Schema (`orb_threads`)**
- PK `id`; UNIQUE `orb_threads_user_title_idx (user_id, lower(title))`
- Indizes `(user_id, last_activation_at DESC)`, `(user_id, status)`
- Trigger: nur `orb_threads_set_updated_at`

**Keine** DELETE-Trigger, **keine** ON DELETE-Kaskade auf Memory-Inhalte, **keine** Views mit
Limit, **keine** Retention-Funktion. `cron`-Schema ist für die Leserolle gesperrt; im Code
existiert kein Aufruf eines Aufräumjobs für `orb_nodes`/`orb_threads` (keine Edge Function,
keine geplante Aufgabe im Repo). **Gelöschte Datensätze sind nicht nachweisbar**, weil es im
gesamten ORB-Code exakt **einen** `.delete()`-Aufruf gibt – und der betrifft `orb_questions`
(Kompensation aus der Stabilisierung vom 2026-09-22), nicht Memory oder Threads.
Belege: `rg "\.delete\(" src/orb-core …` → nur `engine.server.ts:2365`.

---

## 2. Memory-Lifecycle mit Codebelegen

| Stufe | Datei / Funktion | Mechanismus |
|-------|------------------|-------------|
| Eingabe | `engine.server.ts:849` | Text auf `MAX_INPUT_CHARS = 1000` gekürzt |
| Kandidaten | `engine.server.ts:631–691` | `contentTokens(text).slice(0,3)`, `norm_key`-Exaktsuche, `CANDIDATE_LIMIT = 20` |
| Recall | `engine.server.ts:871, 916` | Kandidaten `LIMIT 60`, dann `selectByLevel(scored, RECALL_LIMIT = 6)` |
| Reaktivierung | `engine.server.ts:1268–1283` | UPDATE `activation_count+1`, `last_accessed_at`, `importance` – **kein Löschen** |
| Speicherschwelle | `engine.server.ts:1325–1331` | `isStorableStatement()` UND (`shouldPersist(importance)` (0.35) ODER Antwort auf eigene Frage ODER aufgelöste Kontext-Tatsache) |
| Dedup/Exakt | `engine.server.ts:1303–1318` | bei `exact` (gleicher `norm_key`) → **UPDATE statt INSERT** |
| INSERT | `engine.server.ts:1348–1362` | neuer Knoten mit `norm_key`, `topic` |
| Schlüsselkonflikt | `engine.server.ts:1351–1359` | Fehler `23505` → erneuter INSERT mit `norm_key = null`, d. h. **Konflikt erzeugt trotzdem eine neue Zeile**, nie eine Verschmelzung |
| Decay | `core.ts recoverEnergy/decay`, `engine.server.ts:408–411` | wird je Snapshot **nur berechnet und gezählt**, entfernt nichts |
| Lifecycle | `analysis/apply.server.ts:271–279, 332–336, 360–451` | Werte `active`/`forgotten` usw. per UPDATE; produktiv sind **alle 76 Zeilen `active`** |
| Retrieval | `engine.server.ts:350–356` | `ORDER BY importance DESC, last_accessed_at DESC LIMIT GRAPH_LIMIT (=40)` |
| UI | `routes/_authenticated/channels.orb.tsx:304, 311` | Anzeige `${snapshot.nodes.length} Erinnerungen`, Liste `slice(0, 6)` |

### Deterministische Entscheidungskette (INSERT / UPDATE / REJECT / DELETE)

```text
Eingabe
 -> norm_key(memoryText)
 -> existiert Knoten mit (user_id, norm_key)?   JA -> UPDATE (Verstärkung), kein neuer Knoten
                                                NEIN
 -> isStorableStatement(memoryText)?            NEIN -> REJECT (nichts gespeichert)
 -> importance >= 0.35  ODER  memoryImportance >= 0.35
    ODER Antwort auf offene ORB-Frage  ODER aufgelöste Kontext-Tatsache?
                                                NEIN -> REJECT
                                                JA   -> INSERT
 -> INSERT verletzt UNIQUE (23505)?             JA   -> INSERT mit norm_key = NULL (neue Zeile)
 DELETE: existiert für Memory nirgends im Code.
```

---

## 3. Memory ~40 – Ursache

**Ergebnis: B) bestätigtes Query-Limit, das gleichzeitig als C) UI-Limit wirkt.**

- `src/orb-core/engine.server.ts:133` → `const GRAPH_LIMIT = 40;`
- `src/orb-core/engine.server.ts:350–356` → `orb_nodes … .limit(GRAPH_LIMIT)`
- `src/routes/_authenticated/channels.orb.tsx:304` → die angezeigte Zahl ist
  `snapshot.nodes.length`, also die Länge genau dieser begrenzten Liste.
- Gegenbeweis zum Speicherlimit: 72 gespeicherte Zeilen bei diesem Nutzer.

Damit ist bewiesen: **Fall 2 und 3** aus der Fragestellung (mehr als 40 gespeichert, Retrieval und
damit Anzeige liefern 40). Kein Hard Cap, kein Pruning, kein Löschen.

Zusatzeffekt (bestätigt, aber nicht die Ursache der Zahl 40): Sortierung nach
`importance DESC, last_accessed_at DESC` bedeutet, dass neue Erinnerungen mit niedriger
Wichtigkeit **niemals** in die sichtbaren 40 gelangen, selbst wenn sie gerade entstanden sind.
Genau deshalb wirkt es wie Stillstand: die Liste bleibt bei 40 und der Inhalt wechselt kaum.

Ebenfalls geprüft und **nicht** ursächlich: `orb_connections` LIMIT 40, `orb_messages` LIMIT 40,
`orb_interests` LIMIT 20, `orb_suggestions` LIMIT 20/500, `RECALL_LIMIT = 6`,
`CANDIDATE_LIMIT = 20`, `OBSERVE_LIMIT = 30` (`feed.server.ts:27`) – alles Leselimits ohne
Einfluss auf die Speicherung.

---

## 4. Threads ~12 – Ursache

**Ergebnis: B) bestätigtes Query-Limit (doppelt vorhanden), das als UI-Limit sichtbar wird.**

- `src/orb-core/engine.server.ts:389–394` → `orb_threads … ORDER BY last_activation_at DESC LIMIT 12`
- `src/orb-core/continuity-store.server.ts:40` → `export const THREAD_LOAD_LIMIT = 12;`
  (Standardwert von `loadThreads()`, Zeilen 74–93)
- `src/routes/_authenticated/channels.orb.tsx:375` → Anzeige `${snapshot.threads?.length ?? 0} Gedankenfäden`
- Gegenbeweis: 77 gespeicherte Fäden bei diesem Nutzer.

Die 12 aktuell sichtbaren Fäden (Auszug, READ-ONLY):

| Titel (gekürzt) | Topic | Status | created_at | last_activation_at | node_ids |
|---|---|---|---|---|---|
| langfristige kettenreaktio m | welche | REACTIVATED | 2026-09-21 | 2026-09-22 04:30:46 | 0 |
| erinnerung automatisch nachf | auto | OPEN | 2026-09-22 | 2026-09-22 04:13:41 | 1 |
| unlogische entscheidung getr | warum | PAUSED | 2026-09-21 | 2026-09-22 04:12:47 | 0 |
| stellst analysier korrigier | wie | PAUSED | 2026-09-21 | 2026-09-21 18:51:09 | 0 |
| kausalitätsnachwei schreibvo | programmierung | PAUSED | 2026-09-21 | 2026-09-21 18:50:27 | 3 |
| jahre alt beruf | jahre | PAUSED | 2026-09-21 | 2026-09-21 18:25:37 | 1 |
| gericht allerbest tagesform | welch | PAUSED | 2026-09-21 | 2026-09-21 18:11:09 | 0 |
| eigentlich fullstack gelegen | gaming | PAUSED | 2026-09-21 | 2026-09-21 17:26:40 | 2 |
| gespannt schätz entwickel | reisen | PAUSED | 2026-09-21 | 2026-09-21 17:04:28 | 0 |
| beantwort überprüfbar analys | ehrlich | PAUSED | 2026-09-21 | 2026-09-21 15:32:25 | 1 |
| weltherrschaftspläne statist | saub | PAUSED | 2026-09-21 | 2026-09-21 15:28:49 | 1 |
| vielleicht psychologis welth | vielleicht | PAUSED | 2026-09-21 | 2026-09-21 15:27:05 | 0 |

Auffällig und bestätigt: viele Titel und Topics sind Füllwörter (`welche`, `warum`, `wie`, `hast`,
`vielleicht`, `könn`, `saub`) und mehrere Fäden haben `node_ids = 0`, also **keine** verknüpfte
Erinnerung.

---

## 5. Thread Creation Gate (Codepfad `continuity-store.server.ts:140–240`)

```text
syncThreads(input)
 1. Nur die geladenen Fäden prüfen  <-- input.loaded = max. 12 (THREAD_LOAD_LIMIT)
      status === RESOLVED           -> überspringen
      thread.topic != input.topic (beide gesetzt) -> überspringen  (Zeile 172-174)
      matches = (gleiches Topic && relevance >= 0.30) || similarity(text, known) >= 0.50
      kein Treffer -> weiter
 2. importance < 0.35               -> KEIN neuer Faden (Zeile 195)
 3. threadDraftFrom() liefert null  -> KEIN neuer Faden (Zeile 201)
 4. INSERT orb_threads
      UNIQUE-Konflikt lower(title)  -> bestehenden Faden reaktivieren statt anlegen (218-235)
 Kein Maximum, kein Cooldown, kein DELETE.
```

**Bestätigte Nebenwirkung des Limits:** Der Abgleich sieht nur die 12 jüngsten Fäden. Ein
passender älterer Faden kann deshalb nicht gefunden werden – es entsteht ein **neuer** Faden.
Das Limit bremst das Wachstum also nicht, es **beschleunigt** es (77 Fäden in drei Tagen).

**Zum Topic-Matching:** Die reparierte Präfixlogik (`memory.ts`, `TOPIC_MIN_PREFIX = 4`,
`TOPIC_MAX_SUFFIX = 2`) verhindert falsche Treffer. Für Threads wirkt das in Zeile 172–174 so:
liefert `topicOf()` neutral/`null` für eine Eingabe, greift die Topic-Ausschlussregel nicht und
der Textvergleich (Schwelle 0.50) entscheidet. Ein falsches Topic könnte einen Faden in einen
fremden Strang ziehen; ein fehlendes Topic verhindert keine Neuanlage. **Nicht bestätigt:** dass
Topic-Matching die Zahl 12 verursacht – die Zahl stammt allein aus dem Limit.
**Belegt, aber eigenständiges Problem:** Fallback-Titel/Topics aus Füllwörtern
(`continuity.ts:86–88`: Titel = längste drei Tokens bzw. `content.slice(0,40)`).

---

## 6. Memory ↔ Thread Zusammenhang

Struktur: **Memory → Topic → Thread**, Verknüpfung über `orb_threads.node_ids` (Array) →
Beziehung **1:N** (ein Faden verweist auf mehrere Knoten), `engine.server.ts:1410` übergibt
`focusNodeId` an `syncThreads`.

- Neues Memory ohne neuen Thread? **JA** – wenn ein Faden passt (Reaktivierung) oder
  `importance < 0.35` ist.
- Neuer Thread ohne neues Memory? **JA** – bewiesen: mehrere Fäden mit `node_ids = 0`
  (`focusNodeId` war `null`, weil kein Knoten gespeichert wurde).
- Kann ein Faden unbegrenzt Memories aufnehmen? **JA** – `node_ids` wird nur angehängt
  (Zeilen 184–188), keine Obergrenze, kein Beschneiden.

---

## 7. Storage vs. Retrieval – vollständige Leselimits

| Ort | Limit | Wirkung |
|-----|-------|---------|
| `engine.server.ts:356` | `orb_nodes LIMIT 40` (`GRAPH_LIMIT`) | **Ursache „~40 Memories"** |
| `engine.server.ts:394` | `orb_threads LIMIT 12` | **Ursache „~12 Threads"** |
| `continuity-store.server.ts:40/78` | `THREAD_LOAD_LIMIT = 12` | begrenzt auch den Abgleich |
| `engine.server.ts:363` | `orb_connections LIMIT 40` | Graph-Kanten |
| `engine.server.ts:369` | `orb_messages LIMIT 40` | Verlauf |
| `engine.server.ts:375/381/387` | Interessen 20, Vorschläge 20 / 500 | Anzeige |
| `engine.server.ts:916` | `RECALL_LIMIT = 6` | Erinnerungen je Antwort |
| `engine.server.ts:131/871` | `CANDIDATE_LIMIT = 20`, Kandidaten ×3 | Abruf |
| `engine.server.ts:1952/1961` | Fragen 30, Knoten 60 | autonome Prüfung |
| `engine.server.ts:2012` | `slice(0, 12)` Lücken | Ranking |
| `channels.orb.tsx:311` | `slice(0, 6)` | Textliste unter dem Graph |
| `feed.server.ts:27/54/75` | 30 / 10 | Feed-Beobachtung |

Keines dieser Limits schreibt, löscht oder verhindert einen INSERT.

---

## 8. Experimentelle Rekonstruktion (READ-ONLY)

Ausgeführt wurde ausschließlich die vorhandene Test-Suite ohne Änderung: **1137 Logiktests
(73 Dateien) und 77 DB/Security-Tests – alle grün**. Die Simulation „Memory 41/42" bzw.
„Thread 13/14" ist durch die Produktionsdaten bereits realisiert und damit stärker belegt als
ein Fixture: bei Zeile 41 bis 72 bzw. Faden 13 bis 77 wurde **weiterhin INSERT** ausgeführt,
kein REJECT, kein DELETE, kein Wechsel auf reines UPDATE. Nachweis: `min(created_at)` 2026-09-19,
`max(created_at)` 2026-09-22 bei 72 bzw. 77 Zeilen.

---

## 9. Endresultat

| Beobachtung | Ursache | Typ | Beweis | Confidence |
|---|---|---|---|---|
| Memory ~40 | `GRAPH_LIMIT = 40` in der Snapshot-Abfrage, Anzeige nutzt dieselbe Liste | Retrieval + UI | `engine.server.ts:133,350–356`; `channels.orb.tsx:304`; DB: 72 Zeilen | BEWIESEN |
| Memory-Inhalt wirkt statisch | Sortierung `importance DESC` – neue, unwichtigere Knoten erscheinen nie | Retrieval-Ranking | `engine.server.ts:354–355` | BEWIESEN |
| Threads ~12 | `.limit(12)` in der Snapshot-Abfrage und `THREAD_LOAD_LIMIT = 12` | Retrieval + UI | `engine.server.ts:389–394`; `continuity-store.server.ts:40,78`; DB: 77 Zeilen | BEWIESEN |
| Thread-Wucherung (77 in 3 Tagen) | Abgleich nur gegen 12 geladene Fäden + Füllwort-Titel | Merge-/Titel-Logik | `continuity-store.server.ts:160–180`; `continuity.ts:86–88`; DB-Liste | BEWIESEN |
| Kein Pruning/Löschen | im ORB-Code existiert kein DELETE auf Memory/Threads, keine Trigger, alle Zeilen `active` | Storage | `rg "\.delete\("`; `pg_trigger`; `lifecycle`-Zählung | BEWIESEN |

### MEMORY GROWTH VERDICT
- Hard Cap: **NO**
- Retrieval Limit: **YES** (40)
- UI Limit: **YES** (dieselben 40; Textliste 6)
- Pruning: **NO**
- Deduplication: **YES**, aber nur bei identischem `norm_key` (UPDATE statt INSERT); kein Wachstumsstopp
- Upsert: **NO** (echtes INSERT; bei Schlüsselkonflikt neue Zeile mit `norm_key = NULL`)

### THREAD GROWTH VERDICT
- Hard Cap: **NO**
- Topic merge: **YES** (Topic-Gleichheit + Relevanz ≥ 0.30 oder Textähnlichkeit ≥ 0.50; UNIQUE auf `lower(title)`)
- Similarity threshold: **YES** (0.50 Text, 0.30 Relevanz, Mindestwichtigkeit 0.35)
- Deduplication: **YES**, nur über den Titel
- Retrieval/UI limit: **YES** (12)

### ZUSAMMENHANG DER BEIDEN PHÄNOMENE
**C) Sie entstehen unabhängig voneinander** – zwei getrennte Limits (`GRAPH_LIMIT = 40` und
`.limit(12)`/`THREAD_LOAD_LIMIT = 12`) auf zwei verschiedenen Tabellen.
**Gekoppelt sind sie nur in der Wahrnehmung:** beide Limits stehen in derselben Funktion
`getSnapshot()` und speisen dieselbe Oberfläche, weshalb beides gleichzeitig „stehen bleibt".
Eine gemeinsame Ursache im Sinne eines Speicher- oder Löschmechanismus existiert **nicht**.

---

## 10. Offene Punkte

1. Ob ein externer geplanter Job existiert, ist nicht vollständig prüfbar – das `cron`-Schema ist
   für die Leserolle gesperrt. Indirekter Gegenbeweis: keine Zeile wurde je gelöscht (72 Knoten
   ab dem ersten Tag, alle `active`). **Nicht kausal bewiesen**, aber ohne Hinweis auf Löschung.
2. Die exakte Zahl „ungefähr 40" in der Wahrnehmung des Nutzers kann auch die
   `orb_messages`-Grenze (ebenfalls 40) gespiegelt haben; für die Erinnerungsanzeige ist
   `GRAPH_LIMIT` belegt.
3. Wie viele der 77 Fäden fachlich Dubletten sind, wurde nicht quantifiziert (kein Fix-Auftrag).

---

**READY FOR FIX DESIGN** – die Ursachen beider Beobachtungen sind durch Code und
Produktionsdaten belegt. Es wurde nichts verändert: 0 Codeänderungen, 0 Migrationen,
0 SQL-Schreibzugriffe, 0 Schwellenwertänderungen, 0 Deployment.
