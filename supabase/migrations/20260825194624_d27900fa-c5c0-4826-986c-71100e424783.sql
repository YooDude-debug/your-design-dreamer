DROP POLICY IF EXISTS arena_submissions_select ON public.arena_submissions;
CREATE POLICY arena_submissions_select ON public.arena_submissions
FOR SELECT TO authenticated
USING (
  creator_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR (public.is_arena_challenge_visible(challenge_id) AND public.test_user_visible(creator_id))
);