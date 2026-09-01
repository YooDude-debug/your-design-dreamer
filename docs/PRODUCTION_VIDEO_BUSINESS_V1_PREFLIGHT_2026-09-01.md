# Y-Dude Production – Video V1 + Business V1: Preflight

Paket: `production-video-business-v1-2026-09-01`
Paketbasis: `cdf7634`
Durchführung: 2026-09-01
Ergebnis: **🟠 BLOCKIERT in Phase 3 (Production Baseline)** – keine Änderung an
Production, keine Migration, kein Rollback nötig.

## Phase 1 – Preflight

Production-Stand geprüft: Business Campaigns V1 vorhanden (`ad_campaigns`,
`business_campaign_limit()`, `enforce_business_campaign_limit()`,
`business_plan_tier()`), Creator Subscription V1 vorhanden, `public.user_roles`
vorhanden. Zusätzlich sind seit der Paketbasis mehrere freigegebene
Production-Releases eingespielt (Long-Post-Fix, Rollentrennung, iPhone-Responsive,
Business-Runtime-Fix).

## Phase 2 – Package Integrity

`sha256sum -c PACKAGE_FILES.sha256` → **57/57 OK**.

## Phase 3 – Production Baseline: Abweichung

Vergleich Production gegen `rollback-production-original/` (17 Dateien):

| Ergebnis | Dateien |
| --- | --- |
| identisch | 7 |
| abweichend | 10 |

Abweichende Dateien (geänderte Zeilen): `auth.tsx` (194),
`integrations/supabase/types.ts` (102), `lib/data.tsx` (65),
`CreatorSlangTagsDialog.tsx` (42), `ProfilePanel.tsx` (22),
`post-moderation.functions.ts` (16), `creator.tsx` (13),
`business-campaigns.shared.ts` (4), `CreatePostDialog.tsx` (2),
`SlangTagCanvas.tsx` (1).

### Ursache

Das Paket wurde auf `cdf7634` gebaut. Production ist inzwischen weiter. Die
Zieldateien des Pakets enthalten die bereits freigegebenen Production-Fixes
**nicht** und würden sie beim pfadgleichen Übernehmen entfernen:

1. **Long-Post-Fix (2026-08-31).** Production: `titleField` mit
   `.transform((v) => v.slice(0, 300))` in `post-moderation.functions.ts` und
   Titelkürzung in `CreatePostDialog.tsx`. Im Zielstand nicht vorhanden
   (`z.string().max(300)`), lange Beiträge ohne SlangTag würden wieder abgelehnt.
2. **Rollentrennung (`src/lib/role-scope.ts`).** Production nutzt `roleAreaLabel`
   / `roleSlangTagLabel` in `creator.tsx`, `CreatorSlangTagsDialog.tsx` und
   `profile.$username.tsx`. Das Paket führt stattdessen ein neues
   `src/lib/role-visibility.ts` ein und referenziert `role-scope` nicht.
3. **iPhone-/Mobile-Responsive-Fix (2026-08-31).** Production:
   `min-w-0` / `truncate` in `ProfilePanel.tsx`; Zielstand enthält den älteren
   `shrink-0`-Stand.
4. **Registrierungs-UX (2026-08-30).** Production: `signupEntryCopy` mit
   primärem/sekundärem Einstieg; Zielstand ersetzt dies durch `accountTypeCopy`
   plus `activateBusinessRole`.
5. **Generierte Typen** `src/integrations/supabase/types.ts` weichen um 102
   Zeilen ab (Production-Stand nach Creator/Business-Migrationen).

### Nicht betroffen

Die beiden zuletzt behobenen Production-Fehler liegen außerhalb des Paket-Scopes
und bleiben unberührt: `src/lib/ad-plan.server.ts` (Environment-Erkennung über
`getRequest()`) und `src/lib/business-campaigns.server.ts` (privilegierter
`business_plan_tier`-Pfad) sind im Paket nicht enthalten.

## Phase 4–11

Nicht ausgeführt. Diff-Gate, Backup, Migrationen (`01_media_video_assets.sql`,
`02_posts_video_kind.sql`, `03_media_video_assets_revoke_anon.sql`),
Source-Übernahme, Verify und Smoke-Tests wurden gemäß Stopp-Regel nicht
begonnen. Production ist unverändert.

## Erwarteter vs. tatsächlicher Zustand

- Erwartet (Paket): Production == `cdf7634` für die 17 gelisteten Dateien.
- Tatsächlich: 10 der 17 Dateien tragen neuere, freigegebene Production-Stände.

## Nötige Entscheidung

Das Paket muss auf dem aktuellen Production-HEAD neu gebaut werden (Rebase der
Video-V1- und Business-V1-Änderungen auf die vorhandenen Fixes und auf
`role-scope.ts`), inklusive neuer `PACKAGE_FILES.sha256` und aktualisiertem
`rollback-production-original/`. Eine selektive Teilübernahme wäre eine
eigenständige Auflösung der Abweichung und ist laut Auftrag ausgeschlossen.
