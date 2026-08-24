CREATE OR REPLACE FUNCTION public.enforce_slang_tag_duration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  secs integer;
  max_secs integer;
  extended boolean;
BEGIN
  -- Kontotyp entscheidet ueber die maximale Laenge:
  -- verifizierte Unternehmer/Creator und Admins duerfen 10 Sekunden, sonst 5.
  extended := COALESCE((
      SELECT p.verified FROM public.profiles p
      WHERE p.id = COALESCE(NEW.owner_id, NEW.creator_id)
    ), false)
    OR public.has_role(COALESCE(NEW.owner_id, NEW.creator_id), 'admin')
    OR public.has_role(auth.uid(), 'admin');

  max_secs := CASE WHEN extended THEN 10 ELSE 5 END;

  BEGIN
    secs := split_part(NEW.duration, ':', 2)::integer
            + COALESCE(NULLIF(split_part(NEW.duration, ':', 1), '')::integer, 0) * 60;
  EXCEPTION WHEN others THEN
    secs := NULL;
  END;

  IF secs IS NOT NULL AND secs > max_secs THEN
    RAISE EXCEPTION 'SlangTag duration % exceeds limit of % seconds for this account type', NEW.duration, max_secs;
  END IF;

  RETURN NEW;
END;
$function$;