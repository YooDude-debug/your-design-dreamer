DO $$
DECLARE
  r record;
  new_qual text;
  new_check text;
  stmt text;
  changed int := 0;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        (qual ~ 'auth\.uid\(\)' AND replace(qual, '( SELECT auth.uid() AS uid)', '') ~ 'auth\.uid\(\)')
        OR (with_check ~ 'auth\.uid\(\)' AND replace(with_check, '( SELECT auth.uid() AS uid)', '') ~ 'auth\.uid\(\)')
      )
  LOOP
    new_qual := replace(
      replace(
        replace(coalesce(r.qual,''), '( SELECT auth.uid() AS uid)', '@@WRAPPED@@'),
        'auth.uid()', '(select auth.uid())'),
      '@@WRAPPED@@', '( SELECT auth.uid() AS uid)');

    new_check := replace(
      replace(
        replace(coalesce(r.with_check,''), '( SELECT auth.uid() AS uid)', '@@WRAPPED@@'),
        'auth.uid()', '(select auth.uid())'),
      '@@WRAPPED@@', '( SELECT auth.uid() AS uid)');

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

  RAISE NOTICE 'Block 4: % policies rewritten', changed;
END
$$;