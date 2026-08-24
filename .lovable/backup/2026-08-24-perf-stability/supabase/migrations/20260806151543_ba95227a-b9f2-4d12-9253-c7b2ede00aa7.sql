CREATE OR REPLACE FUNCTION public.can_see_arena_engagement(_submission_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.arena_submissions s
    JOIN public.arena_challenges c ON c.id = s.challenge_id
    WHERE s.id = _submission_id
      AND (s.creator_id = auth.uid() OR c.company_id = auth.uid())
  ) OR public.has_role(auth.uid(), 'admin')
$$;

REVOKE ALL ON FUNCTION public.can_see_arena_engagement(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_arena_engagement(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS arena_votes_select ON public.arena_votes;
CREATE POLICY arena_votes_select ON public.arena_votes FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.can_see_arena_engagement(submission_id));

DROP POLICY IF EXISTS arena_likes_select ON public.arena_likes;
CREATE POLICY arena_likes_select ON public.arena_likes FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.can_see_arena_engagement(submission_id));

DROP POLICY IF EXISTS arena_plays_select ON public.arena_plays;
CREATE POLICY arena_plays_select ON public.arena_plays FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.can_see_arena_engagement(submission_id));