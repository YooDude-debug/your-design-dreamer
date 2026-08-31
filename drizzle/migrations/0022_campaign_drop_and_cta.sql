ALTER TABLE public.ad_campaigns
  ADD COLUMN IF NOT EXISTS slang_tag_drop_id uuid REFERENCES public.slang_tag_drops(tag_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cta text;

ALTER TABLE public.ad_campaigns DROP CONSTRAINT IF EXISTS ad_campaigns_cta_chk;
ALTER TABLE public.ad_campaigns
  ADD CONSTRAINT ad_campaigns_cta_chk
  CHECK (cta IS NULL OR cta IN ('listen', 'slangtag', 'profile'));

CREATE OR REPLACE FUNCTION public.enforce_campaign_slang_tag_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _drop_creator uuid;
  _drop_tag_owner uuid;
BEGIN
  IF NEW.owner_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.has_role(NEW.owner_id, 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.slang_tag_id IS NOT NULL THEN
    SELECT owner_id INTO _owner FROM public.slang_tags WHERE id = NEW.slang_tag_id;
    IF _owner IS DISTINCT FROM NEW.owner_id THEN
      RAISE EXCEPTION 'slang_tag_not_owned' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.slang_tag_drop_id IS NOT NULL THEN
    SELECT d.creator_id, t.owner_id
      INTO _drop_creator, _drop_tag_owner
      FROM public.slang_tag_drops d
      JOIN public.slang_tags t ON t.id = d.tag_id
     WHERE d.tag_id = NEW.slang_tag_drop_id;
    IF _drop_creator IS NULL
       OR _drop_creator IS DISTINCT FROM NEW.owner_id
       OR _drop_tag_owner IS DISTINCT FROM NEW.owner_id THEN
      RAISE EXCEPTION 'slang_tag_drop_not_owned' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END
$$;