-- Helper: can the current user see a given post?
CREATE OR REPLACE FUNCTION public.can_view_post(_post_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = _post_id
      AND (p.hidden_at IS NULL OR p.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
      AND (
        p.visibility = 'public'
        OR p.user_id = auth.uid()
        OR (p.visibility = 'connections' AND public.are_connected(auth.uid(), p.user_id))
        OR (p.visibility = 'following' AND public.is_following(p.user_id, auth.uid()))
      )
  )
$$;

REVOKE ALL ON FUNCTION public.can_view_post(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_post(uuid) TO authenticated, service_role;

-- Helper: is the current user the owner/creator of a slang tag?
CREATE OR REPLACE FUNCTION public.owns_slang_tag(_tag_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.slang_tags t
    WHERE t.id = _tag_id AND (t.owner_id = auth.uid() OR t.creator_id = auth.uid())
  )
$$;

REVOKE ALL ON FUNCTION public.owns_slang_tag(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_slang_tag(uuid) TO authenticated, service_role;

-- Helper: readability of interest categorization rows
CREATE OR REPLACE FUNCTION public.can_read_content_category(_content_type public.interest_content_type, _content_id uuid, _owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND (
       _owner_id = auth.uid()
       OR (_content_type = 'post' AND EXISTS (
             SELECT 1 FROM public.posts p
             WHERE p.id = _content_id AND p.hidden_at IS NULL AND p.visibility = 'public'
           ))
       OR (_content_type = 'slang_tag' AND EXISTS (
             SELECT 1 FROM public.slang_tags t
             WHERE t.id = _content_id AND t.deleted_at IS NULL
           ))
       OR _content_type = 'ad'
     )
$$;

REVOKE ALL ON FUNCTION public.can_read_content_category(public.interest_content_type, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_content_category(public.interest_content_type, uuid, uuid) TO authenticated, service_role;

-- comments: respect parent post visibility
DROP POLICY IF EXISTS comments_select ON public.comments;
CREATE POLICY comments_select ON public.comments
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.can_view_post(post_id)
);

-- post_shares: sharer, post owner, or those allowed to see the post
DROP POLICY IF EXISTS post_shares_select ON public.post_shares;
CREATE POLICY post_shares_select ON public.post_shares
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.can_view_post(post_id)
);

-- slang_tag_likes: liker, tag owner/creator, admins
DROP POLICY IF EXISTS slang_tag_likes_select ON public.slang_tag_likes;
CREATE POLICY slang_tag_likes_select ON public.slang_tag_likes
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.owns_slang_tag(tag_id)
  OR public.has_role(auth.uid(), 'admin')
);

-- slang_tag_shares: sharer, tag owner/creator, admins
DROP POLICY IF EXISTS slang_tag_shares_select ON public.slang_tag_shares;
CREATE POLICY slang_tag_shares_select ON public.slang_tag_shares
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.owns_slang_tag(tag_id)
  OR public.has_role(auth.uid(), 'admin')
);

-- content_categories: owner, or publicly visible content
DROP POLICY IF EXISTS "content categories readable" ON public.content_categories;
CREATE POLICY "content categories readable" ON public.content_categories
FOR SELECT TO authenticated
USING (public.can_read_content_category(content_type, content_id, owner_id));
