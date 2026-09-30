-- ORB Scope-Trennung: feste Bereiche, bestehende Daten = unassigned.
CREATE TYPE public.orb_scope AS ENUM ('unassigned', 'normal', 'orb_core', 'y_dude');

ALTER TABLE public.orb_messages   ADD COLUMN scope public.orb_scope NOT NULL DEFAULT 'unassigned';
ALTER TABLE public.orb_nodes      ADD COLUMN scope public.orb_scope NOT NULL DEFAULT 'unassigned';
ALTER TABLE public.orb_connections ADD COLUMN scope public.orb_scope NOT NULL DEFAULT 'unassigned';
ALTER TABLE public.orb_threads    ADD COLUMN scope public.orb_scope NOT NULL DEFAULT 'unassigned';
ALTER TABLE public.orb_questions  ADD COLUMN scope public.orb_scope NOT NULL DEFAULT 'unassigned';
ALTER TABLE public.orb_interests  ADD COLUMN scope public.orb_scope NOT NULL DEFAULT 'unassigned';
ALTER TABLE public.orb_candidates ADD COLUMN scope public.orb_scope NOT NULL DEFAULT 'unassigned';

-- Eindeutigkeit je Bereich (neu anlegen, dann alte entfernen).
CREATE UNIQUE INDEX orb_nodes_user_scope_norm_key_uidx
  ON public.orb_nodes (user_id, scope, norm_key) WHERE norm_key IS NOT NULL;
DROP INDEX public.orb_nodes_user_norm_key_uidx;

CREATE UNIQUE INDEX orb_threads_user_scope_title_idx
  ON public.orb_threads (user_id, scope, lower(title));
DROP INDEX public.orb_threads_user_title_idx;

ALTER TABLE public.orb_interests
  ADD CONSTRAINT orb_interests_user_scope_topic_key UNIQUE (user_id, scope, topic);
ALTER TABLE public.orb_interests DROP CONSTRAINT orb_interests_user_topic_key;

-- Arbeitsindizes.
CREATE INDEX orb_nodes_user_scope_topic_idx ON public.orb_nodes (user_id, scope, topic);
CREATE INDEX orb_nodes_user_scope_importance_idx
  ON public.orb_nodes (user_id, scope, importance DESC, last_accessed_at DESC);
CREATE INDEX orb_nodes_user_scope_accessed_idx
  ON public.orb_nodes (user_id, scope, last_accessed_at DESC);
CREATE INDEX orb_messages_user_scope_created_idx
  ON public.orb_messages (user_id, scope, created_at DESC);
CREATE INDEX orb_connections_user_scope_weight_idx
  ON public.orb_connections (user_id, scope, weight DESC);
CREATE INDEX orb_threads_user_scope_activity_idx
  ON public.orb_threads (user_id, scope, last_activation_at DESC);
CREATE INDEX orb_questions_user_scope_open_idx
  ON public.orb_questions (user_id, scope, answered, asked_at DESC);
CREATE INDEX orb_interests_user_scope_weight_idx
  ON public.orb_interests (user_id, scope, weight DESC);

-- Verbindung nur zwischen Knoten desselben Bereichs.
CREATE OR REPLACE FUNCTION public.orb_guard_connection_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.orb_nodes n
    WHERE n.id IN (NEW.source_node_id, NEW.target_node_id)
      AND n.scope <> NEW.scope
  ) THEN
    RAISE EXCEPTION 'orb_connections: scope mismatch';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER orb_connections_scope_guard
  BEFORE INSERT OR UPDATE OF scope, source_node_id, target_node_id ON public.orb_connections
  FOR EACH ROW EXECUTE FUNCTION public.orb_guard_connection_scope();
