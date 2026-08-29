DO $$
DECLARE r record; q text; c text; stmt text; pat text := 'has_role(( SELECT auth.uid() AS uid), ''admin''::app_role)'; rep text := '(SELECT public.has_role((SELECT auth.uid()), ''admin''::app_role))'; n int := 0;
BEGIN
  FOR r IN
    SELECT tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (tablename, policyname) IN (
        ('arena_awards','arena_awards_manage'),('arena_awards','arena_awards_select'),
        ('arena_challenges','arena_challenges_select'),('arena_challenges','arena_challenges_update'),('arena_challenges','arena_challenges_delete'),
        ('arena_comments','arena_comments_select'),('arena_comments','arena_comments_delete'),
        ('arena_submissions','arena_submissions_select'),('arena_submissions','arena_submissions_delete'),
        ('channel_members','owners delete members'),('channel_members','owners manage members'),('channel_members','owners update members'),
        ('market_ad_campaigns','campaigns own'),('market_ad_campaigns','campaigns update own'),
        ('market_analytics_events','analytics read own scope'),
        ('market_disputes','parties read disputes'),('market_payment_records','parties read payment records'),
        ('market_promotions','own promotions read'),('market_promotions','own promotions update'),
        ('market_refunds','parties read refunds'),
        ('market_seller_profiles','seller profile select own'),('market_seller_profiles','seller profile update own'),
        ('market_shipping','parties read shipping'),('market_transaction_events','parties read events'),('market_transactions','parties read transactions'),
        ('media_variant_jobs','Owners read own variant jobs'),('post_originals','Owner or admin can read originals'),
        ('moderation_actions','moderation_actions_select_own'),('moderation_appeals','moderation_appeals_select_own'),
        ('slang_tag_grants','grants_select_involved'),('slang_tag_likes','slang_tag_likes_select'),('slang_tag_shares','slang_tag_shares_select'),
        ('slang_tag_share_requests','share_requests_select_involved'),('slang_tag_video_uses','slang_tag_video_uses_select_own_or_tag_owner'),
        ('slang_tag_votes','votes_select_own_or_owner'))
  LOOP
    q := replace(coalesce(r.qual, ''), pat, rep);
    c := replace(coalesce(r.with_check, ''), pat, rep);
    IF (r.qual IS NOT NULL AND q = r.qual) AND (r.with_check IS NULL OR c = r.with_check) THEN
      RAISE EXCEPTION 'Kein Admin-Ausdruck gefunden in %.%', r.tablename, r.policyname;
    END IF;
    stmt := format('ALTER POLICY %I ON public.%I', r.policyname, r.tablename);
    IF r.qual IS NOT NULL THEN stmt := stmt || format(' USING (%s)', q); END IF;
    IF r.with_check IS NOT NULL THEN stmt := stmt || format(' WITH CHECK (%s)', c); END IF;
    EXECUTE stmt;
    n := n + 1;
  END LOOP;
  IF n <> 35 THEN RAISE EXCEPTION 'Erwartet 35 Policies, geändert %', n; END IF;
END $$;