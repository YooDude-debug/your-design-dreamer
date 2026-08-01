-- 1. Lock down SECURITY DEFINER function execution
REVOKE ALL ON FUNCTION public.enforce_slang_tag_kind() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_following(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_use_slang_tag(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_following(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_use_slang_tag(uuid, uuid) TO authenticated;

-- 2. content_categories: owner is mandatory and defaults to the caller
DELETE FROM public.content_categories WHERE owner_id IS NULL;
ALTER TABLE public.content_categories ALTER COLUMN owner_id SET DEFAULT auth.uid();
ALTER TABLE public.content_categories ALTER COLUMN owner_id SET NOT NULL;

-- 3. test_accounts: explicit admin-only write policies
DROP POLICY IF EXISTS test_accounts_insert_admin ON public.test_accounts;
CREATE POLICY test_accounts_insert_admin ON public.test_accounts
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS test_accounts_update_admin ON public.test_accounts;
CREATE POLICY test_accounts_update_admin ON public.test_accounts
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));