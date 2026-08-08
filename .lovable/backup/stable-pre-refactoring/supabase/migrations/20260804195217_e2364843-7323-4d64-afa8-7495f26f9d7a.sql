-- Feed-Algorithmus 2.0: gelernte Gewichte, Signal-Log und Score-Cache

CREATE TABLE public.feed_learned_weights (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key text NOT NULL,
  weight numeric NOT NULL DEFAULT 0,
  events_count integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_learned_weights TO authenticated;
GRANT ALL ON public.feed_learned_weights TO service_role;
ALTER TABLE public.feed_learned_weights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own feed weights" ON public.feed_learned_weights FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.feed_signals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid,
  author_id uuid,
  signal text NOT NULL,
  value numeric NOT NULL DEFAULT 1,
  dwell_ms integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.feed_signals TO authenticated;
GRANT ALL ON public.feed_signals TO service_role;
ALTER TABLE public.feed_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own feed signals read" ON public.feed_signals FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "own feed signals insert" ON public.feed_signals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own feed signals delete" ON public.feed_signals FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
CREATE INDEX feed_signals_user_created_idx ON public.feed_signals (user_id, created_at DESC);
CREATE INDEX feed_signals_post_idx ON public.feed_signals (post_id);

CREATE TABLE public.feed_score_cache (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL,
  score numeric NOT NULL DEFAULT 0,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_score_cache TO authenticated;
GRANT ALL ON public.feed_score_cache TO service_role;
ALTER TABLE public.feed_score_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own feed score cache" ON public.feed_score_cache FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX feed_score_cache_user_score_idx ON public.feed_score_cache (user_id, score DESC);