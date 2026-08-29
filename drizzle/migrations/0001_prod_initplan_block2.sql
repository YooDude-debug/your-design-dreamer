-- Block 2: InitPlan-Wrapping auth.uid() -> (select auth.uid())
-- Alle Vorkommen stehen in Skalar- oder Funktionsargument-Position (STABLE), daher semantisch identisch.

-- ===== slang_tags =====
ALTER POLICY "slang_tags_select" ON public.slang_tags
  USING (((select auth.uid()) = owner_id) OR ((select auth.uid()) = creator_id) OR has_role((select auth.uid()), 'admin'::app_role)
         OR ((deleted_at IS NULL) AND (moderation_status = 'approved'::moderation_status) AND test_user_visible(creator_id) AND test_user_visible(owner_id)));
ALTER POLICY "slang_tags_insert_own" ON public.slang_tags WITH CHECK (((select auth.uid()) = creator_id) AND ((select auth.uid()) = owner_id));
ALTER POLICY "slang_tags_update_own" ON public.slang_tags
  USING (((select auth.uid()) = owner_id) OR ((select auth.uid()) = creator_id))
  WITH CHECK (((select auth.uid()) = owner_id) OR ((select auth.uid()) = creator_id));
ALTER POLICY "slang_tags_delete_own" ON public.slang_tags USING (((select auth.uid()) = owner_id) OR ((select auth.uid()) = creator_id));
ALTER POLICY "slang_tags_delete_admin" ON public.slang_tags USING (has_role((select auth.uid()), 'admin'::app_role));

-- ===== slang_tag_likes =====
ALTER POLICY "slang_tag_likes_select" ON public.slang_tag_likes
  USING ((user_id = (select auth.uid())) OR owns_slang_tag(tag_id) OR has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "slang_tag_likes_insert_own" ON public.slang_tag_likes WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "slang_tag_likes_delete_own" ON public.slang_tag_likes USING ((select auth.uid()) = user_id);

-- ===== slang_tag_saves =====
ALTER POLICY "slang_tag_saves_select" ON public.slang_tag_saves USING ((select auth.uid()) = user_id);
ALTER POLICY "slang_tag_saves_insert_own" ON public.slang_tag_saves WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "slang_tag_saves_delete_own" ON public.slang_tag_saves USING ((select auth.uid()) = user_id);

-- ===== slang_tag_plays =====
ALTER POLICY "slang_tag_plays_select" ON public.slang_tag_plays USING ((select auth.uid()) = user_id);
ALTER POLICY "slang_tag_plays_insert_own" ON public.slang_tag_plays WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "slang_tag_plays_delete_own" ON public.slang_tag_plays USING ((select auth.uid()) = user_id);

-- ===== slang_tag_shares =====
ALTER POLICY "slang_tag_shares_select" ON public.slang_tag_shares
  USING ((user_id = (select auth.uid())) OR owns_slang_tag(tag_id) OR has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "slang_tag_shares_insert_own" ON public.slang_tag_shares WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "slang_tag_shares_delete_own" ON public.slang_tag_shares USING ((select auth.uid()) = user_id);

-- ===== slang_tag_votes =====
ALTER POLICY "votes_select_own_or_owner" ON public.slang_tag_votes
  USING ((user_id = (select auth.uid())) OR owns_slang_tag(tag_id) OR has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "slang_tag_votes_insert" ON public.slang_tag_votes
  WITH CHECK ((user_id = (select auth.uid())) AND EXISTS (
    SELECT 1 FROM public.slang_tags t
    WHERE t.id = slang_tag_votes.tag_id AND t.kind = 'community'::slang_tag_kind AND t.deleted_at IS NULL
      AND t.owner_id <> (select auth.uid()) AND t.creator_id <> (select auth.uid())));
ALTER POLICY "slang_tag_votes_update" ON public.slang_tag_votes
  USING ((user_id = (select auth.uid())) AND is_community_tag(tag_id) AND (NOT owns_slang_tag(tag_id)))
  WITH CHECK ((user_id = (select auth.uid())) AND is_community_tag(tag_id) AND (NOT owns_slang_tag(tag_id)));
ALTER POLICY "votes_delete_own" ON public.slang_tag_votes USING (user_id = (select auth.uid()));

-- ===== slang_tag_grants =====
ALTER POLICY "grants_select_involved" ON public.slang_tag_grants
  USING ((owner_id = (select auth.uid())) OR (grantee_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "grants_insert_owner" ON public.slang_tag_grants
  WITH CHECK ((granted_by = (select auth.uid())) AND (grantee_id <> (select auth.uid())) AND owns_slang_tag(tag_id)
    AND EXISTS (SELECT 1 FROM public.slang_tags t WHERE t.id = slang_tag_grants.tag_id AND t.owner_id = slang_tag_grants.owner_id));
ALTER POLICY "grants_delete_owner_or_grantee" ON public.slang_tag_grants
  USING ((owner_id = (select auth.uid())) OR (grantee_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role));

-- ===== slang_tag_share_requests =====
ALTER POLICY "share_requests_select_involved" ON public.slang_tag_share_requests
  USING ((owner_id = (select auth.uid())) OR (requester_id = (select auth.uid())) OR (target_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "share_requests_insert_holder" ON public.slang_tag_share_requests
  WITH CHECK ((requester_id = (select auth.uid())) AND (target_id <> (select auth.uid())) AND (status = 'pending'::share_request_status)
    AND has_slang_tag_grant(tag_id, (select auth.uid()))
    AND EXISTS (SELECT 1 FROM public.slang_tags t WHERE t.id = slang_tag_share_requests.tag_id AND t.owner_id = slang_tag_share_requests.owner_id));
ALTER POLICY "share_requests_update_owner" ON public.slang_tag_share_requests
  USING ((owner_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK ((owner_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role));

-- ===== slang_tag_video_uses / moderation events =====
ALTER POLICY "slang_tag_video_uses_select_own_or_tag_owner" ON public.slang_tag_video_uses
  USING (((select auth.uid()) = user_id)
    OR EXISTS (SELECT 1 FROM public.slang_tags t WHERE t.id = slang_tag_video_uses.tag_id AND (t.owner_id = (select auth.uid()) OR t.creator_id = (select auth.uid())))
    OR has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "slang_tag_moderation_events_select_admin" ON public.slang_tag_moderation_events
  USING (has_role((select auth.uid()), 'admin'::app_role));

-- ===== chat_slang_tags =====
ALTER POLICY "chat_slang_tags_select_members" ON public.chat_slang_tags USING (is_conversation_member(conversation_id, (select auth.uid())));
ALTER POLICY "chat_slang_tags_insert_own" ON public.chat_slang_tags
  WITH CHECK ((creator_id = (select auth.uid())) AND is_conversation_member(conversation_id, (select auth.uid())));

-- ===== slang_definitions =====
ALTER POLICY "slang_definitions_insert" ON public.slang_definitions
  WITH CHECK (owns_slang_name(normalized_name) OR has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "slang_definitions_update" ON public.slang_definitions
  USING (owns_slang_name(normalized_name) OR has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (owns_slang_name(normalized_name) OR has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "slang_definition_translations_write" ON public.slang_definition_translations
  WITH CHECK (EXISTS (SELECT 1 FROM public.slang_definitions d
    WHERE d.id = slang_definition_translations.definition_id AND (owns_slang_name(d.normalized_name) OR has_role((select auth.uid()), 'admin'::app_role))));
ALTER POLICY "slang_definition_translations_update" ON public.slang_definition_translations
  USING (EXISTS (SELECT 1 FROM public.slang_definitions d
    WHERE d.id = slang_definition_translations.definition_id AND (owns_slang_name(d.normalized_name) OR has_role((select auth.uid()), 'admin'::app_role))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.slang_definitions d
    WHERE d.id = slang_definition_translations.definition_id AND (owns_slang_name(d.normalized_name) OR has_role((select auth.uid()), 'admin'::app_role))));

-- ===== arena_challenges =====
ALTER POLICY "arena_challenges_select" ON public.arena_challenges
  USING ((status <> 'draft'::arena_challenge_status) OR (company_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "arena_challenges_insert" ON public.arena_challenges
  WITH CHECK ((company_id = (select auth.uid())) AND can_create_arena_challenge((select auth.uid())));
ALTER POLICY "arena_challenges_update" ON public.arena_challenges
  USING ((company_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK ((company_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "arena_challenges_delete" ON public.arena_challenges
  USING ((company_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role));

-- ===== arena_submissions =====
ALTER POLICY "arena_submissions_select" ON public.arena_submissions
  USING ((creator_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role)
         OR (is_arena_challenge_visible(challenge_id) AND test_user_visible(creator_id)));
ALTER POLICY "arena_submissions_insert" ON public.arena_submissions
  WITH CHECK ((creator_id = (select auth.uid())) AND owns_slang_tag(tag_id)
    AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'business'::app_role) OR has_role((select auth.uid()), 'creator'::app_role))
    AND is_arena_challenge_visible(challenge_id)
    AND EXISTS (SELECT 1 FROM public.arena_challenges c
      WHERE c.id = arena_submissions.challenge_id AND c.status = 'active'::arena_challenge_status AND (c.ends_at IS NULL OR c.ends_at > now())));
ALTER POLICY "arena_submissions_delete" ON public.arena_submissions
  USING ((creator_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role));

-- ===== arena_comments =====
ALTER POLICY "arena_comments_select" ON public.arena_comments
  USING (has_role((select auth.uid()), 'admin'::app_role) OR can_see_arena_submission(submission_id));
ALTER POLICY "arena_comments_insert" ON public.arena_comments
  WITH CHECK ((user_id = (select auth.uid())) AND can_see_arena_submission(submission_id));
ALTER POLICY "arena_comments_delete" ON public.arena_comments
  USING ((user_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role));

-- ===== arena_likes / plays / votes =====
ALTER POLICY "arena_likes_select" ON public.arena_likes
  USING (((user_id = (select auth.uid())) AND can_see_arena_submission(submission_id)) OR can_see_arena_engagement(submission_id));
ALTER POLICY "arena_likes_insert" ON public.arena_likes
  WITH CHECK ((user_id = (select auth.uid())) AND can_see_arena_submission(submission_id));
ALTER POLICY "arena_likes_delete" ON public.arena_likes USING (user_id = (select auth.uid()));
ALTER POLICY "arena_plays_select" ON public.arena_plays
  USING (((user_id = (select auth.uid())) AND can_see_arena_submission(submission_id)) OR can_see_arena_engagement(submission_id));
ALTER POLICY "arena_plays_insert" ON public.arena_plays
  WITH CHECK ((user_id = (select auth.uid())) AND can_see_arena_submission(submission_id));
ALTER POLICY "arena_votes_select" ON public.arena_votes
  USING (((user_id = (select auth.uid())) AND can_see_arena_submission(submission_id)) OR can_see_arena_engagement(submission_id));
ALTER POLICY "arena_votes_insert" ON public.arena_votes
  WITH CHECK ((user_id = (select auth.uid())) AND can_see_arena_submission(submission_id));
ALTER POLICY "arena_votes_delete" ON public.arena_votes USING (user_id = (select auth.uid()));

-- ===== arena_awards =====
ALTER POLICY "arena_awards_select" ON public.arena_awards
  USING (has_role((select auth.uid()), 'admin'::app_role)
         OR (is_arena_challenge_visible(challenge_id) AND ((submission_id IS NULL) OR can_see_arena_submission(submission_id))));
ALTER POLICY "arena_awards_manage" ON public.arena_awards
  USING (has_role((select auth.uid()), 'admin'::app_role)
         OR EXISTS (SELECT 1 FROM public.arena_challenges c WHERE c.id = arena_awards.challenge_id AND c.company_id = (select auth.uid())))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role)
         OR EXISTS (SELECT 1 FROM public.arena_challenges c WHERE c.id = arena_awards.challenge_id AND c.company_id = (select auth.uid())));

-- ===== Feed-Signale =====
ALTER POLICY "own feed signals read" ON public.feed_signals USING ((select auth.uid()) = user_id);
ALTER POLICY "own feed signals insert" ON public.feed_signals WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "own feed signals delete" ON public.feed_signals USING ((select auth.uid()) = user_id);
ALTER POLICY "own feed score cache" ON public.feed_score_cache USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "own feed weights" ON public.feed_learned_weights USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- ===== profiles / follows / hashtag_follows =====
ALTER POLICY "profiles_select" ON public.profiles
  USING (((select auth.uid()) = id) OR has_role((select auth.uid()), 'admin'::app_role) OR can_view_profile(id));
ALTER POLICY "profiles_insert_own" ON public.profiles WITH CHECK ((select auth.uid()) = id);
ALTER POLICY "profiles_update_own" ON public.profiles USING ((select auth.uid()) = id) WITH CHECK ((select auth.uid()) = id);
ALTER POLICY "follows_select" ON public.follows USING (((select auth.uid()) = follower_id) OR ((select auth.uid()) = following_id));
ALTER POLICY "follows_insert_own" ON public.follows WITH CHECK ((select auth.uid()) = follower_id);
ALTER POLICY "follows_delete_own" ON public.follows USING ((select auth.uid()) = follower_id);
ALTER POLICY "hashtag_follows_select_own" ON public.hashtag_follows USING (user_id = (select auth.uid()));
ALTER POLICY "hashtag_follows_insert_own" ON public.hashtag_follows WITH CHECK (user_id = (select auth.uid()));
ALTER POLICY "hashtag_follows_delete_own" ON public.hashtag_follows USING (user_id = (select auth.uid()));