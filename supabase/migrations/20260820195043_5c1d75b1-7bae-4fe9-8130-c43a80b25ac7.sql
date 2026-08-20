-- 1. Kennzeichnung
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_test_user boolean NOT NULL DEFAULT false;

-- Nutzer dürfen dieses Feld niemals selbst setzen
REVOKE UPDATE (is_test_user) ON public.profiles FROM authenticated;
REVOKE UPDATE (is_test_user) ON public.profiles FROM anon;

-- 2. Testaccounts eindeutig markieren (nur technische Test-/QA-Mailadressen)
UPDATE public.profiles p
SET is_test_user = true
WHERE p.id IN (
  SELECT u.id FROM auth.users u
  WHERE u.email LIKE '%@y-dude.test'
     OR u.email LIKE '%@testaccount.y-dude.com'
     OR u.email LIKE '%@example.com'
);

-- 3. Sichere Helferfunktionen
CREATE OR REPLACE FUNCTION public.can_view_test_users()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    public.has_role(auth.uid(), 'admin')
    OR public.is_admin_owner(auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_test_user),
  false)
$$;

CREATE OR REPLACE FUNCTION public.is_test_profile(_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((SELECT p.is_test_user FROM public.profiles p WHERE p.id = _id), false)
$$;

-- true, wenn der Inhaber/Autor für den aktuellen Betrachter sichtbar sein darf
CREATE OR REPLACE FUNCTION public.test_user_visible(_owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _owner IS NULL
      OR _owner = auth.uid()
      OR NOT public.is_test_profile(_owner)
      OR public.can_view_test_users()
$$;

GRANT EXECUTE ON FUNCTION public.can_view_test_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_test_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_user_visible(uuid) TO authenticated;

-- 4. Profile: Testaccounts für normale Nutzer unsichtbar
CREATE OR REPLACE FUNCTION public.can_view_profile(_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN auth.uid() = _profile_id THEN true
    WHEN NOT public.test_user_visible(_profile_id) THEN false
    ELSE COALESCE((
      SELECT CASE p.profile_visibility
        WHEN 'public' THEN true
        WHEN 'connections' THEN public.are_connected(auth.uid(), p.id)
        ELSE false
      END
      FROM public.profiles p
      WHERE p.id = _profile_id
    ), false)
    OR EXISTS (
      SELECT 1 FROM public.connections c
      WHERE (c.requester_id = auth.uid() AND c.addressee_id = _profile_id)
         OR (c.addressee_id = auth.uid() AND c.requester_id = _profile_id)
    )
  END
$$;

-- 5. Beiträge von Testaccounts
CREATE OR REPLACE FUNCTION public.can_view_post(_post_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = _post_id
      AND (p.hidden_at IS NULL OR p.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
      AND public.test_user_visible(p.user_id)
      AND (
        p.visibility = 'public'
        OR p.user_id = auth.uid()
        OR (p.visibility = 'connections' AND public.are_connected(auth.uid(), p.user_id))
        OR (p.visibility = 'following' AND public.is_following(p.user_id, auth.uid()))
      )
  )
$$;

DROP POLICY IF EXISTS posts_select ON public.posts;
CREATE POLICY posts_select ON public.posts FOR SELECT
USING (
  ((hidden_at IS NULL) OR (user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  AND public.test_user_visible(user_id)
  AND (
    (visibility = 'public'::post_visibility)
    OR (user_id = auth.uid())
    OR ((visibility = 'connections'::post_visibility) AND are_connected(auth.uid(), user_id))
    OR ((visibility = 'following'::post_visibility) AND is_following(user_id, auth.uid()))
  )
);

-- 6. Kommentare von Testaccounts
DROP POLICY IF EXISTS comments_select ON public.comments;
CREATE POLICY comments_select ON public.comments FOR SELECT
USING (
  (user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (can_view_post(post_id) AND public.test_user_visible(user_id))
);

-- 7. SlangTags von Testaccounts
DROP POLICY IF EXISTS slang_tags_select ON public.slang_tags;
CREATE POLICY slang_tags_select ON public.slang_tags FOR SELECT
USING (
  (auth.uid() = owner_id)
  OR (auth.uid() = creator_id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (
    deleted_at IS NULL
    AND moderation_status = 'approved'::moderation_status
    AND public.test_user_visible(creator_id)
    AND public.test_user_visible(owner_id)
  )
);

-- 8. Arena-Beiträge von Testaccounts
DROP POLICY IF EXISTS arena_submissions_select ON public.arena_submissions;
CREATE POLICY arena_submissions_select ON public.arena_submissions FOR SELECT
USING (
  (creator_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (is_arena_challenge_visible(challenge_id) AND public.test_user_visible(creator_id))
);

-- 9. Connection-Vorschläge
DROP POLICY IF EXISTS connection_suggestions_select_own ON public.connection_suggestions;
CREATE POLICY connection_suggestions_select_own ON public.connection_suggestions FOR SELECT
USING (user_id = auth.uid() AND public.test_user_visible(suggested_id));

DELETE FROM public.connection_suggestions cs
WHERE EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.id = cs.suggested_id AND p.is_test_user
) AND NOT EXISTS (
  SELECT 1 FROM public.profiles me WHERE me.id = cs.user_id AND me.is_test_user
);