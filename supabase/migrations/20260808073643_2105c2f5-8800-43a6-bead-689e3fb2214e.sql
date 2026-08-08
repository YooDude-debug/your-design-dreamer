ALTER TABLE public.test_bot_settings
  ADD COLUMN IF NOT EXISTS live_test boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS post_interval_minutes integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS ad_frequency integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS last_live_run_at timestamptz;

GRANT SELECT (id, enabled, running, bot_count, live_test, post_interval_minutes, ad_frequency, last_live_run_at, created_at, updated_at) ON public.test_bot_settings TO authenticated;

CREATE TABLE IF NOT EXISTS public.ad_test_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  ad_id text NOT NULL DEFAULT '',
  feed_position integer NOT NULL DEFAULT 0,
  interactions integer NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ad_test_events TO authenticated;
GRANT ALL ON public.ad_test_events TO service_role;

ALTER TABLE public.ad_test_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ad_test_events_insert_own" ON public.ad_test_events
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "ad_test_events_select_own" ON public.ad_test_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "ad_test_events_select_admin" ON public.ad_test_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "ad_test_events_delete_admin" ON public.ad_test_events
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS ad_test_events_created_idx ON public.ad_test_events (created_at DESC);
CREATE INDEX IF NOT EXISTS ad_test_events_kind_idx ON public.ad_test_events (kind, created_at DESC);