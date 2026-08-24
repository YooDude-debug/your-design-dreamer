ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS slangtag_order_locked boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.enforce_post_slang_tag_usage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t uuid;
  new_ids uuid[];
BEGIN
  -- Harte Obergrenze: maximal 5 SlangTags pro Beitrag (auch bei Platzierungen).
  IF COALESCE(array_length(NEW.slang_tag_ids, 1), 0) > 5 THEN
    RAISE EXCEPTION 'Maximal 5 SlangTags pro Beitrag erlaubt';
  END IF;
  IF NEW.placements IS NOT NULL AND jsonb_typeof(NEW.placements) = 'array'
     AND jsonb_array_length(NEW.placements) > 5 THEN
    RAISE EXCEPTION 'Maximal 5 SlangTag-Platzierungen pro Beitrag erlaubt';
  END IF;

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
$function$;