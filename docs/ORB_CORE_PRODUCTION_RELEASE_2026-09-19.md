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
