DO $$
DECLARE
  r record;
  new_qual text;
  new_check text;
  stmt text;
  changed int := 0;
  tbls text[] := ARRAY[
    'channels','channel_follows','channel_members','channel_bans','channel_categories',
    'messages','message_translations','conversations','conversation_members',
    'connections','notifications','notification_jobs','push_subscriptions',
    'market_items','market_offers','market_promotions','market_seller_profiles',
    'market_ad_campaigns','market_favorites','market_images','market_searches',
    'market_item_channels','market_item_slang_tags'
  ];
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY(tbls)
      AND (qual ~ 'auth\.uid\(\)' OR with_check ~ 'auth\.uid\(\)')
      AND (coalesce(qual,'') || coalesce(with_check,'')) !~ 'SELECT auth\.uid\(\)'
  LOOP
    new_qual := replace(coalesce(r.qual,''), 'auth.uid()', '(select auth.uid())');
    new_check := replace(coalesce(r.with_check,''), 'auth.uid()', '(select auth.uid())');

    stmt := format('ALTER POLICY %I ON public.%I', r.policyname, r.tablename);
    IF r.qual IS NOT NULL THEN
      stmt := stmt || format(' USING (%s)', new_qual);
    END IF;
    IF r.with_check IS NOT NULL THEN
      stmt := stmt || format(' WITH CHECK (%s)', new_check);
    END IF;

    EXECUTE stmt;
    changed := changed + 1;
  END LOOP;

  RAISE NOTICE 'Block 3: % policies rewritten', changed;
END
$$;