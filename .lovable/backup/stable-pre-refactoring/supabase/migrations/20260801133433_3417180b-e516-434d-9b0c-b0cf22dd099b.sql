DROP POLICY IF EXISTS votes_select_authenticated ON public.slang_tag_votes;
CREATE POLICY votes_select_own_or_owner ON public.slang_tag_votes
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.owns_slang_tag(tag_id)
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
FOR SELECT TO authenticated
USING (true);

REVOKE SELECT ON public.profiles FROM anon;