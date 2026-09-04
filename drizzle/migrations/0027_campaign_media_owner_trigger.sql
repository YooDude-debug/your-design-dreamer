CREATE OR REPLACE FUNCTION public.enforce_campaign_media_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prefix text;
BEGIN
  IF NEW.owner_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.media_image_path IS NULL
     AND NEW.media_video_path IS NULL
     AND NEW.media_video_thumb_path IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.has_role(NEW.owner_id, 'admin') THEN
    RETURN NEW;
  END IF;
  _prefix := NEW.owner_id::text || '/';
  IF (NEW.media_image_path IS NOT NULL AND position(_prefix in NEW.media_image_path) <> 1)
     OR (NEW.media_video_path IS NOT NULL AND position(_prefix in NEW.media_video_path) <> 1)
     OR (NEW.media_video_thumb_path IS NOT NULL AND position(_prefix in NEW.media_video_thumb_path) <> 1) THEN
    RAISE EXCEPTION 'campaign_media_not_owned' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS enforce_campaign_media_owner_trg ON public.ad_campaigns;
CREATE TRIGGER enforce_campaign_media_owner_trg
  BEFORE INSERT OR UPDATE ON public.ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.enforce_campaign_media_owner();

REVOKE EXECUTE ON FUNCTION public.enforce_campaign_media_owner() FROM PUBLIC, anon, authenticated;