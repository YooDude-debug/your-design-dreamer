# ORB CORE – P11 SELBSTDIAGNOSE (Ergebnis)

Referenz: `docs/ORB_ANALYSIS_ACCESS_DISCOVERY_RESULT_2026-09-23.md`
Grundsatz: ORB darf seinen Zustand untersuchen und ein Problem erkennen –
**ORB wendet nichts an. Menschliche Freigabe bleibt zwingend.**

---

## 1. Zeitpunkt der Diagnose

2026-09-23, 11:44–11:46 UTC (13:44–13:46 Berlin). Einmaliger, kontrollierter Lauf.
Kein Zeitplan, keine Schleife, keine Wiederholung eingebaut.

## 2. Verwendete Analyse-Schnittstelle

Ausschliesslich der in P10 hergestellte interne Zugang:

- `src/orb-core/toolbox/access.server.ts#discoverAnalysisAccess` (Auffindbarkeit)
- `src/orb-core/toolbox/access.server.ts#requestOrbAnalysis` (lesende Anforderung)
- dahinter unverändert `src/orb-core/toolbox/adapter.server.ts#runToolboxAnalysis`
  → `@/orb-dev/diagnose.server`, `@/orb-dev/repo.server#listProposals`

Gemeldeter Zugang (unverändert wie in P10 festgelegt):
`transport: internal_server_call`, `requiresAdminRole: true`, `readOnly: true`,
`requiresHumanApprovalForAnyChange: true`, `source: orb_internal`.

Ergänzend wurden reine Zählabfragen auf den Zustand der ORB- und Reparaturtabellen
gelesen (nur Anzahlen, **keine Inhalte, keine Chattexte, keine Nutzerdaten**).

## 3. Analysierte Komponenten

**Bestandsaufnahme (Code, lesend):** `src/orb-core/` mit `engine.server.ts`,
`process.server.ts`/`process.ts`, `memory.ts`, `recall.ts`, `gaps.ts`, `curiosity.ts`,
`impulse.ts`, `autonomy.ts`, `presence.ts`, `continuity.ts`/`continuity-store.server.ts`,
`conversation.ts`, `context.ts`, `core.ts`, `eligibility.ts`, `feed.server.ts`,
`voice.server.ts`, `observability.server.ts`, `analysis/*` (4 Dateien), `llm/*` (4 Dateien),
`toolbox/*` (3 Dateien).

**Über den Analysezugang tatsächlich ausgeführt:**

| Analyseart | Status | Laufzeit |
|---|---|---|
| `memory_recall` | COMPLETED | 884 ms |
| `repair_pipeline_state` | COMPLETED | 15 ms |
| `system_logs` | UNSUPPORTED (dokumentierte Begründung) | 0 ms |
| `request_structure` | UNSUPPORTED (dokumentierte Begründung) | 0 ms |

**Zustand (nur Anzahlen):** Erinnerungsknoten 111, Verbindungen 324, Zustandszeilen 2,
gespeicherte Fragen 25, Gesprächsfäden 120, Vorschläge 1 (davon entschieden 0).
Reparaturstrecke: 3 Fix-Vorschläge (2 wartend auf menschliche Freigabe), 1 Freigabe,
0 Veröffentlichungsfreigaben, 13 Protokolleinträge.

## 4. Technische Befunde

1. Der Zugang ist auffindbar und antwortet; zwei von vier bekannten Analysearten sind
   ausführbar, zwei melden ihre dokumentierte Nichtverfügbarkeit statt einer erfundenen
   Analyse.
2. `memory_recall` liefert eine **bewiesene Ursache** (Befund unten).
3. Die Reparaturstrecke ist funktionsfähig und steht korrekt still: 2 Vorschläge warten
   auf einen Menschen, 0 Veröffentlichungsfreigaben.
4. Ohne Administratorrolle: `FAILED / unauthorized` – keine Analyse, keine Ausnahme.
5. Protokoll- und Request-Struktur (P3/P4) sind weiterhin nicht abfragbar.

## 5. BEWIESEN

- **B1 · Erinnerungsabruf bei Fragewort-Themen (Komponente `src/orb-core/memory.ts`).**
  Belegte Kette: `questionIntentOf()` erkennt keinen der vier Informationsbereiche →
  `topicOf("Wie alt bin ich?")` liefert das Fragewort „wie“ als Thema → die
  Kandidatenabfrage läuft auf `topic="wie"` und trifft nichts → der harte Filter
  `overlap > 0` (gemessen `max(0.000, 0.000) = 0.000`) verwirft den Kandidaten →
  Bewertung, aktive Erinnerungen und Kontextzeile werden nicht erreicht.
  **Der Fehler liegt vor dem Sprachmodell, nicht im Sprachmodell.**
  Belegstelle: `src/orb-core/memory.ts:473`. Reproduzierbar: ja, deterministisch über
  `diagnoseMemoryRecallCase()`. Auswirkung: eine vorhandene, passende Erinnerung
  erscheint nicht im Kontext; die Antwort wirkt „vergesslich“.
- **B2 · Read-only-Nachweis des Zugangs.** Alle Ergebnisse trugen
  `codeChanged=false`, `dbChanged=false`, `proposalCreated=false`,
  `approvalCreated=false`, `deployed=false`, `modelCalls=0`.
- **B3 · Berechtigungsprüfung wirksam.** Ohne Administratorrolle `FAILED/unauthorized`.
- **B4 · Reparaturstrecke bleibt menschlich gesteuert.** 2 wartende Vorschläge,
  0 Veröffentlichungsfreigaben.
- **B5 · Zwei Analysearten sind ohne Datenquelle.** `system_logs` und
  `request_structure` melden `UNSUPPORTED` mit Begründung.

## 6. WAHRSCHEINLICH

- **W1** Die in P7 festgestellte Untererfassung der Datenbankzählung (die Momentaufnahme
  wird nicht mitgezählt, konstanter Abstand 10–11 Operationen) besteht unverändert; sie
  wurde in P11 nicht erneut gemessen, weil dafür keine lesbare Quelle existiert.
- **W2** Der geringe Bestand entschiedener Vorschläge (0 von 1) ist der Grund, warum die
  Diagnosezahlen in der Produktion heute nichts Auffälliges zeigen.
- **W3** Die Verhältnisse 111 Knoten zu 324 Verbindungen und 120 Fäden zu 25 Fragen wirken
  plausibel; ein belastbarer Sollwert existiert nicht, also keine Aussage über „zu viel“
  oder „zu wenig“.

## 7. UNBEKANNT

- **U1** Produktionsfälle mit 40/43 Datenbankabfragen weiterhin nicht eindeutig zuordenbar.
- **U2** 134 historische Modellaufrufe aus P2 bleiben ungeklärt.
- **U3** Ausführungszeit der in P9 eingeführten Zählabfragen in der Produktion.
- **U4** Laufzeitverhalten von Energie, Neugier und autonomen Fragen unter echter Last:
  der Zugang liefert dazu heute keine lesbare Messquelle (nur Protokollzeilen).
- **U5** Ob die Reparaturstrecke unter echter Administratorsitzung dieselben Zahlen
  liefert wie die reine Zählabfrage (in P11 nicht mit echter Sitzung ausgeführt).

## 8. Erkannte Fehler

Genau einer: **B1** – blockierter Erinnerungsabruf bei Fragewort-Themen.
Betroffene Komponente `src/orb-core/memory.ts` (Themenbestimmung und Kandidatenfilter),
Ursache bewiesen, Reproduzierbarkeit deterministisch, Beweislage
`ROOT_CAUSE_PROVEN` mit vollständiger Kette und Codestelle.
Keine Nutzerkennungen, keine Chattexte im Befund.

## 9. Nicht reproduzierbare Fehler

- Die 40/43-Fälle (U1) – **kein reproduzierbarer Fehler festgestellt**.
- Die historischen Modellaufrufe (U2) – **kein reproduzierbarer Fehler festgestellt**.
- Energie/Neugier/autonome Fragen – **kein reproduzierbarer Fehler festgestellt**;
  es fehlt die Messquelle, nicht der Nachweis eines Fehlers.
- Hinweis zur Sauberkeit: Im Testlauf zeigte eine Attrappe einen leeren Zustandswert
  („undefined“) in einer Belegzeile. Prüfung im Code: `repo.server.ts` bildet
  `state: row.status` korrekt ab; die echte Spalte heisst `status`. **Artefakt der
  Attrappe, kein Produktionsfehler.**

## 10. Patch-Vorschlag (NUR BESCHRIEBEN, NICHT ANGEWENDET)

Betrifft ausschliesslich B1.

- **Datei/Funktion:** `src/orb-core/memory.ts` – `topicOf()` (Themenbestimmung) und der
  Kandidatenfilter `overlap > 0`; begleitend `questionIntentOf()` (Informationsbereiche).
- **Problem:** Bei einer Frage ohne bekannten Informationsbereich wird das Fragewort zum
  Thema; die Kandidatensuche trifft nichts und der harte Filter verwirft alles.
- **Ursache:** bewiesen, siehe B1.
- **Vorgeschlagene Änderung:** Fragewörter von der Themenbestimmung ausnehmen
  (Fallback auf „kein Thema“ statt Fragewort) und im Fall „kein Thema“ den harten
  Filter nicht als Ausschluss verwenden, sondern die Bewertung entscheiden lassen.
- **Erwartete Auswirkung:** vorhandene passende Erinnerungen erreichen wieder die
  Bewertung und die Kontextzeile.
- **Risiken:** ein weicherer Filter kann die Kandidatenmenge und damit die Bewertungslast
  erhöhen; unpassende Erinnerungen könnten bei schlechter Bewertung durchrutschen;
  Abruf ist Kernlogik – Nebenwirkungen auf Fäden, Neugier und Antwortstil möglich.
- **Benötigte Tests:** bestehende Abruf- und Erinnerungstests, der deterministische
  Diagnosefall, Gegenprobe „darf keine unpassende Erinnerung aktivieren“,
  Messung der Datenbankoperationen vor/nach (P6/P9-Stand darf sich nicht verschlechtern),
  vollständige Logik- und Datenbank-/Sicherheitstests.
- **Rollback:** einzelne Datei, kein Schema, keine Migration – Rücknahme über die
  bestehende Reparaturstrecke mit unveränderlichem Fingerabdruck und Testumgebung.

**Nicht angewendet.** Kein Schreibvorgang, keine Migration, kein Deployment.
Der Ablauf bleibt: Analyse → Befund → Vorschlag → **menschliche Prüfung** →
separate Freigabe → Testumgebung → separate Veröffentlichungsfreigabe.

## 11. Verwendete DB-Requests

- Rollenprüfung `has_role`: 1 pro Anforderung (5 Anforderungen im Lauf, inkl. der
  Ablehnungsprobe) – gegen die Attrappe.
- `memory_recall`: **0** Datenbankabfragen (reine Codediagnose).
- `repair_pipeline_state`: **1** lesende Abfrage (`orb_dev_fix_proposals`, Grenze 50).
- Zustandsaufnahme: **1** reine Zählabfrage (nur Anzahlen, keine Inhalte).
- **Dauerhafte Wirkung: keine.** Kein INSERT, UPDATE, DELETE; keine Protokollzeile
  geschrieben (der interne Zugang schreibt nicht – nur die Admin-Serverfunktion
  protokolliert, und die wurde nicht benutzt).
- **Normaler Chatpfad: 0 zusätzliche Abfragen.**

## 12. Verwendete Model Calls

**0.** Keine einzige Anfrage an ein Sprachmodell, weder Text, noch Bild, noch Sprache.
Ein Modellaufruf war für keine der ausgeführten Analysen erforderlich.

## 13. Kosten

**0,00 €** an Modellkosten. Rechenzeit: rund 0,9 Sekunden Analyse insgesamt
(884 ms + 15 ms + 2 × 0 ms), plus zwei Zählabfragen. Keine Dauerlast.

## 14. Sicherheitsstatus

- Administratorprüfung vollständig erhalten; ohne Rolle keine Analyse.
- Keine Umgehung von Rechten, keine Tokens, keine Zugangsschlüssel, keine Credentials
  gelesen oder übernommen; keine Sicherheitsprüfung abgeschaltet; kein offener Endpunkt.
- Keine Chattexte, Antworten, Prompts oder personenbezogenen Inhalte in der Diagnose.
- Alle Ergebnisse tragen die unveränderlichen Read-only-Nachweise.
- 102 Datenbank-/Sicherheitstests grün.

## 15. Tests

Nach der Diagnose geprüft: ORB normal funktionsfähig; Chatpfad, Memory, Graph, Neugier,
Energie, autonome Fragen und stille Antworten unverändert (kein ORB-Modul importiert den
Analysezugang – durch Test geprüft); keine dauerhaften zusätzlichen Datenbankzugriffe;
keine automatische Patch-Anwendung.

- Logiktests: **1397 grün** (88 Dateien)
- Datenbank-/Sicherheitstests: **102 grün**
- Typprüfung: fehlerfrei
- Lint: keine Feststellung in `src/orb-core`, `src/orb-dev`, `src/orb-sdk`, `tests`
  (die übrigen Hinweise in `src/components` und `src/lib` bestehen unverändert seit vorher)
- Build: OK

## 16. Änderungen am Produktionscode

**Keine.** In P11 wurde kein Produktionscode, keine Konfiguration, kein Prompt, kein
Modell, keine Schwelle, kein Schema und keine Daten verändert. Das Messwerkzeug war ein
temporäres Skript und ist entfernt. Neu ist ausschliesslich dieser Bericht.

---

**ABSOLUTER STOPP.** Kein Patch, keine Migration, kein Deployment, keine automatische
Reparatur, keine zweite Analyse, keine neue Funktion. Ich warte auf die menschliche
Freigabe für jeden weiteren Schritt – insbesondere für den in Abschnitt 10 beschriebenen
Vorschlag.
