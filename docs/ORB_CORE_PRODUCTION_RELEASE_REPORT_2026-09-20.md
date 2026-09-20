# ORB CORE – PRODUCTION RELEASE REPORT

Datum: 20.09.2026, 04:5x UTC
Art: Release-Inventar (read-only) → **kein Release ausgeführt**

---

## 1. Production Ausgangsstand

- Production = dieses Projekt (veröffentlicht unter https://y-dude.com).
- Zuletzt veröffentlichter ORB-Stand: ORB Core/SDK-Trennung, Conversation
  Context Fix (8 Züge), Memory Reinforcement, Memory Recall Fix, Spiderweb
  Memory UI inkl. Zoom/Pan, OpenAI-Sprachschicht mit Fallback, Multimodal
  (Bild-/Kamera-Anhänge), Avatar-Animation, Memory-Quality-Filter
  (Utterance Eligibility).
- Datenbank: `orb_nodes` (id, user_id, type, content, importance, confidence,
  activation_count, last_accessed_at, metadata, created_at, updated_at, source,
  norm_key, topic), `orb_connections`, `orb_state`, `orb_messages`,
  `orb_metrics`, `orb_interests`, `orb_suggestions`, `orb_questions`,
  `orb_threads`, `orb_style`. Keine `orb_node_history`, keine `orb_candidates`.

## 2. Staging Ausgangsstand

- Read-only Abzug: `/tmp/cross-project/y-dude-staging-4a5bd367098d4501b2069e1696fcc09c`,
  Commit **abe9b2f1**, Projekt-ID 4a5bd367-098d-4501-b206-9e1696fcc09c, 2479 Dateien.

## 3. Release Inventory (Staging HEAD vs. Production HEAD, ORB-Scope)

Vollständiger Datei-Vergleich der ORB-Bereiche (`src/orb-core/`, `src/orb-sdk/`,
`src/integrations/y-dude-orb/`, `src/components/orb/`, `src/lib/orb-attachments.ts`,
`src/routes/_authenticated/channels.orb.tsx`, `tests/orb-*`, `supabase/migrations/`):

| Datei / Migration | Zweck | Notwendigkeit | Staging-Status | Tests | Production-Relevanz | Risiko | Einstufung |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `src/orb-core/analysis/{analyze,apply}.server.ts`, `validate.ts`, `schema.ts` | Context Intelligence: OpenAI-Kontextanalyse, Validierung, Übernahme ins Netz | neue Fähigkeit | in Staging aktiv | `orb-context-intelligence.test.ts`, `orb-analysis-value-separation.test.ts` | ausdrücklich ausgeschlossen | hoch (schreibt Gedächtnis) | 🔴 nicht freigegeben |
| `src/orb-sdk/orb-core.server.ts` (+`analyzeContext()`) | SDK-Tür für die Kontextanalyse | Teil von Context Intelligence | Staging | SDK-Vertragstest (11 Handler) | ausgeschlossen | hoch | 🔴 nicht freigegeben |
| `src/integrations/y-dude-orb/orb.functions.ts` (+`analyzeOrbContext`) | Serverfunktion der Kontextanalyse | Teil von Context Intelligence | Staging | s. o. | ausgeschlossen | hoch | 🔴 nicht freigegeben |
| `src/routes/_authenticated/channels.orb.tsx` (Hintergrundaufruf `analyzeContext`) | stille Auswertung nach jedem Zug | Teil von Context Intelligence | Staging | — | ausgeschlossen | hoch | 🔴 nicht freigegeben |
| `src/orb-core/engine.server.ts` (`export` von `QueryCounter`, `touchConnection`) | Sichtbarkeit nur für die Analysemodule | nur als Abhängigkeit von Context Intelligence | Staging | bestehende Core-Tests | ohne Analysemodule wirkungslos | mittel | 🔴 nicht freigegeben (Abhängigkeit) |
| `tests/orb-sdk-contract.test.ts` (10 → 11 Handler) | Vertragstest an Context Intelligence angepasst | Folgeänderung | Staging | — | würde in Production fehlschlagen | — | 🔴 nicht freigegeben |
| Migration `20260920043408` (`orb_node_history`, `orb_candidates`, neue `orb_nodes`-Spalten `category`, `decay_rate`, `lifecycle`, `long_term_value`, `source_reference`, `temporal_scope`) | Schema für Context Intelligence / Memory Lifecycle | neue Architektur | Staging | DB-Tests Staging | ausdrücklich ausgeschlossen | hoch (Schemaänderung) | 🔴 nicht freigegeben |
| Migration `20260919075426` | Löschung von Testdaten | Staging-intern | Staging | — | darf nie in Production laufen | hoch | 🔴 nicht freigegeben |
| `continuity-store.server.ts`, `llm/{openai,prompt,select}.server.ts`, `OrbDevPanel.tsx`, `channels.orb.tsx` (Wortlaut „nur Staging" / „Staging-Experiment") | Beschriftung | — | Staging | — | Production verwendet bewusst „experimenteller Bereich" | — | 🟡 Staging only (bewusst nicht übernehmen) |
| `src/orb-core/core.ts` (Formatierung der Typunion) | reine Formatierung | — | Staging | — | keine | — | 🟡 Staging only |
| alle übrigen ORB-Dateien und -Tests | — | — | identisch | — | bereits in Production | — | 🟢 bereits veröffentlicht |

**Ergebnis des Inventars:** Im ORB-Scope existiert seit dem letzten
Production-Stand **keine einzige freigegebene, getestete Änderung**, die noch
nicht in Production ist. Alles Neue in Staging gehört zur ORB Context
Intelligence / Spiderweb-Memory-Architektur (🔴) oder ist Beschriftung bzw.
Formatierung (🟡).

Ausserhalb des ORB-Scopes weichen Staging und Production in vielen Dateien
voneinander ab (u. a. Feed-, Market-, UI-Komponenten, generierte Typen,
zusätzliche shadcn-Komponenten, ältere/neuere Stände beidseitig). Diese
Abweichungen sind nicht Teil dieses Releases und wurden nicht angefasst.

## 4. Bewusst NICHT veröffentlicht

`orb_node_history`, `orb_candidates`, neue `orb_nodes`-Spalten,
`analysis/analyze.server.ts`, `validate.ts`, `apply.server.ts`,
`analyzeContext`/`analyzeOrbContext`, neue Decay-/Lifecycle-Logik,
Context-Analysis-Metriken, Testdaten-Löschmigration, Staging-Wortlaut,
Staging-Secrets, Staging-Testdaten, Staging-Test-User.

## 5. Backup

Nicht erforderlich: es wurde keine Datei und keine Datenbankzeile verändert.
Bestehende Rückspringpunkte bleiben gültig, zuletzt
`.lovable/backup/pre_orb_graph_viewport_2026-09-19/` und
`.lovable/backup/pre_orb_memory_quality_2026-09-19/` (enthält `ROLLBACK.txt`).

## 6. Tests vor Release

Keine Tests als Freigabe-Gate ausgeführt, weil kein Code übertragen wurde und
der Production-Stand unverändert ist. Der zuletzt dokumentierte grüne Stand
gilt weiter: Typecheck, Lint (ORB), Build, 933 Logiktests, 77 DB-/Security-Tests.

## 7. Deployment

**Nicht durchgeführt.** Es wurde nichts übertragen und nichts veröffentlicht.

## 8. Post-Deployment Checks

Entfallen (kein Deployment). Production läuft unverändert auf dem zuletzt
veröffentlichten Stand.

## 9. Performance

Unverändert; keine neue Messung, da kein Eingriff erfolgte.

## 10. Fehler / Warnings

Keine. Einzige Feststellung: `tests/orb-sdk-contract.test.ts` aus Staging
erwartet 11 Serverfunktionen und wäre in Production (10) rot – ein Beleg dafür,
dass der Staging-Stand ohne Context Intelligence nicht übertragbar ist.

## 11. Rollback-Status

Kein Rollback nötig. Rollback-Punkt (Production unverändert):
`.lovable/backup/pre_orb_graph_viewport_2026-09-19/`.

## 12. Finaler Production Commit

Unverändert gegenüber dem Stand vor diesem Auftrag (kein neuer Commit,
keine Veröffentlichung angefordert).

## 13. Verbleibende offene Punkte

- ORB Context Intelligence / Memory Lifecycle braucht einen eigenen
  vollständigen Production-Readiness-Test inkl. Migrationsplan; bis dahin 🔴.
- OpenAI-Guthaben in Production fehlt weiterhin (`insufficient_quota`) –
  Bildanalyse bleibt nicht verifizierbar, Fallback greift.
- Clean-Start-Test des Gedächtnisses steht noch aus (Bestand ist leer).
- Confidence-Wording („Ich bin mir nicht sicher, aber…") bleibt separater
  Auditpunkt.

---

### Ergebnis

PRODUCTION CHANGED: NO
DATABASE CHANGED: NO
RLS CHANGED: NO
MEMORY FORMULAS CHANGED: NO
MEMORY THRESHOLD CHANGED: NO (0.35)
NEW TABLES: NO
NEW FEATURES: NO
OPENAI KEY EXPOSED: NO
DEPLOYMENT PERFORMED: NO
