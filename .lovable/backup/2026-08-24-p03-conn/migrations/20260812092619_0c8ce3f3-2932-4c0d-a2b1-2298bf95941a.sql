GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.slang_tags TO authenticated;
GRANT ALL ON public.slang_tags TO service_role;

GRANT SELECT ON public.account_security_events TO authenticated;
GRANT ALL ON public.account_security_events TO service_role;

GRANT SELECT ON public.newsletter_subscribers TO authenticated;
GRANT INSERT ON public.newsletter_subscribers TO anon, authenticated;
GRANT ALL ON public.newsletter_subscribers TO service_role;