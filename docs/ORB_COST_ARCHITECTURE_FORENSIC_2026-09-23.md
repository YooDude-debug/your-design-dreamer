# ORB Kosten- und Architekturforensik (READ-ONLY) – 2026-09-23

Nichts geändert, kein Patch, kein Deployment, keine Modellaufrufe.

## Belege
- Workspace-Abrechnung 01.–23.09.2026 (nach Posten): **3048,08 Credits** verbraucht.
- AI-Gateway-Log der letzten 7 Tage: **972 Anfragen**; Stichprobe der neuesten 100: 98× `openai/gpt-6-astra` (responses), 2× TTS. Einzelkosten 0,07–0,26 Credits, Eingabe 1.100–9.800 Tokens, Ausgabe 70–350 Tokens.

## Verbrauch nach Bereich (September)

| Bereich | Credits | Anteil |
|---|---:|---:|
| **Build-Modus-Nachrichten (Entwicklung mit dem Agenten)** | 2820,08 | **92,5 %** |
| Project Monitoring | 75,70 | 2,5 % |
| Cloud Compute (micro 73,27 + pico 26,75) | 100,02 | 3,3 % |
| AI Gateway gesamt (alle Modelle, ganze App) | ~41,4 | 1,4 % |
| davon `gpt-6-astra` (ORB-Chat) | ~38,7 | 1,3 % |
| davon Moderation/Übersetzung/TTS (gemini-3.6/3.7-flash, gpt-5.4-mini, tts) | ~2,7 | 0,1 % |
| Worker Days + Requests | 8,19 | 0,3 % |
| Egress (inkl. cached) | 3,44 | 0,1 % |
| Realtime / Datenbank separat | nicht als Posten ausgewiesen (in Compute enthalten) | – |

**Kernbefund:** Nicht ORB zur Laufzeit verbraucht die Credits, sondern die Entwicklungsarbeit (P0–P25 Forensik-/Patchrunden im Build-Modus). ORBs gesamte KI-Nutzung im Monat liegt bei rund 1/70 davon.

## Pro Bereich

### 1. AI / Model Calls (ORB-Chat)
1. Ursache: jede ORB-Antwort = 1 Responses-Aufruf `gpt-6-astra` mit Reasoning (`effort: low`) und großem System-Prompt (Zustand, Erinnerungen, Interessen, Threads, Gesprächskontext).
2. `src/orb-core/llm/provider.server.ts:18` (Modell), `:93–95` (stream + reasoning), `src/orb-core/llm/prompt.server.ts:60–95` (Prompt-Aufbau), `src/orb-core/engine.server.ts:625/632` (Aufruf).
3. ~1,3 % des Gesamtverbrauchs; Eingabetokens (21,96) > Ausgabe (9,61) > Cache-Writes (6,92) → der Prompt ist der Kostentreiber, nicht die Antwort.
4. Günstiger: Prompt kürzen (Kontext/Threads/Phrasings deckeln), stabilen Präfix vorne halten für Cache-Treffer (aktuell nur 0,24 Credits Cache-Reads bei 6,92 Cache-Writes → Cache wird kaum wiederverwendet). Modellwechsel ist durch die Projektregel (`openai/gpt-6-astra` literal) ausgeschlossen, nur mit Ihrer ausdrücklichen Freigabe.
5. Kostenlos: deterministische Antworten ohne Modell für Trivialfälle (Gruß, „Ja/Nein“, reine Erinnerungsabfrage mit eindeutigem Treffer) – ORB ist bereits deterministisch aufgebaut, nur die Sprachformulierung braucht das Modell.
6. Lokales Modell: technisch nicht im Hosting möglich (Worker-Runtime, keine GPU/Binaries). Nur über einen eigenen externen Server (z. B. Ollama auf eigenem Rechner/VPS) – dann Betriebskosten, Verfügbarkeit und Datenschutz selbst tragen.
7. Umgehung Lovable: teilweise, durch direkten Anbieter-Schlüssel (siehe Vergleich). Einsparpotenzial absolut maximal ~39 Credits/Monat.

### 2. Tool-Calling / zusätzliche Modellrunden
1. `/codeanalyse` erzeugt ≥2 Modellrunden (Tool-Anfrage + Folgeaufruf), bis zu 4.
2. `src/orb-core/llm/code-tool.server.ts` (Schleife), `provider.server.ts:176–223`.
3. < 0,1 % (nur explizite Admin-Aufrufe).
4. Günstiger: Tool-Schleife auf 1 Runde begrenzen oder Analyse direkt ohne Modell ausgeben (Ergebnis ist bereits deterministisch).
5. Kostenlos: ja – `orb.code_analysis` liefert strukturierte Befunde ohne Modell; der Modellaufruf formuliert nur.
6./7. Nicht nötig.

### 3. Zweiter Direktpfad OpenAI
- `src/orb-core/llm/openai.server.ts:25–28,107` und `src/orb-core/analysis/analyze.server.ts:20,133`: direkter OpenAI-Aufruf (`gpt-4o-mini`), nur wenn `OPENAI_API_KEY` gesetzt. Kosten erscheinen dann **nicht** in Lovable-Credits, sondern auf der OpenAI-Rechnung. Enthält weiterhin `max_tokens` (bekannter, unveränderter Altbefund).

### 4. Database
1. Lese-/Schreibzugriffe pro ORB-Ereignis (P6: 133 Operationen für eine Erinnerung).
2. `src/orb-core/engine.server.ts`, `src/orb-core/recall.ts`.
3. Nicht separat abgerechnet; Teil von Compute (~3,3 %).
4. Günstiger: weitere Bündelung der Snapshot-Lesezugriffe (P7/P8 offen).
5. Kostenlos: keine realistische Alternative; Datenbank sollte bleiben.
6./7. Nein.

### 5. Compute
1. Dauerbetrieb der Backend-Instanz (micro + pico) – Grundlast, nicht ORB-spezifisch.
3. ~3,3 %.
4. Günstiger: Instanzgröße prüfen (micro seit Monatsmitte zusätzlich zu pico); eine kleinere Instanz spart ggf. ~70 Credits/Monat, falls Last es erlaubt (Kennzahlen: `src/lib/runtime-metrics.server.ts`).
5./6./7. Nein.

### 6. Network / Egress
- 3,44 Credits (0,1 %). Unerheblich.

### 7. Realtime
- `src/lib/social.tsx:640,664,696,846` – Presence/Chat-Kanäle der Social-App, nicht ORB. Kein eigener Kostenposten sichtbar.

### 8. Hintergrundprozesse / Polling (Client)
- `src/routes/_authenticated/feed.tsx:236` Live-Feed alle **10 s** (`src/lib/live-feed.ts:40`), `src/lib/push-active-chat.ts:18` Heartbeat alle **15 s**, `src/lib/use-last-seen-heartbeat.ts:11` alle 120 s, Admin-Seiten 20 s/60 s.
- Diese erzeugen Worker-Requests (0,82 Credits) und Compute-Last – gering. Günstiger: Feed-Intervall auf 30–60 s oder nur bei sichtbarem Tab.
- ORB selbst hat keinen Server-Hintergrundprozess (keine Cron-Aufrufe des Modells gefunden); Neugier ist ereignisbasiert.

### 9. Doppelte Aufrufe / Server-Hops
- P0–P6 bereits behoben. Offen: `translatePostsBatch` (`src/lib/translate.functions.ts:95`) ruft pro ID einzeln auf (Cache vorher – nur Fehlmengen kosten).
- ORB: Browser → Server-Funktion → Gateway = 1 Hop, minimal.

### 10. Project Monitoring
- 75,70 Credits (2,5 %) – mehr als ORBs gesamte KI. Abschaltbar in den Projekteinstellungen, falls nicht benötigt.

## Anbietervergleich (nur für den ORB-Chat-Anteil ~39 Credits/Monat)

| Option | Kosten | Aufwand/Risiko |
|---|---|---|
| Lovable AI Gateway (heute) | ~39 Credits/Monat | kein Schlüssel, Logging integriert |
| Direkte Gemini API | Free-Tier vorhanden (Limits pro Minute/Tag; Daten dürfen im Free-Tier zum Training genutzt werden) | eigener Schlüssel, Modellwechsel verletzt aktuelle Regel |
| OpenRouter | einige `:free`-Modelle mit strengen Limits; sonst Anbieterpreis + Aufschlag | eigener Schlüssel, schwankende Verfügbarkeit |
| Lokales LLM (Ollama o. ä.) | 0 € Token, aber eigener Server/Strom | nicht im Hosting lauffähig; Qualität deutlich unter gpt-6-astra für Deutsch |
| Direkter OpenAI-Schlüssel (bereits vorhanden) | eigene OpenAI-Rechnung statt Credits | Pfad existiert schon (`openai.server.ts`) |

## Antworten

**Was kostet ORB heute?** Zur Laufzeit ca. **39 Credits im September** (~1,3 %), etwa 0,07–0,26 Credits pro Antwort. Der eigentliche Verbrauch (**2820 Credits, 92,5 %**) entsteht durch die Entwicklungsrunden mit dem Agenten, nicht durch ORB.

**Was könnte kostenlos laufen?** Trivialantworten und reine Erinnerungsabfragen deterministisch ohne Modell; Codeanalyse-Ausgabe ohne zweite Modellrunde; Project Monitoring abschalten (−75 Credits).

**Was könnte deutlich günstiger laufen?** Kürzerer, cache-freundlicher System-Prompt (Eingabetokens sind der größte KI-Posten); weniger häufiges Feed-Polling; ggf. kleinere Backend-Instanz. Größter Hebel überhaupt: weniger und größere Build-Aufträge statt vieler kleiner Forensik-Runden.

**Was sollte extern bleiben?** Das Sprachmodell (lokal im Hosting nicht möglich), Datenbank/Auth, Speech-to-Text/TTS, Moderation.

Unbekannt: exakte Kosten je ORB-Ereignis vs. andere Gateway-Nutzer der App (Log ist nicht nach Funktion getaggt); Kosten eines evtl. gesetzten direkten OpenAI-Schlüssels (außerhalb Lovable).

STOPP.
