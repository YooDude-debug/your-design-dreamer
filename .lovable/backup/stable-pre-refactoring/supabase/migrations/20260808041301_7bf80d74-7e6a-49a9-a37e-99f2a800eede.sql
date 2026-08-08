CREATE OR REPLACE FUNCTION public.can_use_slang_tag(_tag_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Persoenliche SlangTag-Architektur: nutzbar sind ausschliesslich eigene
  -- Varianten sowie ausdruecklich freigegebene (Grants). Das Abspielen fremder
  -- Varianten in veroeffentlichten Beitraegen bleibt davon unberuehrt und
  -- wird weiterhin ueber die Post-/Medien-Sichtbarkeit geregelt.
  SELECT public.has_slang_tag_grant(_tag_id, _user_id)
$$;

CREATE OR REPLACE FUNCTION public.enforce_post_slang_tag_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  t uuid;
  new_ids uuid[];
BEGIN
  IF NEW.slang_tag_ids IS NULL OR array_length(NEW.slang_tag_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT COALESCE(array_agg(x), '{}')
      INTO new_ids
      FROM unnest(NEW.slang_tag_ids) x
     WHERE NOT (x = ANY(COALESCE(OLD.slang_tag_ids, '{}'::uuid[])));
  ELSE
    new_ids := NEW.slang_tag_ids;
  END IF;

  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  FOREACH t IN ARRAY COALESCE(new_ids, '{}'::uuid[]) LOOP
    IF NOT public.has_slang_tag_grant(t, NEW.user_id) THEN
      RAISE EXCEPTION 'SlangTag % darf nicht fuer eigene Beitraege verwendet werden', t;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS posts_enforce_slang_tag_usage ON public.posts;
CREATE TRIGGER posts_enforce_slang_tag_usage
  BEFORE INSERT OR UPDATE OF slang_tag_ids ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_post_slang_tag_usage();

REVOKE EXECUTE ON FUNCTION public.enforce_post_slang_tag_usage() FROM PUBLIC, anon, authenticated;