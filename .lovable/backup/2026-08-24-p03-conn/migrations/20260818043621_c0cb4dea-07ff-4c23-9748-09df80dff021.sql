-- 1) Arena challenges: authorized business/creator identity check (server-side, trusted role source)
CREATE OR REPLACE FUNCTION public.can_create_arena_challenge(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_bans b
      WHERE b.user_id = _user_id
        AND b.active
        AND (b.expires_at IS NULL OR b.expires_at > now())
    )
    AND EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id = _user_id
        AND r.role IN ('admin'::app_role, 'business'::app_role, 'creator'::app_role)
    );
$$;

REVOKE ALL ON FUNCTION public.can_create_arena_challenge(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_create_arena_challenge(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS arena_challenges_insert ON public.arena_challenges;
CREATE POLICY arena_challenges_insert ON public.arena_challenges
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = auth.uid()
    AND public.can_create_arena_challenge(auth.uid())
  );

-- 2) slang_tag_votes: remove the less restrictive overlapping UPDATE policy
DROP POLICY IF EXISTS votes_update_own ON public.slang_tag_votes;

DROP POLICY IF EXISTS slang_tag_votes_update ON public.slang_tag_votes;
CREATE POLICY slang_tag_votes_update ON public.slang_tag_votes
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND public.is_community_tag(tag_id)
    AND NOT public.owns_slang_tag(tag_id)
  )
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_community_tag(tag_id)
    AND NOT public.owns_slang_tag(tag_id)
  );