CREATE OR REPLACE FUNCTION public.enforce_arena_challenge_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _owner uuid;
  _name text;
  _logo text;
BEGIN
  -- Service role / backend jobs (no JWT) keep current behaviour.
  IF _uid IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Ownership is derived from the session, never from client input.
    _owner := _uid;
    IF NOT (
      public.has_role(_uid, 'admin'::app_role)
      OR public.has_role(_uid, 'business'::app_role)
      OR public.has_role(_uid, 'creator'::app_role)
    ) THEN
      RAISE EXCEPTION 'Only creator or business accounts can create challenges';
    END IF;
  ELSE
    -- company_id is immutable; admins may not re-assign it either.
    _owner := OLD.company_id;
    IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
      RAISE EXCEPTION 'company_id of a challenge cannot be changed';
    END IF;
  END IF;

  NEW.company_id := _owner;

  SELECT COALESCE(NULLIF(p.display_name, ''), p.username), p.avatar_url
    INTO _name, _logo
  FROM public.profiles p
  WHERE p.user_id = _owner;

  IF _name IS NULL THEN
    RAISE EXCEPTION 'No profile found for challenge owner';
  END IF;

  -- Displayed company identity always mirrors the owning account.
  NEW.company_name := _name;
  NEW.logo_url := _logo;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_arena_challenge_identity_ins ON public.arena_challenges;
CREATE TRIGGER enforce_arena_challenge_identity_ins
BEFORE INSERT ON public.arena_challenges
FOR EACH ROW EXECUTE FUNCTION public.enforce_arena_challenge_identity();

DROP TRIGGER IF EXISTS enforce_arena_challenge_identity_upd ON public.arena_challenges;
CREATE TRIGGER enforce_arena_challenge_identity_upd
BEFORE UPDATE ON public.arena_challenges
FOR EACH ROW EXECUTE FUNCTION public.enforce_arena_challenge_identity();