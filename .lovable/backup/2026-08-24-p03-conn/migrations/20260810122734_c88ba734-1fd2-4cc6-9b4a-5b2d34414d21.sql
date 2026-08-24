-- 1. Anzeigemodus als Enum
DO $$ BEGIN
  CREATE TYPE public.display_name_mode AS ENUM ('username','real_name','both');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Getrennte Identitaets-/Registrierungsdaten
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS display_name_mode public.display_name_mode NOT NULL DEFAULT 'username',
  ADD COLUMN IF NOT EXISTS username_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS display_name_mode_changed_at timestamptz;

-- 3. Konfigurierbare Sperrfristen (keine eigenmaechtige rechtliche Festlegung)
CREATE TABLE IF NOT EXISTS public.identity_policy (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  username_change_cooldown_days integer NOT NULL DEFAULT 30,
  display_mode_change_cooldown_days integer NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.identity_policy TO authenticated;
GRANT ALL ON public.identity_policy TO service_role;
ALTER TABLE public.identity_policy ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "identity_policy_read" ON public.identity_policy;
CREATE POLICY "identity_policy_read" ON public.identity_policy
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "identity_policy_admin_write" ON public.identity_policy;
CREATE POLICY "identity_policy_admin_write" ON public.identity_policy
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.identity_policy (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
DROP TRIGGER IF EXISTS identity_policy_updated_at ON public.identity_policy;
CREATE TRIGGER identity_policy_updated_at BEFORE UPDATE ON public.identity_policy
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Oeffentlicher Anzeigename wird immer abgeleitet
CREATE OR REPLACE FUNCTION public.compute_public_display_name(
  _username text, _first text, _last text, _mode public.display_name_mode
) RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _mode = 'real_name' THEN
      COALESCE(NULLIF(btrim(COALESCE(_first,'') || ' ' || COALESCE(_last,'')), ''), _username)
    WHEN _mode = 'both' THEN
      CASE WHEN btrim(COALESCE(_first,'') || ' ' || COALESCE(_last,'')) <> ''
        THEN _username || ' · ' || btrim(COALESCE(_first,'') || ' ' || COALESCE(_last,''))
        ELSE _username END
    ELSE _username
  END
$$;

-- 5. Identitaetsschutz: gesperrte Felder + Sperrfristen
CREATE OR REPLACE FUNCTION public.guard_profile_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  privileged boolean;
  pol record;
BEGIN
  privileged := current_user IN ('postgres','service_role','supabase_admin')
                OR public.has_role(auth.uid(), 'admin');

  IF TG_OP = 'UPDATE' AND NOT privileged THEN
    -- Registrierungsdaten sind fest: keine Aenderung ueber den Client
    IF OLD.birthday IS NOT NULL THEN NEW.birthday := OLD.birthday; END IF;
    IF btrim(OLD.first_name) <> '' THEN NEW.first_name := OLD.first_name; END IF;
    IF btrim(OLD.last_name) <> '' THEN NEW.last_name := OLD.last_name; END IF;

    SELECT * INTO pol FROM public.identity_policy WHERE id LIMIT 1;

    IF NEW.username IS DISTINCT FROM OLD.username THEN
      IF OLD.username_changed_at IS NOT NULL
         AND OLD.username_changed_at > now() - make_interval(days => COALESCE(pol.username_change_cooldown_days, 30)) THEN
        RAISE EXCEPTION 'USERNAME_COOLDOWN';
      END IF;
      NEW.username_changed_at := now();
    ELSE
      NEW.username_changed_at := OLD.username_changed_at;
    END IF;

    IF NEW.display_name_mode IS DISTINCT FROM OLD.display_name_mode THEN
      IF OLD.display_name_mode_changed_at IS NOT NULL
         AND OLD.display_name_mode_changed_at > now() - make_interval(days => COALESCE(pol.display_mode_change_cooldown_days, 30)) THEN
        RAISE EXCEPTION 'DISPLAY_MODE_COOLDOWN';
      END IF;
      NEW.display_name_mode_changed_at := now();
    ELSE
      NEW.display_name_mode_changed_at := OLD.display_name_mode_changed_at;
    END IF;
  END IF;

  -- Abgeleitete Werte immer neu berechnen (kein paralleles Namenssystem)
  NEW.real_name := btrim(COALESCE(NEW.first_name,'') || ' ' || COALESCE(NEW.last_name,''));
  NEW.real_name_hidden := (NEW.display_name_mode = 'username');
  NEW.display_name := public.compute_public_display_name(
    NEW.username, NEW.first_name, NEW.last_name, NEW.display_name_mode);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_identity ON public.profiles;
CREATE TRIGGER guard_profile_identity
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_identity();

-- 6. Spaltenrechte: Identitaetsdaten nicht mehr direkt lesbar
REVOKE SELECT (real_name) ON public.profiles FROM authenticated;
REVOKE SELECT (real_name) ON public.profiles FROM anon;
REVOKE UPDATE (real_name, real_name_hidden, birthday, display_name) ON public.profiles FROM authenticated;
GRANT SELECT (display_name_mode) ON public.profiles TO authenticated;
GRANT UPDATE (display_name_mode) ON public.profiles TO authenticated;

-- 7. profile_details: Geburtsdatum immer privat, Identitaetsdaten nur fuer sich selbst
CREATE OR REPLACE FUNCTION public.profile_details(_ids uuid[])
RETURNS TABLE(user_id uuid, details jsonb)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  r record;
  all_fields jsonb;
  visible jsonb;
  k text;
  vis text;
BEGIN
  IF uid IS NULL THEN RETURN; END IF;

  FOR r IN SELECT * FROM public.profiles p WHERE p.id = ANY(_ids) LOOP
    all_fields := jsonb_build_object(
      'origin', r.origin,
      'languages', to_jsonb(r.languages),
      'birthday', r.birthday,
      'pronouns', r.pronouns,
      'interestTags', to_jsonb(r.interest_tags),
      'hobbies', to_jsonb(r.hobbies),
      'music', to_jsonb(r.fav_music),
      'games', to_jsonb(r.fav_games),
      'movies', to_jsonb(r.fav_movies),
      'sports', to_jsonb(r.fav_sports),
      'website', r.website,
      'instagram', r.instagram,
      'tiktok', r.tiktok,
      'youtube', r.youtube,
      'twitch', r.twitch,
      'discord', r.discord
    );

    visible := '{}'::jsonb;
    FOR k IN SELECT jsonb_object_keys(all_fields) LOOP
      -- Geburtsdatum ist niemals oeffentlich, unabhaengig von Einstellungen
      IF k = 'birthday' THEN
        vis := 'private';
      ELSE
        vis := COALESCE(r.field_visibility->>k,
                        CASE WHEN k = 'discord' THEN 'private' ELSE 'public' END);
      END IF;
      IF public.can_see_profile_field(r.id, vis) THEN
        visible := visible || jsonb_build_object(k, all_fields->k);
      END IF;
    END LOOP;

    IF uid = r.id THEN
      visible := visible || jsonb_build_object(
        'fieldVisibility', COALESCE(r.field_visibility, '{}'::jsonb),
        'firstName', r.first_name,
        'lastName', r.last_name,
        'displayNameMode', r.display_name_mode,
        'usernameChangedAt', r.username_changed_at,
        'displayNameModeChangedAt', r.display_name_mode_changed_at);
    END IF;

    user_id := r.id;
    details := visible;
    RETURN NEXT;
  END LOOP;
END;
$$;