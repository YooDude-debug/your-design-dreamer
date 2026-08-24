REVOKE ALL ON public.user_roles FROM anon;
REVOKE ALL ON public.user_roles FROM authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

REVOKE ALL ON public.identity_policy FROM anon;
REVOKE ALL ON public.identity_policy FROM authenticated;
GRANT SELECT, UPDATE ON public.identity_policy TO authenticated;
GRANT ALL ON public.identity_policy TO service_role;