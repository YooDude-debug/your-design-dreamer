# Runbook – Production Migration (rebased)

**Baseline = aktueller Production-Stand.** Nicht auf `cdf7634` zurücksetzen.

Voraussetzungen in Production (vor Start prüfen, sonst STOPP):

- `public.set_updated_at()` vorhanden
- `ad_campaigns`, `business_campaign_limit()`, `enforce_business_campaign_limit()`,
  `business_plan_tier()` vorhanden
- `creator_subscriptions` vorhanden
- Bucket `media` privat
- `public.user_roles` vorhanden
- `media_video_assets`, Typ `video_processing_status`, `posts.video_kind`
  **nicht** vorhanden

## Ablauf

1. **Integrität** – `sha256sum -c PACKAGE_FILES.sha256` → muss vollständig OK sein.
2. **Baseline/Diff-Gate** – die 14 Dateien aus `rollback-production-original/`
   müssen byteweise dem Production-Stand entsprechen. Abweichung → STOPP.
3. **Backup** – DB-Snapshot; die 14 Production-Originale sichern
   (`rollback-production-original/` ist die Sicherung).
4. **Migrations-Gate** – erneut prüfen, dass keine der 3 Strukturen existiert.
   Teilweise vorhanden → STOPP.
5. **DB-Migrationen, Reihenfolge zwingend:**
   1. `migrations/01_media_video_assets.sql` – Typ `video_processing_status`,
      Tabelle `media_video_assets` (Owner-SELECT für `authenticated`, ALL für
      `service_role`, RLS aktiv), Indizes, Trigger `media_video_assets_touch`
      (nutzt vorhandenes `public.set_updated_at()`).
      Rollback: `DROP TABLE public.media_video_assets; DROP TYPE public.video_processing_status;`
   2. `migrations/02_posts_video_kind.sql` – `posts.video_kind` (`shot`/`post`,
      Default `shot`) + Check-Constraint. Keine Policies/Grants/Funktionen.
      Rollback: Constraint + Spalte droppen.
   3. `migrations/03_media_video_assets_revoke_anon.sql` – entzieht `anon`
      jegliche Rechte (Defense in Depth). Kein Rollback nötig.
6. **Typen** – nach den Migrationen `src/integrations/supabase/types.ts` aus dem
   Datenbankstand neu generieren. Das mitgelieferte `types.ts` ist der erwartete
   Zielinhalt; maßgeblich ist die Generierung.
7. **Source** – `target-production-files/` pfadgleich übernehmen (23 Dateien).
   Keine Neuimplementierung, keine weiteren Formatierungsänderungen.
8. **Verify** – `bun install`, `bun run verify` (Typecheck, Lint, Unit, DB, Build)
   sowie Playwright-E2E gegen die lokale Vorschau.
9. **Smoke-Test** – `TEST_PLAN.md`.
10. **Bei Abweichung/Fehlschlag** – `ROLLBACK.md`, scope-getrennt.

Stripe: keine Konfigurationsänderung. Business 14,90 €, Business Pro 39,00 €
bleiben unverändert; Video V1 berührt Stripe nicht.
