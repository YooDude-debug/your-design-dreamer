# ORB CORE – P10 ANALYSIS ACCESS DISCOVERY (Ergebnis)

Datum: 2026-09-23 · Stand: P9 + Toolbox-Verdrahtung
Referenz: `docs/ORB_TOOLBOX_INTEGRATION_RESULT_2026-09-23.md`

Grundsatz unverändert: **TOOLBOX = ANALYSE · ORB = AUSFÜHRUNG · MENSCH = FREIGABE.**
Read-only, fehlerisoliert, human-in-the-loop, keine automatische Selbständerung.

---

## 1. Warum ORB den Zugang bisher nicht finden konnte

Der Analyse-Adapter `runToolboxAnalysis` existierte, war aber **ausschliesslich über drei
Serverfunktionen in `src/lib/orb-toolbox.functions.ts`** erreichbar. Diese Funktionen sind
HTTP-Einstiegspunkte für die Admin-Oberfläche: sie erzwingen `requireSupabaseAuth`
(Bearer-Token aus dem Browser) und anschliessend `assertAdmin`.

Damit fehlte ORB Core jeder Weg:

- ORB Core läuft **innerhalb** desselben Serveraufrufs; es besitzt kein Bearer-Token und
  kann keine eigene Serverfunktion über HTTP aufrufen (ein solcher Aufruf wäre ein Umweg
  über die Transportschicht, kein interner Aufruf).
- Kein Modul unter `src/orb-core/` importierte den Adapter; der Bericht der Verdrahtung
  führte „Aufruf aus ORB heraus“ ausdrücklich als *nicht implementiert*.
- Die ORB-SDK-Fassade (`src/orb-sdk/orb-core.server.ts`) – die einzige erlaubte Tür in den
  Core – kannte keine Analysefähigkeit.

Fehlend war also **keine Berechtigung, sondern eine Tür**: ein interner Server-zu-Server-Pfad.

## 2. Vorhandene Analyse-Schnittstelle

- `src/orb-core/toolbox/adapter.server.ts` → `runToolboxAnalysis(db, request)`
  (lesend, wirft nie, Zeitgrenze, 0 Modellaufrufe)
- `src/orb-core/toolbox/contract.ts` → Analysearten, technische Identität, harte Grenzen
- Unterstützte Analysen: `memory_recall` (über `@/orb-dev/diagnose.server`),
  `repair_pipeline_state` (über `@/orb-dev/repo.server#listProposals`)
- Nicht unterstützt und dokumentiert: `system_logs`, `request_structure`

## 3. Vorhandene Zugänge (vor P10)

| Zugang | Art | Schutz |
|---|---|---|
| `orbToolboxCapabilities` (GET) | Serverfunktion | `requireSupabaseAuth` + `assertAdmin` |
| `orbToolboxAnalyze` (POST) | Serverfunktion | `requireSupabaseAuth` + `assertAdmin` |
| `orbToolboxRequestOperation` (POST) | Serverfunktion | `requireSupabaseAuth` + `assertAdmin` |

Alle drei sind für die Admin-Oberfläche bestimmt. Technisch nutzbar für ORB: **keiner**.

## 4. Fehlende Verbindung

ORB Core → (keine Verbindung) → Adapter. Es existierte kein interner Vertrag
`analyze(analysisType, context)` und keine Möglichkeit, den Zugang überhaupt zu *erkennen*.

## 5. Konkret hergestellte Verbindung

```
ORB Core / SDK-Fassade
   ↓  discoverAnalysisAccess()   (Auffindbarkeit, ohne Datenbank)
   ↓  requestAnalysis(...)       (ausdrückliche, lesende Anforderung)
src/orb-core/toolbox/access.server.ts        ← neu, minimal
   ↓  has_role(admin) über den angemeldeten Datenzugang
src/orb-core/toolbox/adapter.server.ts       ← unverändert
   ↓
bestehende Analysestrecke (orb-dev)          ← unverändert
```

Neuer minimaler Access Contract (`access.server.ts`):

- `discoverAnalysisAccess(): OrbAnalysisAccess` – beschreibt Transport
  (`internal_server_call`), Adapter, Quelle, Berechtigung, Read-only-Zusage,
  verfügbare und unterstützte Analysearten. Kein Datenbankzugriff, kein Modellaufruf.
- `requestOrbAnalysis(db, userId, { analysisType, eventId?, requestId?, timeoutMs? })`
  – prüft die Administratorrolle, ruft den vorhandenen Adapter, liefert immer die
  bestehende Ergebnisform.
- `isAnalysisAvailable(type)` – reine Auskunft.

Kein neuer HTTP-Endpunkt, keine neue Tabelle, keine Migration, keine zweite Architektur.

## 6. Berechtigungsmodell

Unverändert und **nicht aufgeweicht**: die Prüfung läuft über den übergebenen,
RLS-gebundenen Datenzugang des angemeldeten Benutzers mit der bestehenden
`has_role(_user_id, 'admin')`-Funktion. Kein Dienstschlüssel, keine Credentials in ORB,
kein Adminschutz entfernt. Ohne Administratorrolle: `status: "FAILED"`,
`failureKind: "unauthorized"` – keine Analyse, keine Ausnahme.

Neue Quelle `orb_internal` in `TOOLBOX_SOURCES`. Die verbotenen Quellen
(`orb_autonomous`, `llm`, `memory`, `graph`, `system_prompt`) bleiben unverändert
verboten: eine autonome, modell- oder gedächtnisgetriebene Anforderung ist weiterhin
nicht möglich.

## 7. Read-only-Grenzen

Der Zugang darf: Analyse anfordern, technischen Zustand lesen, Befund und Empfehlung
empfangen. Er darf nicht: Dateien/Code ändern, ORB-Daten ändern, Migration, Deployment,
Secrets, ORB-Konfiguration, Patch anwenden. `checkToolboxOperationAllowed` lehnt jede
Schreiboperation weiterhin mit Begründung ab; `analysisGrantsAuthority()` bleibt `false`.
`access.server.ts` enthält keine einzige Schreiboperation (durch Test geprüft).

Human Loop unverändert zwingend:
`Analyse → Befund → Vorschlag → menschliche Freigabe → Testumgebung → separate
Veröffentlichungsfreigabe`. Jede Empfehlung trägt fest `requiresHumanApproval: true`,
`applied: false`.

## 8. Fehlerverhalten

| Fall | Ergebnis | ORB Core |
|---|---|---|
| fehlende Berechtigung | `FAILED` / `unauthorized` | läuft weiter |
| Berechtigungsprüfung fehlerhaft | `FAILED` / `unauthorized` | läuft weiter |
| Adapter nicht ladbar / nicht erreichbar | `FAILED` / `unavailable` | läuft weiter |
| Zeitüberschreitung | `FAILED` / `timeout` | läuft weiter |
| Analyseart nicht bekannt | `FAILED` / `unsupported_request` | läuft weiter |
| Analyseart bekannt, nicht unterstützt | `UNSUPPORTED` mit Begründung | läuft weiter |

Die Funktion wirft nie. Die Analyse ist keine kritische Abhängigkeit des Chatpfads.

## 9. AI-/DB-Auswirkungen

- **Modellaufrufe:** 0 – die Verdrahtung ruft kein Sprachmodell.
- **Normaler Chatpfad:** unverändert. Kein Modul unter `src/orb-core/` (engine, process,
  feed, autonomy, impulse) importiert den Zugang – durch Test geprüft. Keine zusätzliche
  Datenbankabfrage, keine geänderte Entscheidungslogik, P9-Stand erhalten.
- **Nur bei ausdrücklicher Anforderung:** 1 Rollenprüfung (`has_role`) plus die Abfragen
  der jeweiligen Analyse (`repair_pipeline_state`: 1 lesende Abfrage, `memory_recall`: 0).
- **Technische Identität:** bestehende Kennungen werden wiederverwendet
  (`event_id` evt_…, `request_id` mrq_…, `analysis_id` ORB-TBX-…). Kein zweites ID-System.
  Keine Chattexte, keine personenbezogenen Inhalte, keine Schlüssel.

## 10. Tests

`tests/orb-analysis-access.test.ts` – 8 neue Tests, alle geforderten Punkte 1–12:
Auffindbarkeit; lesende Anforderung; Antwort lesbar; keine Schreiboperation; keine
Patch-Anwendung; 0 Modellaufrufe; kein zusätzlicher DB-Zugriff im normalen Pfad
(Importprüfung); nicht erreichbar; fehlende Berechtigung; Zeitüberschreitung;
Freigabe bleibt zwingend.

Regression: **1397 Logiktests grün** (88 Dateien, inkl. der 18 Toolbox-Tests),
**102 Datenbank-/Sicherheitstests grün**, Typprüfung fehlerfrei, Lint sauber, Build OK.
Keine echten Modellaufrufe.

## 11. Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/orb-core/toolbox/access.server.ts` | **neu** – minimaler interner Zugang |
| `src/orb-core/toolbox/contract.ts` | Quelle `orb_internal` ergänzt (+ Konstante) |
| `src/orb-sdk/orb-core.server.ts` | zwei weiterreichende Fähigkeiten: `discoverAnalysisAccess`, `requestAnalysis` |
| `tests/orb-analysis-access.test.ts` | **neu** – 8 Tests |
| `docs/ORB_ANALYSIS_ACCESS_DISCOVERY_RESULT_2026-09-23.md` | **neu** – dieser Bericht |

## 12. Bewusst NICHT geändert

`src/orb-core/engine.server.ts` (P9-Stand), `process.server.ts`, `feed.server.ts`,
`analysis/*`, `autonomy.ts`, `impulse.ts`, `recall.ts`, `conversation.ts`, `context.ts`,
`eligibility.ts`, `llm/*`, `voice.server.ts`, `observability.server.ts`,
`toolbox/adapter.server.ts`, alle `src/orb-dev/*`, `src/lib/orb-toolbox.functions.ts`,
`src/lib/orb-chat-bridge.functions.ts`, `src/lib/orb-dev.functions.ts`,
`src/routes/admin.orb-dev.tsx`, Datenbankschema (keine Migration), RLS-Regeln,
Berechtigungen, Secrets, Prompts, Modelle, Schwellen.

Bewusst nicht gebaut: automatischer Aufruf aus dem Verarbeitungspfad, Vorschlagserzeugung
durch die Analyse, asynchrone Warteschlange, Anzeige im Admin-Bereich, neue Analysearten.

---

**STOPP.** Die Verbindung ist hergestellt und rein lesend. Jeder weitere Schreib-,
Patch-, Migrations- oder Veröffentlichungsschritt erfordert eine neue ausdrückliche
menschliche Freigabe.
