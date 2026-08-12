CREATE TABLE public.slang_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_name text NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT '',
  source_language text NOT NULL DEFAULT '',
  region text NOT NULL DEFAULT '',
  meaning text NOT NULL DEFAULT '',
  example text NOT NULL DEFAULT '',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.slang_definitions TO authenticated;
GRANT ALL ON public.slang_definitions TO service_role;
ALTER TABLE public.slang_definitions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.slang_definition_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id uuid NOT NULL REFERENCES public.slang_definitions(id) ON DELETE CASCADE,
  lang text NOT NULL,
  meaning text NOT NULL DEFAULT '',
  example text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (definition_id, lang)
);

GRANT SELECT, INSERT, UPDATE ON public.slang_definition_translations TO authenticated;
GRANT ALL ON public.slang_definition_translations TO service_role;
ALTER TABLE public.slang_definition_translations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.owns_slang_name(_normalized_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.slang_tags t
    WHERE t.normalized_name = _normalized_name
      AND t.deleted_at IS NULL
      AND t.owner_id = auth.uid()
  )
$$;

CREATE POLICY slang_definitions_select ON public.slang_definitions
FOR SELECT TO authenticated USING (true);

CREATE POLICY slang_definitions_insert ON public.slang_definitions
FOR INSERT TO authenticated
WITH CHECK (public.owns_slang_name(normalized_name) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY slang_definitions_update ON public.slang_definitions
FOR UPDATE TO authenticated
USING (public.owns_slang_name(normalized_name) OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.owns_slang_name(normalized_name) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY slang_definition_translations_select ON public.slang_definition_translations
FOR SELECT TO authenticated USING (true);

CREATE POLICY slang_definition_translations_write ON public.slang_definition_translations
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.slang_definitions d
  WHERE d.id = definition_id
    AND (public.owns_slang_name(d.normalized_name) OR public.has_role(auth.uid(), 'admin'))
));

CREATE POLICY slang_definition_translations_update ON public.slang_definition_translations
FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.slang_definitions d
  WHERE d.id = definition_id
    AND (public.owns_slang_name(d.normalized_name) OR public.has_role(auth.uid(), 'admin'))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.slang_definitions d
  WHERE d.id = definition_id
    AND (public.owns_slang_name(d.normalized_name) OR public.has_role(auth.uid(), 'admin'))
));

CREATE TRIGGER slang_definitions_touch
BEFORE UPDATE ON public.slang_definitions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER slang_definition_translations_touch
BEFORE UPDATE ON public.slang_definition_translations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Abwaertskompatibilitaet: bestehende Bedeutungen je Name uebernehmen
INSERT INTO public.slang_definitions (normalized_name, display_name, source_language, region, meaning, example)
SELECT DISTINCT ON (t.normalized_name)
  t.normalized_name,
  t.name,
  COALESCE(t.language, ''),
  COALESCE(t.region, ''),
  COALESCE(t.meaning, ''),
  COALESCE(t.examples[1], '')
FROM public.slang_tags t
WHERE t.deleted_at IS NULL
  AND t.normalized_name IS NOT NULL
  AND COALESCE(btrim(t.meaning), '') <> ''
ORDER BY t.normalized_name, t.created_at ASC
ON CONFLICT (normalized_name) DO NOTHING;

-- Bedeutung fuer konkrete SlangTag-IDs (stabile Referenz Tag -> Definition)
CREATE OR REPLACE FUNCTION public.slang_tag_definitions(_tag_ids uuid[], _lang text DEFAULT NULL)
RETURNS TABLE(
  tag_id uuid,
  definition_id uuid,
  normalized_name text,
  meaning text,
  example text,
  lang text,
  source_language text,
  region text
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
    d.region
  FROM public.slang_tags t
  JOIN public.slang_definitions d ON d.normalized_name = t.normalized_name
  LEFT JOIN public.slang_definition_translations tr
    ON tr.definition_id = d.id AND _lang IS NOT NULL AND tr.lang = _lang
  WHERE t.id = ANY(_tag_ids)
$$;

-- Upsert der Bedeutung auf Namensebene
CREATE OR REPLACE FUNCTION public.upsert_slang_definition(_tag_id uuid, _meaning text, _example text)
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

  INSERT INTO public.slang_definitions (
    normalized_name, display_name, source_language, region, meaning, example, created_by, updated_by
  ) VALUES (
    v_tag.normalized_name, v_tag.name, COALESCE(v_tag.language, ''), COALESCE(v_tag.region, ''),
    COALESCE(btrim(_meaning), ''), COALESCE(btrim(_example), ''), auth.uid(), auth.uid()
  )
  ON CONFLICT (normalized_name) DO UPDATE
    SET meaning = COALESCE(btrim(_meaning), ''),
        example = COALESCE(btrim(_example), ''),
        display_name = CASE WHEN public.slang_definitions.display_name = '' THEN v_tag.name ELSE public.slang_definitions.display_name END,
        updated_by = auth.uid(),
        updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.slang_tag_definitions(uuid[], text) FROM anon;
REVOKE ALL ON FUNCTION public.upsert_slang_definition(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.slang_tag_definitions(uuid[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_slang_definition(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_slang_name(text) TO authenticated;

CREATE INDEX idx_slang_definition_translations_def ON public.slang_definition_translations (definition_id, lang);