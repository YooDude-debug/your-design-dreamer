# Rollback

Der Rückweg basiert auf dem **aktuellen Production-Stand**. Bestehende
Production-Fixes werden dadurch nicht entfernt.

## 1. Quellcode

`rollback-production-original/` enthält die 14 aktuellen Production-Fassungen der
geänderten Dateien. Zurückkopieren genügt:

```bash
rsync -a rollback-production-original/ ./
```

Die 9 neu eingeführten Dateien werden gelöscht:

```bash
rm -f src/lib/business-role.functions.ts \
      src/lib/video/video-file.ts src/lib/video/video-thumbnail.ts \
      src/lib/video/video-errors.ts src/lib/video/video-upload.shared.ts \
      src/lib/video/video-upload.functions.ts src/lib/video/video-upload-client.ts \
      tests/video-upload-validation.test.ts tests/business-onboarding.test.ts
```

Anschließend `src/integrations/supabase/types.ts` aus dem dann geltenden
Datenbankstand neu generieren.

## 2. Datenbank – Scope A (Video V1)

```sql
DROP TABLE IF EXISTS public.media_video_assets;   -- inkl. Trigger, Indizes, Policies
DROP TYPE  IF EXISTS public.video_processing_status;

ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_video_kind_check;
ALTER TABLE public.posts DROP COLUMN IF EXISTS video_kind;
```

Hinweis: `posts.video_kind` hat den Default `shot`; das Droppen entfernt keine
Beitragsdaten. Bereits hochgeladene Videodateien bleiben im Bucket `media`
liegen und werden nicht gelöscht.

Migration 03 (`REVOKE ALL … FROM anon`) ist eine reine Verschärfung und braucht
keinen Rückweg; sie verschwindet mit der Tabelle.

## 3. Datenbank – Scope B (Business V1)

Keine DB-Änderung. Business Campaigns V1 und Creator Subscription V1 bleiben
unangetastet; ein Rollback von Scope B ist rein quellcodeseitig.

## 4. Ausdrücklich nicht zurückzurollen

`user_roles`, `comments`, Creator Subscription, Business Campaigns,
`business_plan_tier()`, `increment_campaign_metric()`, Stripe, Storage-Policies.
