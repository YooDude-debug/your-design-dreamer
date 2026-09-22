# ORB CORE – MEMORY & THREAD GROWTH · FIX DESIGN

Datum: 2026-09-22 · Modus: **DESIGN ONLY** · 0 Codeänderungen · 0 SQL · 0 Migration · 0 Deployment

Klassifikation je Aussage: **CODE-BEWIESEN** (aktueller Quellcode), **DB-BEWIESEN** (Read-only-Abfrage gegen Produktionsschema), **OFFEN**.
Der vorherige Forensic Report diente nur als Orientierung; alle hier verwendeten Fakten wurden in diesem Pass erneut gegen Code und Schema geprüft.

---

## 1. Bestätigte Ausgangslage

| Fakt | Beleg | Klasse |
|---|---|---|
| `GRAPH_LIMIT = 40` begrenzt die Knotenabfrage | `src/orb-core/engine.server.ts:133`, verwendet in `:356` (`orb_nodes`) und `:363` (`orb_connections`) | CODE-BEWIESEN |
| Threads im Snapshot sind auf 12 begrenzt | `engine.server.ts:390–394` (`orb_threads … .limit(12)`), zweite Stelle `:1928` | CODE-BEWIESEN |
| Thread-Matching lädt nur 12 Fäden | `continuity-store.server.ts:40` `THREAD_LOAD_LIMIT = 12`, `loadThreads()` 74–93, aufgerufen `engine.server.ts:984` und `:2002` | CODE-BEWIESEN |
| Kein Storage-Cap, kein Pruning, kein DELETE für Memory/Threads | im gesamten `src/orb-core` existiert genau ein `.delete()` und der betrifft `orb_questions` (Kompensationspfad) | CODE-BEWIESEN |
| Keine DELETE-Trigger, keine Retention-Funktion auf beiden Tabellen | Schemaprüfung; nur `*_updated_at`-Trigger | DB-BEWIESEN |
| Indizes `orb_nodes`: PK, (user_id,last_accessed_at DESC), (user_id,importance DESC,last_accessed_at DESC), (user_id,lifecycle), UNIQUE (user_id,norm_key) WHERE norm_key NOT NULL, (user_id,topic) WHERE topic NOT NULL, (user_id,type) | `pg_indexes` | DB-BEWIESEN |
| Indizes `orb_threads`: PK, (user_id,last_activation_at DESC), (user_id,status), UNIQUE (user_id,lower(title)) — **kein Index auf `topic`** | `pg_indexes` | DB-BEWIESEN |
| Bestand Hauptnutzer: 72 Knoten, 77 Fäden, alle `active` | Read-only-Zählung | DB-BEWIESEN |

Nicht bestätigt und daher keine Designgrundlage: eine Kopplung der beiden Limits; ein gemeinsamer Cap-Mechanismus; ein externer Cleanup-Job (cron-Schema für die Leserolle gesperrt → **OFFEN**, indirekt widerlegt, weil keine Zeile fehlt).

---

## 2. Memory-Limit-Analyse (LIMIT 40)

- **Warum existiert es?** Es ist ein Schutz der Snapshot-Abfrage: `getSnapshot()` liest in einem Durchgang Knoten, Verbindungen, Nachrichten, Interessen, Vorschläge, Fäden. `GRAPH_LIMIT` hält Antwortgröße und Zeichenlast des Graphen konstant. Eine Absicht "nur 40 Erinnerungen behalten" ist im Code nicht formuliert. (CODE-BEWIESEN für die Wirkung, **OFFEN** für die ursprüngliche Absicht.)
- **Welche Query?** `db.from("orb_nodes").select(...).eq("user_id", …).order("importance", desc).order("last_accessed_at", desc).limit(GRAPH_LIMIT)` — exakt durch `orb_nodes_user_importance_idx` gedeckt.
- **Wer verwendet das Ergebnis?** `snapshot.nodes` → `channels.orb.tsx:304` (`${snapshot.nodes.length} Erinnerungen`), `:308` `<OrbGraph nodes … connections …>`, `:311` `slice(0, 6)` Liste. Die angezeigte Zahl ist damit die Länge der begrenzten Liste, nicht der Bestand.
- **Dieselbe Query an anderer Stelle?** Nein. Recall verwendet eine eigene Abfrage (LIMIT 60 → `selectByLevel(…, 6)`), Kandidatenextraktion `CANDIDATE_LIMIT = 20`. Diese Pfade sind vom Anzeigelimit unabhängig — eine Änderung an `GRAPH_LIMIT` verändert Recall nicht. (CODE-BEWIESEN)
- **Erhöhung — Performanceabschätzung:** Die Sortierung ist indexgedeckt, die Kosten wachsen linear mit der Zeilenzahl. Zusätzlich hängt `orb_connections` am selben `GRAPH_LIMIT`; der Graph wächst in der Darstellung stärker als linear (Kanten), die UI-Renderlast ist der engere Faktor, nicht die DB.
- **Pagination / Load-More / Infinite Scroll:** existiert nirgends für Erinnerungen (CODE-BEWIESEN — keine Offset-, Cursor- oder Seitenparameter in `getSnapshot()` oder der Route).
- **Weitere 40er-Grenzen:** `orb_connections` (dasselbe `GRAPH_LIMIT`) und `orb_messages` (`limit(40)`). Diese Übereinstimmung erklärt, warum "ungefähr 40" an mehreren Stellen erscheinen kann.

### Varianten (keine Auswahl)

| | A: 40 beibehalten | B: Pagination | C: Load-More | D: anderes Retrieval (z. B. Zählung getrennt von Liste) |
|---|---|---|---|---|
| Technische Änderung | keine | Cursor/Offset in Snapshot oder eigene Abfrage-Funktion | separate Abfrage mit größerem Limit auf Klick | `count: "exact", head: true` für die Summe + unverändert 40 für den Graphen |
| Performance | unverändert | pro Seite konstant | ein zusätzlicher Aufruf pro Klick | eine zusätzliche Zählabfrage pro Snapshot |
| DB-Last | unverändert | gering, indexgedeckt | gering | sehr gering (Index-Only-Zählung) |
| UX | Bestand bleibt unsichtbar | vollständige Einsicht, mehr Bedienschritte | vollständige Einsicht, einfache Bedienung | Bestand sofort korrekt sichtbar, Liste bleibt kurz |
| Architektur | keine Reibung | Snapshot wird zustandsbehaftet (Cursor) | zweite Lesefunktion nötig | Snapshot bleibt zustandslos |
| Rückwärtskompatibilität | vollständig | Snapshot-Form ändert sich | additiv | additiv |

---

## 3. Memory-Retrieval-Analyse (Wichtigkeitssortierung)

- Sortierung: `importance DESC, last_accessed_at DESC`, passend zum vorhandenen Index. (CODE/DB-BEWIESEN)
- Für die Graph-Darstellung ist die Wahl plausibel (wichtige Knoten zuerst zeichnen); als *einzige* Quelle der Nutzeranzeige hat sie eine Nebenwirkung.
- **Kann eine korrekt gespeicherte neue Erinnerung dauerhaft außerhalb der 40 bleiben?** **Ja, CODE-BEWIESEN.** Liegt ihre `importance` unter der 40-wichtigsten, erscheint sie nie — unabhängig vom Alter. Bei 72 Zeilen ist das für ein Drittel des Bestandes strukturell möglich. Speicherung, Recall, Fäden und autonome Fragen sind davon **nicht** betroffen.
- Minimale Designmöglichkeiten: (a) unverändert lassen, (b) zweite kurze "zuletzt gelernt"-Liste aus derselben Zeilenmenge anderer Sortierung, (c) Mischrang `importance` + Rezenz nur für die Anzeige, (d) Pagination wie in §2. Keine davon berührt Speicher- oder Recall-Logik.

---

## 4. Thread-Limit-Analyse (LIMIT 12)

Zwei getrennte Stellen mit derselben Zahl:
1. **Anzeige:** `engine.server.ts:390–394`, `.order("last_activation_at", desc).limit(12)` → `snapshot.threads` → `channels.orb.tsx:375/383`.
2. **Matching-Eingang:** `THREAD_LOAD_LIMIT = 12` in `loadThreads()`, Ergebnis wird als `input.loaded` an `syncThreads()` übergeben (`engine.server.ts:984 → 1410`).

Damit vermischt der aktuelle Code Darstellung und Entscheidung insofern, als **beide** denselben Ausschnitt "die 12 zuletzt berührten Fäden" verwenden. Ein Fix darf nur (2) betreffen. (CODE-BEWIESEN)

---

## 5. Thread-Matching-Analyse

Kette, vollständig aus `continuity-store.server.ts:140–240` und `continuity.ts`:

```text
Eingabe (text, topic, importance, focusNodeId)
  → loadThreads(): orb_threads WHERE user_id ORDER BY last_activation_at DESC LIMIT 12
  → je Faden: projectThread() (Verfall, Status — reine Berechnung)
      status === RESOLVED                       → übersprungen
      thread.topic ≠ null && input.topic ≠ null && ungleich → übersprungen
      relevance = threadRelevance(thread, {text, conversationTopics, interests, now})
      textual   = similarity(input.text, thread.known.join(" "))
      matches   = (sameTopic && relevance ≥ 0.30) || textual ≥ 0.50
  → bester Treffer nach relevance → reactivateThread() + focusNodeId anhängen + UPDATE
  → kein Treffer:
      importance < 0.35                         → gar nichts
      threadDraftFrom() === null                → gar nichts
      INSERT; UNIQUE (user_id, lower(title)) 23505 → bestehenden Faden per ilike(title) berühren
```

- `threadRelevance()` (`continuity.ts:205`): `clamp01((0.55·curiosity + 0.25·importance + 0.20·interestWeight) · max(topical, 0.4+0.6·textual) · recencyFactor(last_activation_at))`. `topical` = 1 bei Themenüberschneidung, sonst 0.55.
- **Zeitbezug:** `recencyFactor` ist Faktor der Relevanz *und* `last_activation_at` ist das Ladekriterium. Alte, thematisch passende Fäden sind dadurch doppelt benachteiligt: sie werden gar nicht geladen, und wären sie geladen, senkt die Rezenz ihre Relevanz.
- **Normalisierung/Prefix:** im Matching selbst nicht verwendet; nur `topic` (aus `topicOf()`), `similarity()` und der Titel-UNIQUE-Index (`lower(title)`). Der bekannte Prefix-Effekt aus `topicOf()` wirkt indirekt über ein falsches `topic` — nicht Teil dieses Designs.
- **Konsequenz (CODE-BEWIESEN):** Existiert der passende Faden außerhalb der 12 jüngsten, gilt "kein Treffer" und bei `importance ≥ 0.35` entsteht ein Duplikat — es sei denn der Titel kollidiert exakt, dann greift der 23505-Pfad. Das erklärt 77 Fäden in drei Tagen.

---

## 6. Thread-Titel-Analyse

- Erzeugt in `continuity.ts:84–93` `threadTitle(content)`: `contentTokens(content)` → drei **längste** eindeutige Tokens in Originalfolge, verbunden mit Leerzeichen. Fallback bei null Tokens: `content.trim().slice(0, 40)`.
- Der Titel ist damit ein Satzfragment aus Nutzertext, kein Keyword und kein Thema. (CODE-BEWIESEN)
- **Mindestqualität?** Keine. Es gibt keine Stoppwortliste, keine Mindestlänge, keine Prüfung auf Inhaltswort. Enthält eine Eingabe nur Füllwörter, die `contentTokens()` passieren, wird das längste davon Titel — "warum", "vielleicht", "welche" sind so erklärbar. (CODE-BEWIESEN)
- **Zusammenhang Faden ohne Erinnerung:** `node_ids` wird nur gefüllt, wenn `focusNodeId` gesetzt ist (`syncThreads`, Zeile "node_ids: input.focusNodeId ? [input.focusNodeId] : []"). Ein Faden entsteht bereits bei `importance ≥ 0.35`; die Erinnerung entsteht zusätzlich nur, wenn `isStorableStatement()` und die Speicherschwelle greifen. Fäden ohne Erinnerung sind damit der reguläre Ausgang beider unabhängiger Gates, kein Fehler. (CODE-BEWIESEN)
- Designmöglichkeiten (nur dokumentiert): (a) Stoppwortfilter allein für `threadTitle()`, (b) Mindestlänge/Mindestanzahl Inhaltswörter, sonst Fadenerzeugung unterlassen, (c) Titel aus `topic` + Fragment, (d) unverändert lassen und Titel nur in der Anzeige aufwerten. Der Topic-/Memory-Classifier bleibt in allen Varianten unangetastet.

---

## 7. Designvarianten Memory

Siehe Tabelle §2 (A–D) und §3 (a–d). Keine Variante wird empfohlen oder als beste bezeichnet.

---

## 8. Designvarianten Thread Matching

**A) Matching unabhängig vom UI-Limit**
- Änderung: `loadThreads()` behält 12 für die Anzeige; `syncThreads()` erhält eine eigene, getrennt parametrisierte Kandidatenmenge (z. B. eigenes Limit als Argument des Aufrufers in `engine.server.ts:984`).
- Dateien: `engine.server.ts`, `continuity-store.server.ts`. DB: keine Änderung.
- Performance: eine zusätzliche Abfrage pro Eingabe, indexgedeckt über `orb_threads_user_activity_idx`.
- Risiko: die Kandidatenmenge wächst mit dem Bestand; ohne Obergrenze steigt die Prüfarbeit in `syncThreads()` linear.
- Tests: Treffer innerhalb/außerhalb der ersten 12; Anzeige unverändert 12.
- Rückwärtskompatibel: ja, Snapshot-Form unverändert.

**B) Separater Matching-Query**
- Änderung: neue Funktion `loadMatchCandidates()` neben `loadThreads()` — `status ≠ RESOLVED` plus Themenfilter, eigenes Limit.
- Dateien: `continuity-store.server.ts` (neue Lesefunktion), `engine.server.ts` (Aufruf). DB: optional ein Index `(user_id, topic)` auf `orb_threads` — **existiert heute nicht** (DB-BEWIESEN); wäre eine Migration und damit außerhalb dieses Designs zu genehmigen.
- Performance: konstant, weil vorgefiltert; nutzt `orb_threads_user_status_idx`.
- Risiko: Fäden mit `topic = null` müssen ausdrücklich mitgeladen werden, sonst verschlechtert sich das Matching gegenüber heute.
- Tests: `topic = null` auf beiden Seiten; RESOLVED bleibt ausgeschlossen.

**C) Gezielte Kandidatensuche (Topic/Keyword/normalisierter Schlüssel)**
- Änderung: Kandidaten über `topic = input.topic OR topic IS NULL` und zusätzlich Titel-/Textähnlichkeit in der DB (z. B. `ilike`/trgm — `pg_trgm` ist im Projekt vorhanden), begrenztes Limit, danach unverändert `threadRelevance()`/`similarity()` im Code.
- Dateien: `continuity-store.server.ts`, `engine.server.ts`. DB: trgm-Index wäre eine Migration (genehmigungspflichtig).
- Performance: am besten skalierend, höchste Komplexität.
- Risiko: die Vorauswahl in SQL ist eine **zweite** Auswahlheuristik neben der Logik in `continuity.ts` — verletzt den bestehenden Grundsatz "keine zweite Entscheidungslogik im Store", wenn sie zu eng filtert.
- Tests: identische Treffer wie bei Vollprüfung über eine Fixture-Menge; Nachweis, dass kein heute gefundener Treffer verloren geht.

Ausdrücklich unzureichend (aus der Aufgabenstellung, hier bestätigt): `LIMIT 12 → LIMIT 77` sowie "alle Fäden in den Browser laden" — beides skaliert nicht und vermischt Anzeige und Entscheidung weiter.

---

## 9. Designvarianten Thread Titles

Siehe §6 (a–d). Zusätzlich möglich: Titel bleibt wie heute, aber ein Faden wird nur erzeugt, wenn `threadDraftFrom()` mindestens ein Inhaltswort oberhalb einer Mindestlänge findet — kleinste Änderung mit direkter Wirkung auf die Fadenmenge; Nebenwirkung: weniger Fäden als heute, daher regressionspflichtig gegen `tests/orb-continuity.test.ts`.

---

## 10. Datenbankauswirkungen

- Varianten A (Memory und Thread) sowie Pagination/Load-More: **keine** Schemaänderung, keine Migration, keine Datenänderung.
- Variante B/C beim Thread-Matching: optionaler Index auf `orb_threads(user_id, topic)` bzw. ein trgm-Index. Beides wäre eine eigene, ausdrücklich zu genehmigende Migration.
- RLS: unverändert; alle Abfragen laufen weiter über `user_id` des authentifizierten Aufrufers.
- Keine rückwirkende Bereinigung. Eine mögliche späteres Zusammenführen doppelter Fäden bleibt ein **separater zukünftiger Schritt** und ist nicht Teil dieses Designs.

---

## 11. Performanceauswirkungen

| Maßnahme | DB | Server | Browser |
|---|---|---|---|
| `GRAPH_LIMIT` erhöhen | linear, indexgedeckt | größere Antwort | Graph-Render ist der Engpass |
| Zählabfrage getrennt | eine Index-Only-Zählung | vernachlässigbar | keine |
| Matching-Kandidaten getrennt (A) | eine Abfrage mehr pro Eingabe | linear zur Kandidatenzahl | keine |
| Vorgefilterte Kandidaten (B/C) | konstant bei Index | konstant | keine |
| Titelqualität | keine | vernachlässigbar | keine |

---

## 12. Testdesign (für einen späteren Fix, heute nicht angelegt)

**Memory** — 1. Bestand > 40 vorhanden → Speicherpfad liefert weiter INSERT; 2. Anzeige lädt weiter fehlerfrei; 3. Anzeige/Zählung spiegelt den Bestand gemäß gewählter Variante; 4. neue Erinnerung wird gespeichert; 5. Nachweis, dass kein Storage-Cap greift (Zeile 41+ wird eingefügt, nichts gelöscht).

**Thread Matching** — 1. 12 Fäden vorhanden; 2. passender Faden innerhalb der ersten 12 → Reaktivierung; 3. passender Faden **außerhalb** der ersten 12 → Reaktivierung statt Neuanlage (der eigentliche Regressionstest); 4. kein passender Faden → Neuanlage; 5. Neuanlage nur bei `importance ≥ 0.35`; 6. RESOLVED wird nie reaktiviert; 7. `topic = null` auf einer Seite blockiert das Matching nicht.

**Thread Titel** — 1. sinnvoller Titel bleibt; 2. Füllwort erzeugt keinen Füllworttitel (oder gar keinen Faden); 3. kurzer Satz; 4. unbekannter Begriff; 5. Faden ohne `node_ids` bleibt gültig.

**Regression** — `tests/orb-continuity.test.ts`, `orb-memory.test.ts`, `orb-memory-quality.test.ts`, `orb-memory-recall-fix.test.ts`, `orb-topic-classification.test.ts`, `orb-autonomy-gate.test.ts` plus vollständige Suite (aktuell 1137 Logik + 77 DB/Security) müssen unverändert grün bleiben; kein Test wird abgeschwächt.

---

## 13. Risiken

1. Kandidatenmenge beim Matching ohne Obergrenze → Laufzeit wächst mit dem Bestand (heute konstant 12).
2. Zu enge SQL-Vorfilterung → heute gefundene Treffer gehen verloren (stillschweigend, ohne Fehler).
3. Strengere Titelregel → weniger Fäden; bestehende Erwartungen in `orb-continuity.test.ts` können brechen und müssen inhaltlich geprüft, nicht angepasst werden.
4. Anzeige-Erhöhung bei Erinnerungen → Renderlast des Graphen, kein DB-Problem.
5. Jede Änderung an `similarity`/`threadRelevance` würde auf autonome Fragen durchschlagen — deshalb in allen Varianten unberührt.
6. Altbestand bleibt inkonsistent (doppelte Fäden, Füllworttitel); ohne separaten Bereinigungsschritt bleibt das sichtbar.

---

## 14. Scope / Nicht-Scope

**Änderbar (je Variante):** `src/orb-core/continuity-store.server.ts` (Ladefunktion/Kandidaten), `src/orb-core/engine.server.ts` (`GRAPH_LIMIT`, Snapshot-Thread-Limit, Aufrufe), `src/orb-core/continuity.ts` (nur `threadTitle`), `src/routes/_authenticated/channels.orb.tsx` (Anzeige), neue Tests unter `tests/`.

**Nicht ändern:** `src/orb-core/memory.ts` (Topic/Similarity/Speicherschwellen), `src/orb-core/curiosity.ts`, `src/orb-core/autonomy.ts`, `src/orb-core/presence.ts`, `src/orb-core/core.ts` (Energy), `src/integrations/supabase/*` (generiert), bestehende Tests (nur ergänzen), Schwellenwerte 0.30/0.35/0.50/0.15/0.25/0.02.

**Betroffene DB-Objekte:** `orb_nodes` (nur lesend), `orb_threads` (nur lesend; optionaler Index nur in Variante B/C, genehmigungspflichtig).

**Ausdrücklich außerhalb des Scopes:** rückwirkende Bereinigung/Zusammenführung, LLM-basierte Titel oder Topics, neue Tabellen, neue Fähigkeiten, Änderung der Recall-Logik, Änderung der autonomen Entscheidungskette, Energy-Modell, Deployment.

---

## 15. Empfohlene Reihenfolge einer späteren Implementierung

1. Regressionstest "passender Faden außerhalb der ersten 12" schreiben, der heute **rot** ist (Beweis vor Fix).
2. Entkopplung Anzeige vs. Matching (Variante A als kleinster Schnitt, oder B/C nach Entscheidung) — ohne Änderung der Matching-Kriterien.
3. Titelqualität als separater, eigenständig testbarer Schritt.
4. Sichtbarkeit der Erinnerungen (Zählung, Pagination oder Load-More) als eigener, reiner Anzeigeschritt.
5. Erst danach und nur auf ausdrückliche Freigabe: Bewertung einer Bereinigung des Altbestands.

Jeder Schritt einzeln: Test rot → Fix → Test grün → vollständige Suite → Bericht. Keine Bündelung.

---

**READY FOR IMPLEMENTATION REVIEW**

Verändert in diesem Pass: 0 Codedateien, 0 Tests, 0 SQL-Schreibzugriffe, 0 Migrationen, 0 Schwellenwerte, 0 Deployments. Nur dieser Bericht wurde angelegt.
