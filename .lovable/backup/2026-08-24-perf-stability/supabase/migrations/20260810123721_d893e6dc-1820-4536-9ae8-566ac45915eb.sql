-- ============================================================
-- Reservierte / verbotene Usernames
-- ============================================================
CREATE TYPE public.reserved_username_category AS ENUM (
  'system','staff','admin','support','moderation','official',
  'brand','reserved','impersonation','inappropriate','other'
);

-- Normalisierung: bewusst konservativ (trim, NFKC, lowercase).
CREATE OR REPLACE FUNCTION public.normalize_username(_username text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(btrim(normalize(COALESCE(_username, ''), NFKC)))
$$;

CREATE TABLE public.reserved_usernames (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username text NOT NULL,
  normalized_username text NOT NULL,
  category public.reserved_username_category NOT NULL DEFAULT 'reserved',
  reason text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX reserved_usernames_normalized_key
  ON public.reserved_usernames (normalized_username);
CREATE INDEX reserved_usernames_category_idx
  ON public.reserved_usernames (category) WHERE is_active;

-- Interne Liste: kein Zugriff fuer anon/authenticated. Verwaltung und
-- Pruefung laufen ueber Serverfunktionen bzw. SECURITY DEFINER.
GRANT ALL ON public.reserved_usernames TO service_role;
ALTER TABLE public.reserved_usernames ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins verwalten reservierte Usernames"
  ON public.reserved_usernames FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.reserved_usernames_normalize()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.username := btrim(NEW.username);
  NEW.normalized_username := public.normalize_username(NEW.username);
  IF NEW.normalized_username = '' THEN
    RAISE EXCEPTION 'RESERVED_USERNAME_EMPTY';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER reserved_usernames_normalize
  BEFORE INSERT OR UPDATE ON public.reserved_usernames
  FOR EACH ROW EXECUTE FUNCTION public.reserved_usernames_normalize();

-- ============================================================
-- Pruefung inkl. einfacher Umgehungsvarianten
-- ============================================================
CREATE OR REPLACE FUNCTION public.username_variants(_username text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH n AS (SELECT public.normalize_username(_username) AS v),
  base AS (
    SELECT v,
           -- Trennzeichen entfernt: y-dude / y_dude / ydude
           regexp_replace(v, '[._-]', '', 'g') AS flat,
           -- angehaengte Zahlen entfernt: admin1 / admin_123 / admin.2026
           regexp_replace(v, '[._-]?[0-9]{1,4}$', '') AS nodigits
    FROM n
  )
  SELECT ARRAY(
    SELECT DISTINCT x FROM (
      SELECT v AS x FROM base
      UNION ALL SELECT flat FROM base
      UNION ALL SELECT nodigits FROM base
      UNION ALL SELECT regexp_replace(nodigits, '[._-]', '', 'g') FROM base
    ) s WHERE length(x) >= 3
  )
$$;

CREATE OR REPLACE FUNCTION public.is_username_reserved(_username text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.reserved_usernames r
    WHERE r.is_active
      AND r.normalized_username = ANY (public.username_variants(_username))
  )
$$;

-- Status fuer die Live-Pruefung: nur Zustand, keine internen Gruende.
CREATE OR REPLACE FUNCTION public.username_status(_username text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  norm text := public.normalize_username(_username);
BEGIN
  IF btrim(COALESCE(_username, '')) !~ '^[a-zA-Z0-9_.-]{3,24}$' THEN
    RETURN 'invalid';
  END IF;
  IF public.is_username_reserved(_username) THEN
    RETURN 'reserved';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p
             WHERE public.normalize_username(p.username) = norm) THEN
    RETURN 'taken';
  END IF;
  RETURN 'available';
END;
$$;

REVOKE ALL ON FUNCTION public.is_username_reserved(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.username_status(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_username_reserved(text) TO service_role;

-- ============================================================
-- Durchsetzung in der Datenbank (unabhaengig vom Frontend)
-- ============================================================
CREATE OR REPLACE FUNCTION public.guard_reserved_username()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.username IS DISTINCT FROM OLD.username THEN
    IF public.is_username_reserved(NEW.username) THEN
      RAISE EXCEPTION 'USERNAME_RESERVED';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Laeuft nach guard_profile_identity (alphabetische Triggerreihenfolge).
CREATE TRIGGER zz_guard_reserved_username
  BEFORE INSERT OR UPDATE OF username ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_reserved_username();

-- Eindeutigkeit unabhaengig von Gross-/Kleinschreibung erzwingen.
CREATE UNIQUE INDEX profiles_username_normalized_key
  ON public.profiles (public.normalize_username(username));

-- ============================================================
-- Startliste (erweiterbar)
-- ============================================================
INSERT INTO public.reserved_usernames (username, category, reason) VALUES
  ('admin','admin','Systemname'),
  ('administrator','admin','Systemname'),
  ('admins','admin','Systemname'),
  ('mod','moderation','Systemname'),
  ('moderator','moderation','Systemname'),
  ('moderation','moderation','Systemname'),
  ('support','support','Systemname'),
  ('help','support','Systemname'),
  ('helpdesk','support','Systemname'),
  ('staff','staff','Teamname'),
  ('team','staff','Teamname'),
  ('official','official','Offizielle Bezeichnung'),
  ('system','system','Systemname'),
  ('systemadmin','system','Systemname'),
  ('root','system','Systemname'),
  ('owner','staff','Teamname'),
  ('founder','staff','Teamname'),
  ('developer','staff','Teamname'),
  ('developers','staff','Teamname'),
  ('dev','staff','Teamname'),
  ('api','system','Systemname'),
  ('security','system','Systemname'),
  ('abuse','system','Systemname'),
  ('privacy','system','Systemname'),
  ('legal','system','Systemname'),
  ('contact','system','Systemname'),
  ('info','system','Systemname'),
  ('noreply','system','Systemname'),
  ('notifications','system','Systemname'),
  ('bot','system','Systemname'),
  ('test','reserved','Testname'),
  ('testing','reserved','Testname'),
  ('demo','reserved','Testname'),
  -- Marke / Plattform
  ('ydude','brand','Plattformname'),
  ('y_dude','brand','Plattformname'),
  ('y-dude','brand','Plattformname'),
  ('yoodude','brand','Frueherer Plattformname'),
  ('ydudecom','brand','Domainbezug'),
  ('ydudede','brand','Domainbezug'),
  ('ydudeapp','brand','Plattformname'),
  ('ydudeteam','brand','Plattformname'),
  ('slangtag','brand','Produktname'),
  ('slangarena','brand','Produktname'),
  ('slangglobe','brand','Produktname'),
  -- Identitaetsmissbrauch
  ('officialydude','impersonation','Vortaeuschen eines offiziellen Kontos'),
  ('ydudeofficial','impersonation','Vortaeuschen eines offiziellen Kontos'),
  ('ydudeadmin','impersonation','Vortaeuschen eines offiziellen Kontos'),
  ('ydudesupport','impersonation','Vortaeuschen eines offiziellen Kontos'),
  ('ydudestaff','impersonation','Vortaeuschen eines offiziellen Kontos'),
  ('ydudemoderator','impersonation','Vortaeuschen eines offiziellen Kontos'),
  ('ydudemoderation','impersonation','Vortaeuschen eines offiziellen Kontos'),
  ('ydudesecurity','impersonation','Vortaeuschen eines offiziellen Kontos'),
  ('ydudelegal','impersonation','Vortaeuschen eines offiziellen Kontos'),
  ('ydudebot','impersonation','Vortaeuschen eines offiziellen Kontos'),
  ('adminydude','impersonation','Vortaeuschen eines offiziellen Kontos'),
  ('supportydude','impersonation','Vortaeuschen eines offiziellen Kontos'),
  ('officialsupport','impersonation','Vortaeuschen eines offiziellen Kontos'),
  ('officialadmin','impersonation','Vortaeuschen eines offiziellen Kontos'),
  ('officialstaff','impersonation','Vortaeuschen eines offiziellen Kontos'),
  ('officialmoderator','impersonation','Vortaeuschen eines offiziellen Kontos'),
  ('adminsupport','impersonation','Vortaeuschen eines offiziellen Kontos'),
  ('adminteam','impersonation','Vortaeuschen eines offiziellen Kontos'),
  ('supportteam','impersonation','Vortaeuschen eines offiziellen Kontos'),
  ('moderatorteam','impersonation','Vortaeuschen eines offiziellen Kontos'),
  -- Eindeutig unangemessen (Community-Richtlinien, erweiterbar)
  ('hitler','inappropriate','Extremismus'),
  ('adolfhitler','inappropriate','Extremismus'),
  ('heilhitler','inappropriate','Extremismus'),
  ('nazi','inappropriate','Extremismus'),
  ('naziss','inappropriate','Extremismus'),
  ('hakenkreuz','inappropriate','Extremismus'),
  ('holocaust','inappropriate','Menschenverachtend'),
  ('isis','inappropriate','Terrororganisation'),
  ('alqaida','inappropriate','Terrororganisation'),
  ('taliban','inappropriate','Terrororganisation'),
  ('nigger','inappropriate','Rassistische Beleidigung'),
  ('neger','inappropriate','Rassistische Beleidigung'),
  ('judensau','inappropriate','Antisemitische Beleidigung'),
  ('killallgays','inappropriate','Gewaltaufruf'),
  ('killyourself','inappropriate','Gewaltaufruf'),
  ('rapist','inappropriate','Sexuelle Gewalt'),
  ('childporn','inappropriate','Sexuelle Ausbeutung Minderjaehriger'),
  ('kinderporno','inappropriate','Sexuelle Ausbeutung Minderjaehriger'),
  ('pedophile','inappropriate','Sexuelle Ausbeutung Minderjaehriger'),
  ('paedophil','inappropriate','Sexuelle Ausbeutung Minderjaehriger'),
  ('loli','inappropriate','Sexuelle Ausbeutung Minderjaehriger')
ON CONFLICT DO NOTHING;