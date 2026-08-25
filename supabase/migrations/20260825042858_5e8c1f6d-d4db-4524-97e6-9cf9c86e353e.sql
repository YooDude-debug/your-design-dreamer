-- Helper: consistency check for market analytics rows (security definer, no extra SELECT grants needed)
CREATE OR REPLACE FUNCTION public.market_event_refs_valid(_item_id uuid, _seller_id uuid, _category_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _item_id IS NULL THEN (_seller_id IS NULL AND _category_id IS NULL)
    ELSE EXISTS (
      SELECT 1 FROM public.market_items i
      WHERE i.id = _item_id
        AND i.seller_id = _seller_id
        AND (i.category_id IS NOT DISTINCT FROM _category_id)
    )
  END
$$;

REVOKE ALL ON FUNCTION public.market_event_refs_valid(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.market_event_refs_valid(uuid, uuid, uuid) TO authenticated, service_role;

-- 1) Arena: nur sichtbare Submissions
DROP POLICY IF EXISTS arena_votes_insert ON public.arena_votes;
CREATE POLICY arena_votes_insert ON public.arena_votes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_see_arena_submission(submission_id));

DROP POLICY IF EXISTS arena_likes_insert ON public.arena_likes;
CREATE POLICY arena_likes_insert ON public.arena_likes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_see_arena_submission(submission_id));

DROP POLICY IF EXISTS arena_plays_insert ON public.arena_plays;
CREATE POLICY arena_plays_insert ON public.arena_plays
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_see_arena_submission(submission_id));

-- 2) Market Analytics: konsistente Item-/Seller-/Kategoriezuordnung
DROP POLICY IF EXISTS "analytics insert own" ON public.market_analytics_events;
CREATE POLICY "analytics insert own" ON public.market_analytics_events
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND public.market_event_refs_valid(item_id, seller_id, category_id)
  );

-- 3) Posts: Privacy-Logik bei Interaktionen erzwingen
DROP POLICY IF EXISTS comments_insert_own ON public.comments;
CREATE POLICY comments_insert_own ON public.comments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_view_post(post_id));

DROP POLICY IF EXISTS post_likes_insert_own ON public.post_likes;
CREATE POLICY post_likes_insert_own ON public.post_likes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_view_post(post_id));

DROP POLICY IF EXISTS post_saves_insert_own ON public.post_saves;
CREATE POLICY post_saves_insert_own ON public.post_saves
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_view_post(post_id));

DROP POLICY IF EXISTS post_shares_insert_own ON public.post_shares;
CREATE POLICY post_shares_insert_own ON public.post_shares
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_view_post(post_id));

DROP POLICY IF EXISTS post_views_insert_own ON public.post_views;
CREATE POLICY post_views_insert_own ON public.post_views
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_view_post(post_id));