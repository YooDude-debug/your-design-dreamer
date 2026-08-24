DROP POLICY IF EXISTS arena_awards_select ON public.arena_awards;
CREATE POLICY arena_awards_select ON public.arena_awards
  FOR SELECT TO authenticated
  USING (
    public.is_arena_challenge_visible(challenge_id)
    AND (submission_id IS NULL OR public.can_see_arena_submission(submission_id))
  );

DROP POLICY IF EXISTS slang_tag_votes_insert ON public.slang_tag_votes;
DROP POLICY IF EXISTS votes_insert_own ON public.slang_tag_votes;
CREATE POLICY slang_tag_votes_insert ON public.slang_tag_votes
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.slang_tags t
      WHERE t.id = slang_tag_votes.tag_id
        AND t.kind = 'community'::slang_tag_kind
        AND t.deleted_at IS NULL
        AND t.owner_id <> auth.uid()
        AND t.creator_id <> auth.uid()
    )
  );