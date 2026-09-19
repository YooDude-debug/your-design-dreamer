-- ORB Core: Gedächtnisnetz, Zustand, Verlauf.
CREATE TYPE public.orb_node_type AS ENUM
  ('fact','emotion','memory','action','perception','decision','goal');

CREATE TABLE public.orb_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.orb_node_type NOT NULL DEFAULT 'memory',
  content text NOT NULL,
  importance double precision NOT NULL DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
  confidence double precision NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  activation_count integer NOT NULL DEFAULT 0,
  last_accessed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orb_nodes TO authenticated;
GRANT ALL ON public.orb_nodes TO service_role;
ALTER TABLE public.orb_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orb_nodes_own" ON public.orb_nodes FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX orb_nodes_user_type_idx ON public.orb_nodes (user_id, type);
CREATE INDEX orb_nodes_user_accessed_idx ON public.orb_nodes (user_id, last_accessed_at DESC);

-- Gehört ein Knoten dem angegebenen Benutzer? (Für die Verbindungsprüfung.)
CREATE OR REPLACE FUNCTION public.orb_owns_node(_node_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.orb_nodes WHERE id = _node_id AND user_id = _user_id)
$$;
REVOKE EXECUTE ON FUNCTION public.orb_owns_node(uuid, uuid) FROM anon;

CREATE TABLE public.orb_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_node_id uuid NOT NULL REFERENCES public.orb_nodes(id) ON DELETE CASCADE,
  target_node_id uuid NOT NULL REFERENCES public.orb_nodes(id) ON DELETE CASCADE,
  weight double precision NOT NULL DEFAULT 0.5 CHECK (weight >= 0 AND weight <= 1),
  importance double precision NOT NULL DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
  decay_rate double precision NOT NULL DEFAULT 0.05 CHECK (decay_rate >= 0),
  activation_count integer NOT NULL DEFAULT 0,
  last_activated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orb_connections_no_self CHECK (source_node_id <> target_node_id),
  CONSTRAINT orb_connections_unique UNIQUE (user_id, source_node_id, target_node_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orb_connections TO authenticated;
GRANT ALL ON public.orb_connections TO service_role;
ALTER TABLE public.orb_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orb_connections_own" ON public.orb_connections FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND public.orb_owns_node(source_node_id, auth.uid())
    AND public.orb_owns_node(target_node_id, auth.uid())
  );
CREATE INDEX orb_connections_user_activated_idx
  ON public.orb_connections (user_id, last_activated_at DESC);
CREATE INDEX orb_connections_source_idx ON public.orb_connections (source_node_id);
CREATE INDEX orb_connections_target_idx ON public.orb_connections (target_node_id);

CREATE TABLE public.orb_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  curiosity double precision NOT NULL DEFAULT 0.6 CHECK (curiosity >= 0 AND curiosity <= 1),
  joy double precision NOT NULL DEFAULT 0.5 CHECK (joy >= 0 AND joy <= 1),
  fear double precision NOT NULL DEFAULT 0.08 CHECK (fear >= 0 AND fear <= 1),
  trust double precision NOT NULL DEFAULT 0.4 CHECK (trust >= 0 AND trust <= 1),
  uncertainty double precision NOT NULL DEFAULT 0.3 CHECK (uncertainty >= 0 AND uncertainty <= 1),
  energy double precision NOT NULL DEFAULT 0.8 CHECK (energy >= 0 AND energy <= 1),
  goals jsonb NOT NULL DEFAULT '["help_user"]'::jsonb,
  cracks integer NOT NULL DEFAULT 0,
  reactivation_count integer NOT NULL DEFAULT 0,
  decay_computations integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orb_state TO authenticated;
GRANT ALL ON public.orb_state TO service_role;
ALTER TABLE public.orb_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orb_state_own" ON public.orb_state FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.orb_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','orb')),
  body text NOT NULL,
  decision text,
  state_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orb_messages TO authenticated;
GRANT ALL ON public.orb_messages TO service_role;
ALTER TABLE public.orb_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orb_messages_own" ON public.orb_messages FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX orb_messages_user_created_idx ON public.orb_messages (user_id, created_at DESC);

CREATE TRIGGER orb_nodes_updated_at BEFORE UPDATE ON public.orb_nodes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER orb_connections_updated_at BEFORE UPDATE ON public.orb_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER orb_state_updated_at BEFORE UPDATE ON public.orb_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();