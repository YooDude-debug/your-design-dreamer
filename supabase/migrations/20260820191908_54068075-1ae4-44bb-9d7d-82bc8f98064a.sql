ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ui_language text;

-- Bestandskonten: aus dem bisherigen Freitextfeld ableiten, wo eindeutig.
UPDATE public.profiles SET ui_language = CASE
  WHEN language ILIKE 'de%' OR language ILIKE 'deutsch%' OR language ILIKE 'german%' THEN 'de'
  WHEN language ILIKE 'en%' OR language ILIKE 'englisch%' OR language ILIKE 'english%' THEN 'en'
  WHEN language ILIKE 'el%' OR language ILIKE 'gr%' OR language ILIKE 'griechisch%' OR language ILIKE 'greek%' OR language ILIKE 'ελλ%' THEN 'el'
  ELSE NULL END
WHERE ui_language IS NULL;