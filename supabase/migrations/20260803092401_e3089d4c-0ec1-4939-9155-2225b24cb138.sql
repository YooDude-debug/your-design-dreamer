CREATE OR REPLACE FUNCTION public.enforce_slang_tag_duration()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  secs integer;
  max_secs integer;
BEGIN
  max_secs := CASE WHEN NEW.kind = 'creator' THEN 10 ELSE 5 END;
  BEGIN
    secs := split_part(NEW.duration, ':', 2)::integer
            + COALESCE(NULLIF(split_part(NEW.duration, ':', 1), '')::integer, 0) * 60;
  EXCEPTION WHEN others THEN
    secs := NULL;
  END;
  IF secs IS NOT NULL AND secs > max_secs THEN
    RAISE EXCEPTION 'SlangTag duration % exceeds limit of % seconds for kind %', NEW.duration, max_secs, NEW.kind;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS slang_tags_duration_limit ON public.slang_tags;
CREATE TRIGGER slang_tags_duration_limit
BEFORE INSERT ON public.slang_tags
FOR EACH ROW EXECUTE FUNCTION public.enforce_slang_tag_duration();