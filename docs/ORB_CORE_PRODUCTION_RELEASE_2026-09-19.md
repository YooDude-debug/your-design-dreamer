# ORB Core – Production Release 2026-09-19

Status: **ANGEHALTEN VOR DEM RELEASE** (Pre-Release-Check, read-only)

PRODUCTION CHANGED: NO (noch nichts übertragen)

---

## 1. Quellen

- Production BEFORE Release: aktueller veröffentlichter Stand mit ORB SDK,
  Conversation-Context-Fix und Spiderweb-UI (Sicherung
  `.lovable/backup/pre_orb_spiderweb_2026-09-19/`).
- Staging RELEASE SOURCE: Abzug `dd60235c`
  (`/tmp/cross-project/y-dude-staging-4a5bd367098d4501b2069e1696fcc09c`).

## 2. Ergebnis des Pre-Release-Checks (nur gelesen)

Bereits in Production enthalten (keine Übertragung nötig):

- ORB SDK / Core-Trennung, Y-Dude-Adapter
- Conversation-Context-Fix (letzte 8 Gesprächszeilen)
- Memory-Reinforcement-Verhalten (unverändert, Schwelle 0.35)
- Spiderweb-Memory-UI

Noch nicht in Production (Teil des gewünschten Releases):

- `src/orb-core/recall.ts` (Frageabsicht/Themennähe – Memory-Recall-Fix)
- `src/orb-core/memory.ts`: Ergänzung eindeutiger Hardwarebegriffe
  (rtx, gtx, geforce, radeon, nvidia, vram, ryzen, grafikchip)
- `src/orb-core/llm/` (Sprachschicht: Prompt, Provider, OpenAI, Auswahl)
- `src/components/orb/OrbRealFace.tsx`, `OrbVoice.tsx`,
  `src/integrations/y-dude-orb/avatar.ts` (Avatar-Animation)
- Tests: `orb-memory-recall-fix`, `orb-llm-provider`, `orb-avatar-motion`

## 3. Abweichung, die den 1:1-Stand gefährdet (Grund für den Stopp)

Der Staging-Stand enthält zusätzlich eine **Bildanhang-Funktion im ORB-Chat**
(`src/lib/orb-attachments.ts`, `src/components/orb/OrbComposerAttachments.tsx`,
`tests/orb-multimodal-composer.test.ts`). Sie steht nicht in der Freigabeliste,
ist aber fest mit den freigegebenen Teilen verbunden:
`engine.server.ts`, `orb-sdk/orb-core.server.ts`,
`integrations/y-dude-orb/orb.functions.ts`, `components/orb/OrbChat.tsx` und
`orb-core/llm/openai.server.ts` tragen sie mit.

Folge: Entweder wird die Funktion mit veröffentlicht (nicht freigegeben) oder
der getestete Code müsste während des Releases umgebaut werden (verboten).
Deshalb wurde nichts übertragen und keine Veröffentlichung ausgelöst.

## 4. OpenAI-Status in Production

`OPENAI_API_KEY` ist in Production **nicht** hinterlegt. Die Sprachschicht
läuft damit vollständig über den bestehenden Fallback (bisheriges Verhalten).
Staging-Secrets werden nicht übernommen.

## 5. Datenbank

DATABASE CHANGED: NO · RLS CHANGED: NO · NEW TABLES: NO
MEMORY FORMULAS CHANGED: NO · MEMORY THRESHOLD CHANGED: NO
OPENAI KEY EXPOSED: NO · NEW FEATURES: NO

## 6. Nächster Schritt

Entscheidung des Auftraggebers erforderlich (siehe Abschnitt 3), erst danach
Backup, Übertragung, Tests und Smoke-Test.

---

## Nachtrag: Release erneut angehalten – Production-Secret nicht erreichbar (19.09.2026)

Auftrag: Fortsetzung des freigegebenen Release unter der Annahme, dass der
OpenAI-Zugang bereits als read-only Production-Secret hinterlegt ist.

Prüfung des Production-Secret-Bestands (nur Namen, keine Werte): 15 Einträge,
darunter Turnstile, Payments, Stripe, VAPID, Push/Moderation-Token,
LOVABLE_API_KEY. **Kein Eintrag mit einem OpenAI-Zugang** (weder
`OPENAI_API_KEY` noch ein anders benannter OpenAI-Eintrag).

Damit ist die Vorbedingung des Auftrags nicht erfüllt. Gemäss Weisung wurde
angehalten: kein neuer Schlüssel erzeugt, kein bestehender Schlüssel geändert,
angezeigt, protokolliert oder in Code geschrieben. Es wurde nichts übertragen,
nichts gesichert, nichts veröffentlicht.

PRODUCTION CHANGED: NO · DATABASE CHANGED: NO · RLS CHANGED: NO ·
MEMORY FORMULAS CHANGED: NO · MEMORY THRESHOLD CHANGED: NO ·
OPENAI KEY EXPOSED: NO · NEW TABLES: NO · NEW FEATURES: NO

Nächster Schritt: Der Zugang muss im Production-Secret-Bestand hinterlegt
werden (oder der abweichende Secret-Name genannt werden). Danach Fortsetzung mit
Sicherung, Übertragung, Tests und Smoke-Test.

---

## ORB Core – Production Transfer 2026-09-19 (LLM, Multimodal, Recall, Avatar)

**Status:** Übertragung in Production abgeschlossen, Veröffentlichung ANGEHALTEN (siehe OpenAI-Status).

### Quellen
- **Production BEFORE:** Commit `df82958a608fb32ec62b87eb1c4c27822659bbb8`
- **Staging RELEASE SOURCE:** Abzug `dd60235c` (Projekt-ID 4a5bd367-098d-4501-b206-9e1696fcc09c)
- **Production AFTER:** Arbeitsstand = Production BEFORE + unten gelistete Dateien (nicht veröffentlicht)
- **Backup / Rollback:** `.lovable/backup/pre_orb_llm_multimodal_2026-09-19/` (inkl. `ROLLBACK.txt`), zusätzlich `.lovable/backup/pre_orb_spiderweb_2026-09-19/`

### Übertragene Änderungen (ausschliesslich getesteter Staging-Stand)
- Memory Recall Fix: `src/orb-core/recall.ts` (neu), `src/orb-core/memory.ts` (nur Ergänzung eindeutiger Hardwarebegriffe: rtx, gtx, geforc, radeon, nvidia, vram, ryzen, grafikchip)
- OpenAI LLM Integration: `src/orb-core/llm/{prompt,provider,openai,select}.server.ts` (neu), `src/orb-core/engine.server.ts` (Sprachschicht ausgelagert)
- Multimodal / Bildanhänge / Kamera-Input: `src/lib/orb-attachments.ts`, `src/components/orb/OrbComposerAttachments.tsx`, `src/components/orb/OrbChat.tsx`, `src/orb-sdk/orb-core.server.ts`, `src/integrations/y-dude-orb/orb.functions.ts`
- Avatar-Animation: `src/components/orb/OrbRealFace.tsx`, `src/components/orb/OrbVoice.tsx`, `src/integrations/y-dude-orb/avatar.ts`
- UI-Hinweis kompakt: `src/components/orb/OrbExperimentNotice.tsx` + `src/components/ui/popover.tsx` + Abhängigkeit `@radix-ui/react-popover@1.1.23` (in Production zuvor nicht vorhanden, nötig für den getesteten Stand)
- Route: `src/routes/_authenticated/channels.orb.tsx` (Diagnoseanzeige der Sprachschicht, Bildanhang-Übergabe)
- Tests (neu, unverändert übernommen): `tests/orb-memory-recall-fix.test.ts`, `tests/orb-llm-provider.test.ts`, `tests/orb-avatar-motion.test.ts`, `tests/orb-multimodal-composer.test.ts`
- Bewusst NICHT zurückgesetzt (Production ist strenger/aktueller): `tests/integration/db-orb-security.test.ts`, `src/components/orb/OrbDevPanel.tsx`, `src/orb-core/core.ts` (Formatierung), `src/orb-core/continuity-store.server.ts`
- Wortlaut: „nur Staging“ / „Staging-Experiment“ → „experimenteller Bereich“ / „Experiment“ (nur Kommentare und ein UI-Label)

### Datenbank
Keine Migration ausgeführt, keine Tabelle, kein Schema, keine Policy, kein Index geändert. `supabase/migrations` unverändert.

### OpenAI Status
- Production-Secret `OPENAI_API_KEY` vorhanden, ausschliesslich serverseitig gelesen (`src/orb-core/llm/openai.server.ts`), nie im Client-Bundle (geprüft: kein Schlüsselmuster, kein `api.openai.com`, kein `SERVICE_ROLE` in `dist/client`).
- **Echter Production-Aufruf schlägt fehl:** HTTP 429 `insufficient_quota` / `credit_balance_exhausted` – das OpenAI-Konto hat kein Guthaben. Kein Code-Fehler.
- Folge: Die Provider-Auswahl fällt wie vorgesehen auf die bestehende Sprachschicht zurück; Bildanhänge werden dann ausdrücklich als nicht ausgewertet gemeldet („meine Bildschicht ist momentan nicht verfügbar“) – keine erfundene Bildanalyse.
- Bildanalyse über OpenAI ist deshalb derzeit NICHT verifizierbar.

### Tests
- Typecheck: 0 Fehler
- Lint (ORB-Bereich): 0 Fehler (eine reine Prettier-Leerzeile korrigiert)
- Unit-/Logiktests: 61 Dateien, 916 Tests grün (bestehende Tests unverändert)
- DB-/Security-Tests: 9 Dateien, 77 Tests grün (RLS aktiv, anon ohne Rechte, Regeln an `auth.uid()` gebunden)
- Build: erfolgreich

### Smoke Tests (Preview, authentifiziert)
- ORB Start, Chat, Avatarwahl: OK, keine Konsolenfehler
- Memory Recall „Was mache ich beruflich?“ → „beruflich Koch“ – OK
- Memory Recall „Welche Grafikkarte habe ich?“ → ORB nennt kein Modell, weil in den Production-Daten kein GPU-Modell gespeichert ist (Production-Datenbestand, nicht identisch mit Staging); es wird nichts erfunden
- Unbekannte Information „Welche Schuhgröße habe ich?“ → ehrliche Antwort, keine Erfindung – OK
- Fallback-Sprachschicht: aktiv und funktionsfähig – OK
- Multimodal: Bildanhang wird übergeben, Bildanalyse wegen fehlendem OpenAI-Guthaben nicht auswertbar; ehrlicher Hinweis statt Behauptung; keine Memory-Erstellung durch ein Bild
- Spiderweb: 24 Knoten, 21 Verbindungen, Auswahl und Detailansicht OK
- Desktop (1280) und Mobil (390) OK

### Security
- RLS auf allen ORB-Tabellen aktiv, Regeln nur für angemeldete Benutzer und an `auth.uid()` gebunden (77 Tests)
- Keine anonymen Rechte, keine Cross-User-Memory
- ORB Core bleibt intern: kein Import von `@/orb-core` ausserhalb von `src/orb-core` und `src/orb-sdk`
- Keine Secrets, keine OpenAI-Credentials, keine Service-Role im Client-Bundle

### Ergebnis
PRODUCTION CHANGED: YES (Arbeitsstand übertragen, noch nicht veröffentlicht)
DATABASE CHANGED: NO
RLS CHANGED: NO
MEMORY FORMULAS CHANGED: NO
MEMORY THRESHOLD CHANGED: NO (0.35)
NEW TABLES: NO
NEW FEATURES: NO (nur getesteter Staging-Stand)
OPENAI KEY EXPOSED: NO

**Veröffentlichung angehalten:** Ein echter OpenAI-Aufruf ist wegen fehlendem Guthaben nicht möglich, die Bildanalyse ist damit nicht verifiziert. Entscheidung des Auftraggebers erforderlich.
