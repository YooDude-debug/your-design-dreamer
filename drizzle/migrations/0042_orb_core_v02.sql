-- ORB Core V0.2 – rein additiv.

CREATE TYPE public.orb_info_source AS ENUM ('user_stated', 'observed', 'inferred');
CREATE TYPE public.orb_suggestion_status AS ENUM ('pending', 'shown', 'accepted', 'rejected');

-- 1. Erinnerungen: Herkunft, Normalisierungsschlüssel, Thema
ALTER TABLE public.orb_nodes
  ADD COLUMN source public.orb_info_source NOT NULL DEFAULT 'user_stated',
  ADD COLUMN norm_key text,
  ADD COLUMN topic text;

CREATE UNIQUE INDEX orb_nodes_user_norm_key_uidx
  ON public.orb_nodes (user_id, norm_key) WHERE norm_key IS NOT NULL;
CREATE INDEX orb_nodes_user_topic_idx ON public.orb_nodes (user_id, topic) WHERE topic IS NOT NULL;
CREATE INDEX orb_nodes_user_importance_idx
  ON public.orb_nodes (user_id, importance DESC, last_accessed_at DESC);

-- 2. Verbindungen: keine Duplikate, relevanzbasierter Abruf
CREATE UNIQUE INDEX orb_connections_user_pair_uidx
  ON public.orb_connections (user_id, source_node_id, target_node_id);
CREATE INDEX orb_connections_user_weight_idx
  ON public.orb_connections (user_id, weight DESC, last_activated_at DESC);

-- 3. Interessenmodell
CREATE TABLE public.orb_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  topic text NOT NULL,
  weight double precision NOT NULL DEFAULT 0.2,
  confidence double precision NOT NULL DEFAULT 0.5,
  source public.orb_info_source NOT NULL DEFAULT 'inferred',
  activation_count integer NOT NULL DEFAULT 1,
  last_activated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orb_interests_user_topic_key UNIQUE (user_id, topic),
  CONSTRAINT orb_interests_weight_range CHECK (weight >= 0 AND weight <= 1),
  CONSTRAINT orb_interests_confidence_range CHECK (confidence >= 0 AND confidence <= 1)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orb_interests TO authenticated;
GRANT ALL ON public.orb_interests TO service_role;
ALTER TABLE public.orb_interests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orb_interests_own" ON public.orb_interests
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX orb_interests_user_weight_idx ON public.orb_interests (user_id, weight DESC);
CREATE TRIGGER orb_interests_set_updated_at
  BEFORE UPDATE ON public.orb_interests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Vorschläge (nur beobachten + vorschlagen, keine autonomen Aktionen)
CREATE TABLE public.orb_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  topic text,
  reason text NOT NULL,
  relevance double precision NOT NULL DEFAULT 0,
  status public.orb_suggestion_status NOT NULL DEFAULT 'pending',
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orb_suggestions_user_post_key UNIQUE (user_id, post_id),
  CONSTRAINT orb_suggestions_relevance_range CHECK (relevance >= 0 AND relevance <= 1)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orb_suggestions TO authenticated;
GRANT ALL ON public.orb_suggestions TO service_role;
ALTER TABLE public.orb_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orb_suggestions_own" ON public.orb_suggestions
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX orb_suggestions_user_status_idx
  ON public.orb_suggestions (user_id, status, relevance DESC);
CREATE TRIGGER orb_suggestions_set_updated_at
  BEFORE UPDATE ON public.orb_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Messwerte je Interaktion
CREATE TABLE public.orb_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'turn',
  retrieval_ms integer NOT NULL DEFAULT 0,
  relevance_ms integer NOT NULL DEFAULT 0,
  ai_ms integer NOT NULL DEFAULT 0,
  total_ms integer NOT NULL DEFAULT 0,
  nodes_loaded integer NOT NULL DEFAULT 0,
  connections_loaded integer NOT NULL DEFAULT 0,
  db_queries integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.orb_metrics TO authenticated;
GRANT ALL ON public.orb_metrics TO service_role;
ALTER TABLE public.orb_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orb_metrics_own" ON public.orb_metrics
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX orb_metrics_user_created_idx ON public.orb_metrics (user_id, created_at DESC);