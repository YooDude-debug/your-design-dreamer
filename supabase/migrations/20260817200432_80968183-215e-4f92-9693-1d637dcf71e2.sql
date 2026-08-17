ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS swipe_hint_seen boolean NOT NULL DEFAULT false;

-- Bestehende Nutzer sollen den Erstnutzer-Hinweis nicht sehen.
UPDATE public.profiles SET swipe_hint_seen = true WHERE swipe_hint_seen = false;

GRANT SELECT (swipe_hint_seen), UPDATE (swipe_hint_seen) ON public.profiles TO authenticated;