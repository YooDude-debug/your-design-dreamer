DROP POLICY IF EXISTS post_shares_select ON public.post_shares;
CREATE POLICY post_shares_select ON public.post_shares
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));