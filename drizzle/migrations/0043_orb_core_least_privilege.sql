DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['orb_nodes','orb_connections','orb_state','orb_messages','orb_interests','orb_suggestions','orb_metrics']
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', t);
    IF t = 'orb_metrics' THEN
      EXECUTE format('GRANT SELECT, INSERT, DELETE ON TABLE public.%I TO authenticated', t);
    ELSE
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', t);
    END IF;
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
  END LOOP;
END $$;