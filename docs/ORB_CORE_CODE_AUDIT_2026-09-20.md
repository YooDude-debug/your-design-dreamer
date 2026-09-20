# ORB CORE + SDK – Technischer Bewertungs-Audit (READ-ONLY)

Datum: 2026-09-20 · Stand: Production-Checkout nach Context-Intelligence-Release
Art: rein lesend. Keine Änderungen an Code, Datenbank, Rechten, Formeln oder Schwellen.

---

## 1. CODEUMFANG

| Bereich | Dateien | Zeilen |
|---|---|---|
| **ORB Core** (`src/orb-core/`) | 23 | **8 323** |
| davon LLM/Language Layer (`orb-core/llm/` 4 Dateien + `voice.server.ts`) | 5 | 450 |
| davon Analyse-Modul (`orb-core/analysis/`) | 4 | 1 109 |
| **ORB SDK** (`src/orb-sdk/`) | 2 | **152** |
| **Adapter** (`src/integrations/y-dude-orb/`) | 4 | **468** |
| davon Server-Function-Adapter (`orb.functions.ts`) | 1 | 163 |
| davon Browser-Hooks/Avatar (clientseitig) | 3 | 305 |
| ORB-UI (`src/components/orb/`) – nur Darstellung | 14 | 2 651 |
| ORB-Tests (`tests/orb-*.test.ts`) | 21 | 3 968 |

Core-Module (relevante): `core.ts` (253), `engine.server.ts` (2 365), `memory.ts` (610),
`recall.ts` (74), `context.ts` (161), `eligibility.ts` (140), `curiosity.ts` (317),
`gaps.ts` (344), `impulse.ts` (244), `presence.ts` (279), `process.ts` (550),
`process.server.ts` (190), `continuity.ts` (599), `continuity-store.server.ts` (395),
`feed.server.ts` (243), `analysis/*` (4), `llm/*` (4), `voice.server.ts` (108).

## 2. FUNKTIONALITÄT (tatsächlich im Code vorhanden)

- Memory (persistente Knoten, `norm_key`-Deduplizierung) — `engine.server.ts`, `memory.ts`
- Recall (Relevanz-Ranking mit Ebenen A/B/C) — `recall.ts`, `engine.server.ts`
- Importance (`scoreImportance`, Schwelle 0,35) — `core.ts`
- Confidence/Reliability (Quelle → Konfidenz, Steuerung der Formulierung) — `engine.server.ts`
- Decay (`currentWeight`, W_MIN 0,05) — `core.ts`
- Reaktivierung (`reactivate`, `reinforcement`) — `core.ts`
- Connections (`touchConnection`, Gewichte, kein Selbstverbund) — `engine.server.ts`
- Conversation Context (8 Nachrichten) — `context.ts`
- Correction/Contradiction (Widerspruchsverbindungen, Korrektur-Speicherung) — `engine.server.ts`
- Eligibility (Aussage/Frage/Aufforderung/Fragment) — `eligibility.ts`
- Curiosity (Wissenslücken, Fragen) — `curiosity.ts`, `gaps.ts`
- Presence/State (Zustände, proaktive Impulse, Cooldowns) — `presence.ts`, `impulse.ts`
- Learning (`recordLearning`, feste Wichtigkeit 0,95) — `engine.server.ts`
- Process Guardrails (Prozesszustände, Intent) — `process.ts`, `process.server.ts`
- Hintergrundanalyse → Kandidaten/History (nur schreibend) — `analysis/`
- LLM-Integration (OpenAI primär, Gateway-Fallback, Prompt-Bau) — `llm/`
- Sprachein-/-ausgabe (Transkription, Synthese) — `voice.server.ts`
- SDK-API (11 Fähigkeiten, reine Weiterleitung) — `orb-sdk/`
- Feed-Beobachtung (nur auf UI-Auslösung) — `feed.server.ts`

## 3. ARCHITEKTUR

Vier Schichten, durch Tests abgesichert (`tests/orb-sdk-contract.test.ts`):
UI (`components/orb`, `channels.orb.tsx`) → Adapter (`orb.functions.ts`, 11 `createServerFn`,
alle mit `requireSupabaseAuth`) → SDK (`orb-sdk/`, reine Weiterleitungen, keine eigene
Rechenlogik, keine Dienstschlüssel) → Core (`orb-core/`, einzige Umsetzung). Die UI erreicht
den Core nur über Adapter→SDK; der Contract-Test erzwingt dies (zählt Handler/Guards,
verbietet `@/orb-core/`-Importe im Adapter, `Math.` in der SDK, versteckte Exporte).

## 4. FUNKTIONSSTAND je Kernfunktion

| Funktion | Stand |
|---|---|
| Memory / Persistenz | implementiert |
| Recall + Relevanz-Ranking | implementiert |
| Importance / Confidence | implementiert |
| Decay / Reaktivierung | implementiert |
| Connections / Memory-Graph | implementiert |
| Conversation Context (8) | implementiert |
| Correction/Contradiction | implementiert |
| Eligibility-Filter | implementiert |
| Curiosity / Gaps | implementiert |
| Presence / proaktive Impulse | implementiert |
| Learning (`recordLearning`) | implementiert |
| Process Guardrails | implementiert |
| LLM-Integration + Fallback | implementiert |
| Voice (STT/TTS) | implementiert |
| SDK (11 Fähigkeiten) | implementiert |
| Hintergrundanalyse (`analysis/`) | implementiert, aber im Live-Lauf bisher wirkungslos
  (schreibt nur `orb_candidates`/`orb_node_history`; wird nie für Antworten gelesen;
  im Release-Test 0 übernommene Kandidaten) |
| Feed-Beobachtung | implementiert, nur bei ausdrücklicher UI-Auslösung aktiv |

## 5. CODEQUALITÄT / FUNKTIONSFÄHIGKEIT (nur Fakten)

- Typecheck (`tsgo --noEmit`): **grün** (Exit 0)
- Build (`/tmp/observability/build-errors.log`, 2026-09-20T10:32Z): **build OK**
- Gesamttests: **68 Dateien / 1 053 Tests – alle grün** (davon 21 ORB-Testdateien, 3 968 Zeilen)
- Integration/DB-Security: 77 Tests grün (Stand Release-Prüfung)
- Ungenutzte/isolierte Module im echten Ablauf:
  - `textOverlap` und `relevanceScore` (`core.ts`) werden nur in Tests benutzt, nicht im Recall-Pfad.
  - `analysis/*` schreibt Ergebnisse, die keine Antwort-/Recall-Logik je liest.

## 6. KURZFAZIT

- ORB-Core: ca. 8 323 Zeilen / 23 Dateien (davon LLM-Layer 450, Analyse 1 109)
- SDK: ca. 152 Zeilen / 2 Dateien; Adapter: 468 Zeilen / 4 Dateien
- Gesamt relevante ORB-Implementierung (Core+SDK+Adapter): ca. 8 943 Zeilen
- Kernfunktionen: 17 (alle implementiert; Analyse schreibt ungelesen, Feed nur auf Abruf)
- Tests: 21 ORB-Dateien; Gesamtsuite 68 Dateien / 1 053 Tests grün
- Build/Typecheck: grün / grün
- Architekturstatus: Strikte 4-Schichten-Trennung UI→Adapter→SDK→Core, testweise erzwungen.
- Funktionaler Umfang: Vollständiger Kernkreislauf (Eingabe→Abruf→Entscheidung→Sprache→Lernen→Neugier) ist implementiert.
- Funktioniert tatsächlich: Erinnern/Abrufen mit Decay+Reaktivierung; Eligibility-Filter vor
  dem LLM; Zustandssteuerung mit proaktiven Impulsen (Cooldown, Leerlauf); LLM-Antworten mit
  Gateway-Fallback; Lernereignisse mit fester Wichtigkeit.

---

READ-ONLY bestätigt: PRODUCTION CHANGED: NO.
