# ORB CORE – P12 ANALYSIS DISCOVERY FORENSICS + FIX

**Datum:** 2026-09-23
**Auftrag:** Discovery-Lücke finden und minimal schliessen. KEINE neue Analysefunktion, KEINE zweite Architektur.
**Ergebnis:** Ursache eindeutig gefunden und behoben. ORB kann die vorhandene Analysefähigkeit jetzt aufzählen, benennen und kontrolliert auflösen.

---

## 1. Ursache der Discovery-Lücke

**BEWIESEN.** Es existiert im gesamten Projekt **keine Tool-/Capability-Registry**, **kein Resolver**, **keine Whitelist interner Fähigkeiten** und **kein Capability-Name**.

Belege (Volltextsuche über `src/orb-core`, `src/orb-sdk`, `src/orb-dev`):

- `capabilit` kommt ausschliesslich in `src/orb-core/toolbox/contract.ts` vor – und dort nur als `ORB_OWNED_CAPABILITIES`, eine reine Verbotsliste („was die Analyse NIE nachbildet"), kein Verzeichnis verfügbarer Fähigkeiten.
- `registry` / `Registry` existiert in ORB nirgends (nur `src/lib/email-templates/registry.ts`, ohne Bezug).
- Die einzige faktische „Fähigkeitsliste" von ORB ist die **Objektform der Rückgabe von `createOrbCore(session)`** in `src/orb-sdk/orb-core.server.ts`. Eine Objektform ist aufrufbar, aber **nicht aufzählbar und nicht benennbar**: es gibt keine ID, keine Beschreibung, keine Liste.

Zuordnung zum Prüfkatalog aus Abschnitt 3 des Auftrags:

| Punkt | Befund |
|---|---|
| A) ORB kennt den Capability-Namen nicht | **BEWIESEN – Hauptursache.** Es gab überhaupt keinen Namen. |
| B) ORB kennt den Adapter nicht | NEIN. `discoverAnalysisAccess()` benennt ihn seit P10 korrekt. |
| C) Adapter nicht in einer Registry registriert | **BEWIESEN – Hauptursache.** Es gab keine Registry, in der er fehlen konnte. |
| D) nur über Admin-Zugang exponiert | Galt vor P10, seit P10 behoben (interner Server-zu-Server-Aufruf). |
| E) Discovery filtert interne Analysefunktionen heraus | NEIN. Es gab keine filternde Discovery. |
| F) Berechtigung vor Discovery falsch geprüft | NEIN. Die Prüfung sitzt korrekt beim Anfordern, nicht beim Erkennen. |
| G) ORB sucht nach falschem Interface | NEIN – ORB suchte nirgends; ein Suchpfad existierte nicht. |
| H) Route vorhanden, aber nicht in der Fähigkeitsliste | **BEWIESEN (Variante von C).** |
| I) direkt aufrufbar, aber nicht als Fähigkeit registriert | **BEWIESEN – exakt der Zustand nach P10.** |
| J) anderer technischer Grund | Nein, keiner nachweisbar. |

**Kernsatz:** Nach P10 war der Zugang **erreichbar, aber nicht auffindbar**. Er war eine Funktion ohne Namen in einem System ohne Verzeichnis.

---

## 2. Tatsächlicher vorhandener Analysepfad (vollständig, nichts geraten)

```
ORB Core / ORB SDK
  → src/orb-sdk/orb-core.server.ts   createOrbCore(session).requestAnalysis(...)
  → src/orb-core/toolbox/access.server.ts   requestOrbAnalysis(db, userId, request)
        · Berechtigung: db.rpc("has_role", { _user_id, _role: "admin" })  ← unverändert
  → src/orb-core/toolbox/adapter.server.ts   runToolboxAnalysis(db, request)
  → bestehende Analysestrecke:
        · src/orb-dev/diagnose.server.ts   (memory_recall)
        · src/orb-dev/repo.server.ts       (repair_pipeline_state)
  → Rückgabe: ToolboxAnalysisResult  (readOnly:true, codeChanged:false, dbChanged:false,
                                      proposalCreated:false, approvalCreated:false,
                                      deployed:false, modelCalls:0)
```

Transport: **interner Server-zu-Server-Aufruf**. Keine Route, kein HTTP-Endpunkt, kein Browser. Die drei administratorgeschützten Serverfunktionen in `src/lib/orb-toolbox.functions.ts` bleiben als Weg der Admin-Oberfläche unberührt und werden von ORB **nicht** benutzt.

---

## 3. Warum ORB ihn bisher nicht gefunden hat

Weil „Finden" technisch nicht vorgesehen war. P10 hat die **Tür** gebaut (`discoverAnalysisAccess`, `requestOrbAnalysis`), aber kein **Türschild** und kein **Schlüsselverzeichnis**: kein Name, unter dem die Fähigkeit nachgefragt werden kann, und keine Liste, in der sie erscheint. Wer den Dateipfad nicht schon kannte, konnte die Fähigkeit nicht entdecken. Deshalb wirkte sie in P11 „nicht vorhanden", obwohl der direkte Aufruf funktionierte.

---

## 4. Vorgenommene minimale Änderung

Genau drei Dateien, nur additiv, keine bestehende Logik verändert:

1. **`src/orb-core/toolbox/contract.ts`** (angefügter Abschnitt) – Fähigkeitenverzeichnis:
   `ORB_ANALYSIS_CAPABILITY_ID = "orb.analysis"`, `OrbCapabilityDescriptor`,
   `ORB_CAPABILITY_REGISTRY` (heute genau ein Eintrag), `listOrbCapabilities()`, `findOrbCapability(id)`.
   Reiner Vertrag: kein DB-Zugriff, kein Dateizugriff, kein Modellaufruf.
2. **`src/orb-core/toolbox/access.server.ts`** – `capabilityId` im vorhandenen Discovery-Ergebnis;
   `listAnalysisCapabilities()` (Aufzählung) und `resolveOrbCapability(id)` (Resolver → vorhandener Zugang, unbekannte ID ⇒ `null`).
3. **`src/orb-sdk/orb-core.server.ts`** – zwei durchreichende Fähigkeiten: `listAnalysisCapabilities()`, `resolveAnalysisCapability(capabilityId)`. Keine eigene Logik.

**Nicht gebaut:** keine neue Analysefunktion, keine zweite Schnittstelle, kein neuer Endpunkt, keine neue Tabelle, keine Migration, keine Änderung an der Admin-Strecke.

---

## 5. Capability-/Adapter-Name

- Capability-ID: **`orb.analysis`** – genau ein Name, kein zweiter parallel. Kein „Toolbox" im Namen.
- Adapter (vorhanden, nur benannt): `src/orb-core/toolbox/adapter.server.ts#runToolboxAnalysis`
- Resolver: `src/orb-core/toolbox/access.server.ts#resolveOrbCapability`

---

## 6. Sicherheitsprüfung

- Die bestehende Administratorprüfung (`has_role`, RLS-gebundener Client) ist **unverändert** und sitzt weiterhin vor jeder Analyse.
- Aufzählen und Auflösen sind bewusst **rechtefrei und wirkungsfrei**: sie lesen nichts, berühren keine Datenbank und geben nur statische Beschreibungen zurück. Das Recht entsteht erst beim Anfordern – dort greift die unveränderte Prüfung (Test: `unauthorized`).
- Kein Adminschutz entfernt, kein offener Endpunkt, keine Credentials in ORB, keine Secrets, keine Chattexte, keine personenbezogenen Daten.
- Read-only-Riegel unverändert: `code_write`, `db_write`, `migration`, `deployment`, `approval`, `config_write`, `secret_access` bleiben alle abgeschaltet.

---

## 7. Discovery-Test (Abschnitt 9 des Auftrags)

Frage: „Welche Analysefähigkeiten stehen ORB zur Verfügung?"
Antwort des Verzeichnisses:

```
1 Fähigkeit
  capabilityId : orb.analysis
  transport    : internal_server_call
  adapter      : src/orb-core/toolbox/adapter.server.ts#runToolboxAnalysis
  readOnly     : true
  admin        : erforderlich
  Analysearten : memory_recall, repair_pipeline_state (ausführbar)
                 system_logs, request_structure (bekannt, nicht unterstützt)
  Änderung     : nur nach menschlicher Freigabe
```

**Keine Selbstdiagnose ausgeführt.** Keine tiefe Systemanalyse, kein Patch, keine zweite Analyse.

---

## 8. Regressionstests

| Prüfung | Ergebnis |
|---|---|
| Neue Discovery-Tests (5) + P10-Tests (8) | 13 grün |
| Logic Tests | grün |
| DB/Security Tests | grün |
| Typecheck (`tsgo --noEmit`) | fehlerfrei |
| Lint (`src/orb-core`, `src/orb-dev`, `src/orb-sdk`, `tests`) | sauber |
| Build | OK |

Abgedeckt sind alle 11 geforderten Fälle: Start, Discovery, Fähigkeit gefunden, ID eindeutig, Read-only-Zugang auflösbar, Administratorprüfung aktiv, unautorisierter Zugriff abgelehnt, Ausfall ⇒ ORB läuft weiter, kein normaler Chatpfad ruft die Analyse auf, 0 zusätzliche Modellaufrufe, 0 zusätzliche DB-Requests im normalen Pfad (Importprüfung gegen `engine.server.ts` und `memory.ts`).

---

## 9. AI-/DB-Auswirkungen

- **Modellaufrufe: 0.** Kosten: 0,00 €.
- **DB-Requests im normalen Verarbeitungspfad: unverändert 0 zusätzlich.** Der P9-Stand bleibt exakt erhalten.
- Aufzählen/Auflösen: **0 DB-Abfragen** (statische Beschreibung).
- Anfordern einer Analyse: unverändert 1 × `has_role` + die vorhandenen lesenden Abfragen der jeweiligen Analyseart.

---

## 10. Unveränderte Bereiche

`engine.server.ts`, `memory.ts`, Graph, Curiosity, Energy, Impulse, autonome Fragen, Silent Responses, Sprachschicht, Prompts, Modelle, Schwellen, `adapter.server.ts`, `diagnose.server.ts`, `repo.server.ts`, die Admin-Serverfunktionen, alle Tabellen, Schema und Daten. Der P11-Patch-Vorschlag zu `src/orb-core/memory.ts` wurde **nicht** angewendet.

---

## 11. Human Loop (unverändert zwingend)

```
ORB → Analyse → Befund → optionaler Patch-Vorschlag
    → menschliche Freigabe → Testumgebung → separate Veröffentlichungsfreigabe
```

Niemals: Analyse → Patch → automatische Anwendung.

---

## 12. STOPP

P12 endet hier. ORB kann sagen: **„Ich sehe die vorhandene Analysefähigkeit `orb.analysis` und kann sie kontrolliert ansprechen."**

Keine Selbstdiagnose, kein Patch, keine automatische Reparatur, kein Deployment, keine Migration, keine weitere Analyse. Warten auf menschliche Freigabe.
