-- Interne Protokoll-/Warteschlangentabellen: keine Schreibrechte für Clients.
-- Einträge entstehen ausschliesslich über SECURITY DEFINER-Trigger bzw. über
-- vertrauenswuerdige Serverprozesse (service_role).

REVOKE INSERT, UPDATE, DELETE ON public.content_moderation_log FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.counter_events FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.slang_tag_moderation_events FROM anon, authenticated;

REVOKE SELECT ON public.content_moderation_log FROM anon;
REVOKE SELECT ON public.counter_events FROM anon;
REVOKE SELECT ON public.slang_tag_moderation_events FROM anon;

GRANT SELECT ON public.content_moderation_log TO authenticated;
GRANT SELECT ON public.counter_events TO authenticated;
GRANT SELECT ON public.slang_tag_moderation_events TO authenticated;

GRANT ALL ON public.content_moderation_log TO service_role;
GRANT ALL ON public.counter_events TO service_role;
GRANT ALL ON public.slang_tag_moderation_events TO service_role;

-- Ausdrueckliche, immer falsche Schreibregeln: auch bei kuenftig erweiterten
-- Rechten bleibt jeder Schreibversuch aus der App abgelehnt.
DROP POLICY IF EXISTS content_moderation_log_no_client_insert ON public.content_moderation_log;
CREATE POLICY content_moderation_log_no_client_insert
  ON public.content_moderation_log FOR INSERT TO authenticated, anon
  WITH CHECK (false);

DROP POLICY IF EXISTS content_moderation_log_no_client_update ON public.content_moderation_log;
CREATE POLICY content_moderation_log_no_client_update
  ON public.content_moderation_log FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS content_moderation_log_no_client_delete ON public.content_moderation_log;
CREATE POLICY content_moderation_log_no_client_delete
  ON public.content_moderation_log FOR DELETE TO authenticated, anon
  USING (false);

DROP POLICY IF EXISTS counter_events_no_client_insert ON public.counter_events;
CREATE POLICY counter_events_no_client_insert
  ON public.counter_events FOR INSERT TO authenticated, anon
  WITH CHECK (false);

DROP POLICY IF EXISTS counter_events_no_client_update ON public.counter_events;
CREATE POLICY counter_events_no_client_update
  ON public.counter_events FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS counter_events_no_client_delete ON public.counter_events;
CREATE POLICY counter_events_no_client_delete
  ON public.counter_events FOR DELETE TO authenticated, anon
  USING (false);

DROP POLICY IF EXISTS slang_tag_moderation_events_no_client_insert ON public.slang_tag_moderation_events;
CREATE POLICY slang_tag_moderation_events_no_client_insert
  ON public.slang_tag_moderation_events FOR INSERT TO authenticated, anon
  WITH CHECK (false);

DROP POLICY IF EXISTS slang_tag_moderation_events_no_client_update ON public.slang_tag_moderation_events;
CREATE POLICY slang_tag_moderation_events_no_client_update
  ON public.slang_tag_moderation_events FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS slang_tag_moderation_events_no_client_delete ON public.slang_tag_moderation_events;
CREATE POLICY slang_tag_moderation_events_no_client_delete
  ON public.slang_tag_moderation_events FOR DELETE TO authenticated, anon
  USING (false);