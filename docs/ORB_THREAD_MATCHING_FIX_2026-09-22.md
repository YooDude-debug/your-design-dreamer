# ORB CORE – THREAD MATCHING FIX

Datum: 2026-09-22 · Modus: CONTROLLED IMPLEMENTATION · keine neuen Features · keine Migration · kein Deployment

## 1. Bestätigte Root Cause

`loadThreads()` lud mit `THREAD_LOAD_LIMIT = 12` **eine** Fadenmenge, die gleichzeitig Anzeige/Snapshot *und* die Zuordnung in `syncThreads()` speiste (`engine.server.ts:984 → 1419`). Lag der thematisch passende Faden nicht unter den 12 zuletzt berührten, galt "kein Treffer" und bei `importance ≥ 0.35` entstand ein neuer Faden, obwohl ein passender existierte. CODE-BEWIESEN.

## 2. Reproduzierter Fehler VOR dem Fix

Test `tests/orb-thread-matching.test.ts`, Fall „REPRODUKTION": 12 junge Fäden mit Thema `hardware` plus ein 48 h alter Faden `japan reise` (Thema `reisen`, Status OPEN). Eingabe „Ich war in Japan und will wieder hin." (Thema `reisen`, importance 0.8). Mit der Anzeige-Auswahl als Kandidaten: `reactivated = null`, ein INSERT. Der erste Lauf der neuen Datei war rot (9 von 12 Fällen), weil die getrennte Kandidatenabfrage noch nicht existierte.

## 3. Implementierte Änderung

ROOT CAUSE → FIX → REGRESSION TEST → RESULT

- **FIX 1** – `src/orb-core/continuity-store.server.ts`: neue Konstante `THREAD_MATCH_CANDIDATE_LIMIT = 60` und neue Lesefunktion `loadMatchCandidates(db, userId, q, limit = 60)`: `orb_threads WHERE user_id = … AND status <> 'RESOLVED' ORDER BY last_activation_at DESC LIMIT 60`. `loadThreads()` und `THREAD_LOAD_LIMIT = 12` unverändert.
- **FIX 2** – `src/orb-core/engine.server.ts`: `matchCandidates` wird parallel zu `loadedThreads` und `loadStyle` geladen; `syncThreads({ … loaded: matchCandidates … })`. Alle übrigen Verwendungen von `loadedThreads` (Anzeige, Wiederaufnahme, `pauseStaleThreads`, `resolveThreadForAnswer`, `persistContradictions`, `threadKnowledgeGaps` bei `:2002`) bleiben auf der 12er-Auswahl.
- **REGRESSION TEST** – `tests/orb-thread-matching.test.ts` (12 Fälle, Datenbank-Doppelgänger, keine Produktionsdaten).
- **RESULT** – 12/12 grün; vollständige Suite grün.

Nicht angefasst: `threadRelevance()`, `similarity()`, Topic-Vergleich, 0.30 / 0.50 / 0.35, RESOLVED-Verhalten, Reaktivierung, UNIQUE(title)-Fallback, `threadTitle()`.

## 4. Warum Anzeige- und Zuordnungs-Limit jetzt getrennt sind

Zwei Verantwortlichkeiten, zwei Abfragen: die Anzeige braucht eine kurze, nach Aktivität sortierte Liste (12); die Zuordnung braucht eine ausreichend grosse Menge offener Fäden, um einen bestehenden Faden wiederzufinden. Die Snapshot-Abfrage (`engine.server.ts:390–394`, `.limit(12)`) ist unverändert – im Browser kommen weiterhin maximal 12 Fäden an.

## 5. Regression Tests

| Fall | Erwartung |
|---|---|
| Anzeige-Limit | `THREAD_LOAD_LIMIT === 12` |
| Kandidaten-Limit | `> THREAD_LOAD_LIMIT` |
| `loadThreads` | höchstens 12, alter Faden **nicht** enthalten |
| `loadMatchCandidates` | alter Faden enthalten, `≤ 60` |
| REPRODUKTION | mit 12er-Auswahl entsteht ein neuer Faden (Fehlerbild bleibt dokumentiert) |
| Test A | Treffer innerhalb der 12 → Reaktivierung wie bisher |
| Test B | Treffer ausserhalb der 12 → Reaktivierung, kein INSERT, UPDATE auf `old-match` |
| Test C | kein Treffer → neuer Faden |
| Test C2 | `importance 0.2` → kein Faden |
| Test D | RESOLVED → keine Reaktivierung, in der Kandidatenabfrage gar nicht enthalten |
| Test E | `topic = null` → weiterhin Textähnlichkeit ≥ 0.50 |
| Test E2 | fremdes Thema → getrennt |

## 6. Testergebnisse

- Logik-Suite: **1149/1149** grün (74 Dateien; vorher 1137 + 12 neue)
- DB/Security: **77/77** grün
- Typecheck `bunx tsgo --noEmit`: 0 Fehler
- Lint: 0 Fehler
- Build: `build OK`

Kein bestehender Test wurde verändert, abgeschwächt oder entfernt.

## 7. Performance-Auswirkung

- Verwendetes Kandidatenlimit: **60**. Begründung: deutlich über dem heutigen Bestand des Hauptnutzers (77 Fäden gesamt, davon nur die offenen relevant), aber fest begrenzt, damit die Prüfarbeit in `syncThreads()` nicht mit dem Bestand wächst.
- Abfrage: `select * from orb_threads where user_id = … and status <> 'RESOLVED' order by last_activation_at desc limit 60` – gedeckt durch `orb_threads_user_activity_idx (user_id, last_activation_at DESC)`.
- Serverlast: **eine** zusätzliche, indexgedeckte Abfrage pro verarbeiteter Eingabe, parallel zu den bereits bestehenden; die Schleife in `syncThreads()` prüft statt 12 nun bis zu 60 Fäden im Speicher (reine Rechenarbeit, keine weiteren Abfragen).
- Verbleibende Designfrage: Wächst der Bestand offener Fäden dauerhaft über 60, kann derselbe Effekt an der neuen Grenze wieder auftreten. Eine gezielte Vorauswahl nach Thema (Fix-Design Varianten B/C, erfordert einen Index auf `orb_threads(user_id, topic)` und damit eine genehmigungspflichtige Migration) bleibt offen. Es wurde ausdrücklich **keine** neue Heuristik eingebaut.

## 8. Geänderte Dateien

| Datei | Funktion | ALT | NEU | Grund | Test |
|---|---|---|---|---|---|
| `src/orb-core/continuity-store.server.ts` | Konstanten | nur `THREAD_LOAD_LIMIT = 12` | zusätzlich `THREAD_MATCH_CANDIDATE_LIMIT = 60` | Anzeige- und Zuordnungsgrenze trennen | Limit-Fälle |
| `src/orb-core/continuity-store.server.ts` | neu `loadMatchCandidates()` | – | eigene Abfrage, `status <> 'RESOLVED'`, LIMIT 60 | Kandidatenmenge unabhängig von der Anzeige | `loadMatchCandidates`-Fälle, Test D |
| `src/orb-core/engine.server.ts` | Ladeblock Kontinuität (≈982) | `[loadedThreads, styleState]` | `[loadedThreads, matchCandidates, styleState]` | Kandidaten parallel laden | Test B |
| `src/orb-core/engine.server.ts` | `syncThreads`-Aufruf (≈1419) | `loaded: loadedThreads` | `loaded: matchCandidates` | Zuordnung nutzt die eigene Menge | Test A/B/C |
| `tests/orb-thread-matching.test.ts` | neu | – | 12 Fälle | Reproduktion + Absicherung | – |
| `docs/ORB_THREAD_MATCHING_FIX_2026-09-22.md` | neu | – | dieser Bericht | – | – |

## 9. Scope-Kontrolle

- Nur Thread-Zuordnung geändert: **ja**.
- UI/Snapshot weiterhin LIMIT 12: **ja** (`engine.server.ts:390–394` unberührt, `loadThreads()` unverändert).
- Matching-Schwellen geändert: **nein** (0.30 / 0.50 / 0.35 unverändert).
- Topic-/Memory-/Recall-/Curiosity-/Impulse-/Autonomy-/Energy-/Presence-/Titel-Logik geändert: **nein**.
- DB-Migration erzeugt: **nein**. Schema, Indizes, RLS unverändert.
- Historische Daten verändert: **nein** – kein SQL-Schreibzugriff, keine Bereinigung, keine Zusammenführung, kein Löschen, kein Umbenennen.
- Neue Funktionalität: **nein** – eine Lesefunktion, die die bestehende Logik mit der bisher fehlenden Eingabemenge versorgt.
- Änderungen außerhalb des Scopes: keine gefunden, daher keine Rücknahme nötig.

## 10. Verbleibende Risiken

1. Grenze 60: siehe §7 – oberhalb dieser Zahl offener Fäden ist der Effekt theoretisch wieder möglich (dokumentiert, nicht behoben).
2. `syncThreads()` prüft nun bis zu 60 statt 12 Fäden; dadurch kann ein Treffer entstehen, wo früher ein neuer Faden entstand. Das ist die beabsichtigte Verhaltensänderung – sie kann in der Wahrnehmung dazu führen, dass weniger neue Fäden erscheinen.
3. Altbestand bleibt wie er ist: die bereits doppelt angelegten Fäden verschwinden nicht. Eine Bereinigung wäre ein separater, freigabepflichtiger Schritt.
4. `pauseStaleThreads()`, `resolveThreadForAnswer()` und `persistContradictions()` arbeiten weiter auf der 12er-Auswahl – bewusst außerhalb dieses Scopes, als Beobachtung notiert.
5. Kein End-to-End-Nachweis vom Browser bis zur Speicherung; die Absicherung ist Unit-Ebene mit Datenbank-Doppelgänger.

---

**READY FOR MANUAL REVIEW** – nicht deployt, keine Datenbankänderung.
