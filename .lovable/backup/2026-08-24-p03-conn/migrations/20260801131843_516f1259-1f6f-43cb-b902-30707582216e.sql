CREATE TABLE public.slang_tag_votes (
  tag_id uuid NOT NULL REFERENCES public.slang_tags(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value smallint NOT NULL CHECK (value IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tag_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.slang_tag_votes TO authenticated;
GRANT ALL ON public.slang_tag_votes TO service_role;

ALTER TABLE public.slang_tag_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "votes_select_authenticated" ON public.slang_tag_votes
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "votes_insert_own" ON public.slang_tag_votes
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.slang_tags t
      WHERE t.id = tag_id
        AND t.kind = 'community'
        AND t.deleted_at IS NULL
        AND t.owner_id <> auth.uid()
        AND t.creator_id <> auth.uid()
    )
  );

CREATE POLICY "votes_update_own" ON public.slang_tag_votes
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "votes_delete_own" ON public.slang_tag_votes
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER slang_tag_votes_touch
  BEFORE UPDATE ON public.slang_tag_votes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX slang_tag_votes_tag_idx ON public.slang_tag_votes (tag_id);

CREATE OR REPLACE FUNCTION public.slang_tag_vote_stats(_tag_ids uuid[])
RETURNS TABLE (tag_id uuid, up_count integer, down_count integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.tag_id,
         count(*) FILTER (WHERE v.value = 1)::int,
         count(*) FILTER (WHERE v.value = -1)::int
  FROM public.slang_tag_votes v
  WHERE v.tag_id = ANY(_tag_ids)
  GROUP BY v.tag_id
$$;

REVOKE ALL ON FUNCTION public.slang_tag_vote_stats(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.slang_tag_vote_stats(uuid[]) TO authenticated;