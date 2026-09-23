# ORB CORE – Architektur-Selbstanalyse (P11-Regel angewendet)

Einmaliger, kontrollierter, rein lesender Lauf. **Kein Produktionscode verändert.**

## 1. Zeitpunkt
2026-09-23, 12:11 UTC. Einmalig, keine Schleife, kein Zeitplan, keine Wiederholung.

## 2. Verwendeter Zugang
Ausschliesslich der in P10/P12 hergestellte interne Zugang:
`orb.analysis` → `src/orb-core/toolbox/access.server.ts#resolveOrbCapability`
→ `src/orb-core/toolbox/adapter.server.ts#runToolboxAnalysis`.
Transport: interner Server-zu-Server-Aufruf. Keine Oberfläche, kein HTTP-Endpunkt.
Attrappe für den Datenzugang, damit keine echten Daten gelesen werden.

## 3. Discovery-Ergebnis
Genau **eine** Fähigkeit im Verzeichnis (`orb.analysis`) – keine zweite Architektur.
Analysearten: `memory_recall`, `repair_pipeline_state`, `system_logs`, `request_structure`.
Unterstützt: die ersten zwei. Erforderlich: Administratorrolle. Rein lesend.
Jede Änderung braucht menschliche Freigabe (`requiresHumanApprovalForAnyChange: true`).

## 4. BEWIESEN
- **B1 – Erkannter Fehler:** Bei Fragen ohne erkennbaren Informationsbereich wird das
  Fragewort in `topicOf()` zum Ersatzthema; mit dem harten Filter `overlap > 0`
  (gemessen 0.000) wird die passende Erinnerung bereits in der Kandidatensuche
  verworfen. Kette: `RECALL: BLOCKED` → `CANDIDATE_SEARCH: BLOCKED` → `FILTER: BLOCKED`
  → Bewertung, aktive Erinnerungen und Kontextzeile `NOT_REACHED`.
  Betroffene Komponente: `src/orb-core/memory.ts:473` (Ranking/Auswahl in
  `src/orb-core/recall.ts`). Beweislage `ROOT_CAUSE_PROVEN`, deterministisch
  reproduzierbar über `diagnoseMemoryRecallCase()`. Der Fehler liegt **vor** dem
  Sprachmodell, nicht im Sprachmodell.
- **B2 – Read-only bewiesen:** alle Ergebnisse `codeChanged=false`, `dbChanged=false`,
  `proposalCreated=false`, `approvalCreated=false`, `deployed=false`, `modelCalls=0`.
- **B3 – Schutz aktiv:** ohne Administratorrolle `FAILED / ANALYSIS_ACCESS_DENIED`.
- **B4 – Kein erfundener Befund:** zwei Analysearten ohne Datenquelle melden
  `UNSUPPORTED` mit Begründung statt einer erfundenen Analyse.
- **B5 – Genau ein Name:** das Verzeichnis enthält eine einzige Fähigkeitskennung.

## 5. WAHRSCHEINLICH
- Die Untererfassung der DB-Zählung aus P7 (Momentaufnahme nicht gezählt, konstanter
  Abstand 10–11 Operationen) besteht unverändert; in diesem Lauf nicht neu gemessen.
- `system_logs` und `request_structure` bleiben so lange nicht analysierbar, wie die
  Protokollzeilen aus P3/P4 nur Laufzeitausgabe und keine lesbare Ablage sind.

## 6. UNBEKANNT
- Produktionsfälle mit 40/43 DB-Abfragen weiterhin nicht eindeutig zuordenbar.
- 134 historische Modellaufrufe aus P2 ungeklärt.
- Laufzeitverhalten von Energy, Neugier und autonomen Fragen unter echter Last –
  keine lesbare Messquelle.
- Zahlen der Reparaturstrecke unter echter Administratorsitzung (hier Attrappe: 0).

## 7. Patch-Vorschlag – NICHT ANGEWENDET
- **Datei/Funktion:** `src/orb-core/memory.ts` (`topicOf`), Filterstelle in
  `src/orb-core/recall.ts`.
- **Problem:** Fragewort wird Thema; harter Filter verwirft die passende Erinnerung.
- **Ursache:** bewiesen, siehe B1.
- **Vorgeschlagene Änderung:** Fragewörter von der Themenbestimmung ausnehmen
  („kein Thema“ statt Fragewort) und im Fall „kein Thema“ den Filter nicht als
  Ausschluss verwenden, sondern die Bewertung entscheiden lassen.
- **Erwartete Wirkung:** Altersfrage findet die gespeicherte Erinnerung; bestehende
  Fälle bleiben unverändert.
- **Risiken:** grössere Kandidatenmenge und höhere Bewertungslast; unpassende
  Erinnerungen könnten durchrutschen; Abruf ist Kernlogik mit Nebenwirkungen auf
  Fäden, Neugier und Antwortstil.
- **Benötigte Tests:** vorhandene Abruf-/Erinnerungstests, der deterministische
  Diagnosefall, Gegenprobe „keine unpassende Erinnerung aktiv“, Messung der
  DB-Operationen vor/nach (P6/P9-Stand darf sich nicht verschlechtern), volle
  Logik- und DB-/Sicherheitstests.
- **Rollback:** zwei Dateien, kein Schema, keine Migration – Rücknahme über die
  vorhandene Reparaturstrecke mit unveränderlichem Fingerabdruck und Testumgebung.
- **Status:** nur beschrieben. Nicht angewendet, nicht freigegeben, nicht veröffentlicht.

## 8. DB-Requests, Model Calls, Kosten
Rollenprüfung `has_role`: 1 pro Anforderung (5 inkl. Ablehnungsprobe, gegen Attrappe).
`memory_recall`: 0 DB-Abfragen. `repair_pipeline_state`: 1 lesende Abfrage (Grenze 50).
Normaler Chatpfad: 0 zusätzliche Abfragen. **Model Calls: 0. Kosten: 0,00 €.**
Laufzeit: 782 ms / 4 ms / 0 ms / 0 ms.

## 9. Sicherheitsstatus
Administratorprüfung vollständig erhalten; keine Umgehung von Rechten, keine Tokens,
keine Schlüssel, keine Chattexte, keine personenbezogenen Inhalte im Befund.

## 10. Änderungen am Produktionscode
**Keine.** Kein Code, keine Konfiguration, kein Prompt, kein Modell, keine Schwelle,
kein Schema, keine Daten. Das Messskript war temporär und ist entfernt.
Neu ist ausschliesslich dieser Bericht.

## 11. Human-in-the-Loop
ANALYSE → BEFUND → VORSCHLAG → MENSCHLICHE FREIGABE → Testumgebung → separate
Veröffentlichungsfreigabe. **ABSOLUTER STOPP** nach diesem Bericht.
