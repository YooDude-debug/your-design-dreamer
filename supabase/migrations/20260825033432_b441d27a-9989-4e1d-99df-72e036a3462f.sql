DROP POLICY IF EXISTS connection_suggestions_select_own ON public.connection_suggestions;
CREATE POLICY connection_suggestions_select_own
ON public.connection_suggestions FOR SELECT TO authenticated
USING (user_id = auth.uid() AND public.test_user_visible(suggested_id));