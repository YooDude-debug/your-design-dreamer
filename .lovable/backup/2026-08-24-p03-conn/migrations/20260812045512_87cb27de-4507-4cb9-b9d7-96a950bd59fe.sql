-- 1) Owner-Registry: nur für service_role erreichbar, kein Client-Zugriff
CREATE TABLE public.admin_owners (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.admin_owners FROM anon, authenticated;
GRANT ALL ON public.admin_owners TO service_role;

ALTER TABLE public.admin_owners ENABLE ROW LEVEL SECURITY;
-- Keine Policy für anon/authenticated => kein Client-Zugriff (auch nicht lesend).
CREATE POLICY "service role manages owners"
  ON public.admin_owners FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER admin_owners_touch
  BEFORE UPDATE ON public.admin_owners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.admin_owners (user_id, note) VALUES
  ('5b006914-91da-46a5-86be-89ec4826abe0', 'Master-Owner (MarioAdmin)'),
  ('9ce1d1b0-7481-4cb0-aedf-5291dae67297', 'Master-Owner (Mario)')
ON CONFLICT (user_id) DO NOTHING;

-- 2) Owner-Prüfung: security definer, nicht vom Client aufrufbar
CREATE OR REPLACE FUNCTION public.is_admin_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_owners WHERE user_id = _user_id)
$$;

REVOKE ALL ON FUNCTION public.is_admin_owner(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_owner(uuid) TO service_role;

-- 3) Datenbank-Sperre: Adminrolle nur über geprüfte Funktion
CREATE OR REPLACE FUNCTION public.guard_admin_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.app_role;
BEGIN
  v_role := COALESCE(NEW.role, OLD.role);
  IF v_role <> 'admin' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF COALESCE(current_setting('app.admin_role_change', true), '') <> 'owner_verified' THEN
    RAISE EXCEPTION 'Adminrolle kann nur durch den Master-Owner vergeben oder entzogen werden.';
  END IF;
  IF TG_OP = 'DELETE' AND EXISTS (SELECT 1 FROM public.admin_owners WHERE user_id = OLD.user_id) THEN
    RAISE EXCEPTION 'Die Adminrolle eines Master-Owners kann nicht entzogen werden.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER guard_admin_role_changes_trg
  BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.guard_admin_role_changes();

-- 4) Geprüfte Vergabe/Entzug der Adminrolle
CREATE OR REPLACE FUNCTION public.owner_set_admin_role(_actor uuid, _target uuid, _grant boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _actor IS NULL OR _target IS NULL THEN
    RAISE EXCEPTION 'Ungültige Anfrage.';
  END IF;
  IF NOT public.is_admin_owner(_actor) THEN
    RAISE EXCEPTION 'Nur der Master-Owner darf Adminrechte vergeben oder entziehen.';
  END IF;

  PERFORM set_config('app.admin_role_change', 'owner_verified', true);
  IF _grant THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_target, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _target AND role = 'admin';
  END IF;
  PERFORM set_config('app.admin_role_change', '', true);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_set_admin_role(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_set_admin_role(uuid, uuid, boolean) TO service_role;