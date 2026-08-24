-- 1) profiles: explicit authenticated-only read, location column stays revoked
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, username, display_name, bio, language, avatar_url, cover_url,
              verified, level, xp, created_at, updated_at, last_seen_at,
              is_test_bot, location_visibility)
  ON public.profiles TO authenticated;

-- 2) remove tautological ownership checks
DROP POLICY IF EXISTS grants_insert_owner ON public.slang_tag_grants;
CREATE POLICY grants_insert_owner ON public.slang_tag_grants
  FOR INSERT TO authenticated
  WITH CHECK (
    granted_by = auth.uid()
    AND grantee_id <> auth.uid()
    AND public.owns_slang_tag(tag_id)
    AND EXISTS (
      SELECT 1 FROM public.slang_tags t
      WHERE t.id = slang_tag_grants.tag_id
        AND t.owner_id = slang_tag_grants.owner_id
    )
  );

DROP POLICY IF EXISTS share_requests_insert_holder ON public.slang_tag_share_requests;
CREATE POLICY share_requests_insert_holder ON public.slang_tag_share_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    requester_id = auth.uid()
    AND target_id <> auth.uid()
    AND status = 'pending'::share_request_status
    AND public.has_slang_tag_grant(tag_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.slang_tags t
      WHERE t.id = slang_tag_share_requests.tag_id
        AND t.owner_id = slang_tag_share_requests.owner_id
    )
  );

-- 3) no anonymous execution of SECURITY DEFINER helpers
REVOKE ALL ON FUNCTION public.profile_locations(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profile_locations(uuid[]) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.can_use_extended_audio(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_use_extended_audio(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.guard_slang_tag_moderation() FROM PUBLIC, anon, authenticated;
