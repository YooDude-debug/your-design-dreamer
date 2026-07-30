DO $$ BEGIN
  CREATE TYPE public.post_visibility AS ENUM ('public','connections','private');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS visibility public.post_visibility NOT NULL DEFAULT 'public';

DROP POLICY IF EXISTS posts_select ON public.posts;

CREATE POLICY posts_select ON public.posts
FOR SELECT TO authenticated
USING (
  visibility = 'public'
  OR user_id = auth.uid()
  OR (visibility = 'connections' AND public.are_connected(auth.uid(), user_id))
);