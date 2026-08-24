ALTER TABLE public.slang_definitions
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS region_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS place_detail text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS geo_updated_by uuid,
  ADD COLUMN IF NOT EXISTS geo_updated_at timestamptz;

DROP FUNCTION IF EXISTS public.slang_tag_definitions(uuid[], text);

CREATE FUNCTION public.slang_tag_definitions(_tag_ids uuid[], _lang text DEFAULT NULL)
RETURNS TABLE(
  tag_id uuid,
  definition_id uuid,
  normalized_name text,
  meaning text,
  example text,
  lang text,
  source_language text,
  region text,
  country text,
  region_name text,
  city text,
  place_detail text,
  latitude double precision,
  longitude double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    d.id,
    d.normalized_name,
    COALESCE(NULLIF(tr.meaning, ''), d.meaning),
    COALESCE(NULLIF(tr.example, ''), d.example),
    COALESCE(tr.lang, d.source_language),
    d.source_language,
    d.region,
    d.country,
    d.region_name,
    d.city,
    d.place_detail,
    d.latitude,
    d.longitude
  FROM public.slang_tags t
  JOIN public.slang_definitions d ON d.normalized_name = t.normalized_name
  LEFT JOIN public.slang_definition_translations tr
    ON tr.definition_id = d.id AND _lang IS NOT NULL AND tr.lang = _lang
  WHERE t.id = ANY(_tag_ids)
$$;

REVOKE ALL ON FUNCTION public.slang_tag_definitions(uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.slang_tag_definitions(uuid[], text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.upsert_slang_geo(
  _tag_id uuid,
  _country text,
  _region text,
  _city text,
  _place_detail text,
  _language text,
  _latitude double precision,
  _longitude double precision
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tag public.slang_tags;
  v_id uuid;
BEGIN
  SELECT * INTO v_tag FROM public.slang_tags WHERE id = _tag_id AND deleted_at IS NULL;
  IF v_tag.id IS NULL THEN
    RAISE EXCEPTION 'slang tag not found';
  END IF;
  IF NOT (public.owns_slang_name(v_tag.normalized_name) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  IF _latitude IS NOT NULL AND (_latitude < -90 OR _latitude > 90) THEN
    RAISE EXCEPTION 'invalid latitude';
  END IF;
  IF _longitude IS NOT NULL AND (_longitude < -180 OR _longitude > 180) THEN
    RAISE EXCEPTION 'invalid longitude';
  END IF;

  INSERT INTO public.slang_definitions (
    normalized_name, display_name, source_language, region,
    country, region_name, city, place_detail, latitude, longitude,
    created_by, updated_by, geo_updated_by, geo_updated_at
  ) VALUES (
    v_tag.normalized_name, v_tag.name,
    COALESCE(NULLIF(btrim(_language), ''), COALESCE(v_tag.language, '')),
    COALESCE(v_tag.region, ''),
    COALESCE(btrim(_country), ''), COALESCE(btrim(_region), ''),
    COALESCE(btrim(_city), ''), COALESCE(btrim(_place_detail), ''),
    _latitude, _longitude,
    auth.uid(), auth.uid(), auth.uid(), now()
  )
  ON CONFLICT (normalized_name) DO UPDATE
    SET country = COALESCE(btrim(_country), ''),
        region_name = COALESCE(btrim(_region), ''),
        city = COALESCE(btrim(_city), ''),
        place_detail = COALESCE(btrim(_place_detail), ''),
        latitude = _latitude,
        longitude = _longitude,
        source_language = COALESCE(NULLIF(btrim(_language), ''), public.slang_definitions.source_language),
        display_name = CASE WHEN public.slang_definitions.display_name = '' THEN v_tag.name ELSE public.slang_definitions.display_name END,
        updated_by = auth.uid(),
        updated_at = now(),
        geo_updated_by = auth.uid(),
        geo_updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_slang_geo(uuid, text, text, text, text, text, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_slang_geo(uuid, text, text, text, text, text, double precision, double precision) TO authenticated, service_role;