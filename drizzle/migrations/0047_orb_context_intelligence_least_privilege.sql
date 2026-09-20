-- Neue ORB-Tabellen auf denselben Mindestrechte-Stand wie 0043 bringen.
REVOKE ALL ON TABLE public.orb_node_history FROM anon;
REVOKE ALL ON TABLE public.orb_node_history FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.orb_node_history TO authenticated;
GRANT ALL ON TABLE public.orb_node_history TO service_role;

REVOKE ALL ON TABLE public.orb_candidates FROM anon;
REVOKE ALL ON TABLE public.orb_candidates FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.orb_candidates TO authenticated;
GRANT ALL ON TABLE public.orb_candidates TO service_role;