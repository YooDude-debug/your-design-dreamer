# ORB Core – Production Release (Memory Quality) + Memory Reset

Datum: 19.09.2026 · Umgebung: Production

## A) Deployment
- Production BEFORE: `659eb3e7ecbab3c5bb396f1146d7bc6bdf2603d2`
- Staging RELEASE SOURCE: `e59128ea` (Projekt 4a5bd367-098d-4501-b206-9e1696fcc09c)
- Veröffentlichung angefordert für https://y-dude.com: JA
- Übertragen (ausschliesslich getesteter Memory-Quality-Fix):
  - neu `src/orb-core/eligibility.ts` (Äusserungsart statement/question/request/fragment,
    Belastbarkeitsfilter, Tippfehler-Korrekturbegriff) – keine Formeln, keine Schwellen
  - `src/orb-core/engine.server.ts`: Eligibility-Filter vor dem aktiven LLM-Kontext,
    Eingangskontrolle vor Persistenz (`isStorableStatement`), Korrektur über bestehende
    negative Rückmeldung, Eingangskontrolle in `recordLearning()` (0.95 unverändert)
  - neu `tests/orb-memory-quality.test.ts`
- Bewusst NICHT übertragen: Zoom/Pan des Spiderweb (`graph-viewport.ts`,
  `OrbGraph.tsx`, `orb-graph-viewport.test.ts`) – neue UI-Funktion, nicht Teil des
  freigegebenen Memory-Quality-Stands. Ebenfalls nicht zurückgesetzt: Production-Wortlaut
  („experimenteller Bereich“), strengerer `tests/integration/db-orb-security.test.ts`,
  Formatierung `core.ts`, `OrbDevPanel.tsx`.
- Unverändert: Schwelle 0.35, Memory-/Recall-Formeln, Conversation Context,
  OpenAI Provider/Fallback, Datenbank, RLS, E2EE/Messenger/Y-Dude.

## B) Tests
- Typecheck: 0 Fehler
- ESLint (ORB-Bereich): 0 Fehler · projektweiter Lint: vorbestehende Altlasten
  (backups/, release/, remotion/), nicht Teil dieses Releases
- Build: erfolgreich
- Unit-/Logiktests: 62 Dateien / 933 Tests grün (bestehende Tests unverändert)
- DB-/Security-Tests: 9 Dateien / 77 Tests grün

## C) Memory Reset
- Test-User eindeutig identifiziert: JA (`9ce1d1b0-7481-4cb0-aedf-5291dae67297`,
  einziger Benutzer mit ORB-Daten in Production)
- Vor Reset: nodes 29, connections 22, state 1, messages 242, metrics 121,
  interests 20, suggestions 1, questions 0, threads 17, style 1
- Nach Reset: alle genannten Tabellen 0 (state/style leer → saubere Neuanlage
  beim nächsten ORB-Start)
- Keine anderen User betroffen: JA (keine weiteren ORB-Datensätze vorhanden)
- Keine Tabelle, Spalte, Index, Policy, Function, Trigger, Migration geändert
- Systemische/nicht-userbezogene ORB-Daten: keine vorhanden

## D) Smoke Test
- Nach dem Reset wurden bewusst KEINE Chat-, Lern- oder Abruftests ausgeführt,
  weil jeder solche Test neue Production-Daten anlegen würde (Vorgabe „Clean Start“).
- Vor dem Reset war der übertragene Stand in Staging getestet; Typecheck, Build,
  ORB-Tests und Security-Tests sind in Production grün.
- Der Clean-Start-Testlauf (Koch / Schuhgröße / Frucht-Störsignal) erfolgt durch
  den Auftraggeber.

## E) Rollback
- Sicherung: `.lovable/backup/pre_orb_memory_quality_2026-09-19/`
  (vorheriges `engine.server.ts`, `ROLLBACK.txt` mit Commit und Staging-Quelle)
- Rücksprung: Datei zurückkopieren, `src/orb-core/eligibility.ts` und
  `tests/orb-memory-quality.test.ts` entfernen. Datenreset ist nicht rückholbar.

## Ergebnis
PRODUCTION CHANGED: YES · DATABASE CHANGED: NO · RLS CHANGED: NO ·
MEMORY FORMULAS CHANGED: NO · MEMORY THRESHOLD CHANGED: NO (0.35) ·
NEW TABLES: NO · NEW FEATURES: NO · OPENAI KEY EXPOSED: NO ·
ORB USER DATA RESET: YES (nur Test-User) · CONFIDENCE WORDING CHANGED: NO

---

## Nachtrag: Spiderweb Zoom/Pan – Production Release

- Production BEFORE: `659eb3e7ecbab3c5bb396f1146d7bc6bdf2603d2` (+ Memory-Quality-Release)
- Staging SOURCE: `e59128ea`
- Sicherung: `.lovable/backup/pre_orb_graph_viewport_2026-09-19/` (vorheriges `OrbGraph.tsx`, ROLLBACK.txt)
- Übertragen: neu `src/components/orb/graph-viewport.ts`, `src/components/orb/OrbGraph.tsx`
  (Wheel-Zoom, Pinch, Pan, Reset, reine SVG-Transform), neu `tests/orb-graph-viewport.test.ts`
- Scope-Prüfung: Nach der Übertragung unterscheiden sich Staging und Production im
  ORB-Bereich nur noch in Wortlaut/Formatierung (Production-Wortlaut „experimenteller
  Bereich“, strengerer `db-orb-security.test.ts`, Formatierung `core.ts`, `OrbDevPanel.tsx`).
  Keine Änderung an ORB Core, Memory, Recall, Eligibility, Thresholds, Nodes/Connections,
  Sprachschicht, Datenbank, RLS. Keine Migration.
- Tests: Typecheck 0 Fehler · ESLint (ORB-UI) 0 Fehler · Build erfolgreich ·
  63 Dateien / 947 Tests grün (davon 14 Viewport-Tests, 7 Spiderweb-UI-Tests) ·
  DB/Security-Tests unverändert grün (77)
- Smoke-Test: `/channels/orb` lädt fehlerfrei, ORB „Online“, Chatbereich bereit,
  Einblick-Kacheln vorhanden, keine Konsolenfehler. Das Netz ist nach dem Memory-Reset
  leer („Noch kein Netz vorhanden“), daher ist die interaktive Zoom-/Pan-/Reset-Bedienung
  live erst mit den ersten echten Erinnerungen prüfbar; abgedeckt durch die 14
  übernommenen Viewport-Tests. Es wurden bewusst keine Testdaten angelegt.
- Gespeicherte ORB-Daten: unverändert (0 Datensätze nach Reset).

ERGEBNIS: PRODUCTION CHANGED: YES (nur Spiderweb-Darstellung) · DATABASE CHANGED: NO ·
RLS CHANGED: NO · ORB CORE CHANGED: NO · MEMORY DATA CHANGED: NO · NEW FEATURES: NO
(bereits getesteter Staging-Stand)
