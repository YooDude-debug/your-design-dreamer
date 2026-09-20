-- ORB Context Intelligence: additive Erweiterung
CREATE TYPE public.orb_temporal_scope AS ENUM ('persistent','long_term','temporary','one_time');
CREATE TYPE public.orb_lifecycle AS ENUM ('active','weak','stale','archived','forgotten');
CREATE TYPE public.orb_candidate_decision AS ENUM ('accepted','rejected','duplicate','update','contradiction');

ALTER TABLE public.orb_nodes
  ADD COLUMN long_term_value double precision NOT NULL DEFAULT 0.5,
  ADD COLUMN temporal_scope public.orb_temporal_scope NOT NULL DEFAULT 'long_term',
  ADD COLUMN decay_rate double precision NOT NULL DEFAULT 0.05,
  ADD COLUMN lifecycle public.orb_lifecycle NOT NULL DEFAULT 'active',
  ADD COLUMN category text,
  ADD COLUMN source_reference text;

CREATE INDEX IF NOT EXISTS orb_nodes_user_lifecycle_idx ON public.orb_nodes (user_id, lifecycle);

CREATE TABLE public.orb_node_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  node_id uuid NOT NULL REFERENCES public.orb_nodes(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('update','contradiction','forget','reinforcement')),
  previous_value text,
  new_value text,
  previous_lifecycle public.orb_lifecycle,
  new_lifecycle public.orb_lifecycle,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.orb_node_history TO authenticated;
GRANT ALL ON public.orb_node_history TO service_role;
ALTER TABLE public.orb_node_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orb_node_history_own_select" ON public.orb_node_history
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "orb_node_history_own_insert" ON public.orb_node_history
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE INDEX orb_node_history_user_node_idx ON public.orb_node_history (user_id, node_id, created_at DESC);

CREATE TABLE public.orb_candidates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key text NOT NULL,
  value text NOT NULL,
  category text,
  relevance double precision NOT NULL DEFAULT 0,
  long_term_value double precision NOT NULL DEFAULT 0,
  confidence double precision NOT NULL DEFAULT 0,
  temporal_scope public.orb_temporal_scope NOT NULL DEFAULT 'long_term',
  decay_rate double precision NOT NULL DEFAULT 0.05,
  source text NOT NULL DEFAULT 'conversation',
  source_reference text,
  related_node_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  action text NOT NULL DEFAULT 'create_or_update',
  decision public.orb_candidate_decision NOT NULL,
  decision_reason text NOT NULL DEFAULT '',
  node_id uuid REFERENCES public.orb_nodes(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.orb_candidates TO authenticated;
GRANT ALL ON public.orb_candidates TO service_role;
ALTER TABLE public.orb_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orb_candidates_own_select" ON public.orb_candidates
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "orb_candidates_own_insert" ON public.orb_candidates
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "orb_candidates_own_update" ON public.orb_candidates
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX orb_candidates_user_created_idx ON public.orb_candidates (user_id, created_at DESC);
CREATE TRIGGER orb_candidates_set_updated_at BEFORE UPDATE ON public.orb_candidates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();