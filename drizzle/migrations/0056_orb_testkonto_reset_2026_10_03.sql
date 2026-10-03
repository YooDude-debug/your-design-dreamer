DO $$
DECLARE u constant uuid := '9ce1d1b0-7481-4cb0-aedf-5291dae67297';
BEGIN
  DELETE FROM public.orb_memory_images WHERE user_id = u;
  DELETE FROM public.orb_connections WHERE user_id = u;
  DELETE FROM public.orb_node_history WHERE user_id = u;
  DELETE FROM public.orb_candidates WHERE user_id = u;
  DELETE FROM public.orb_nodes WHERE user_id = u;
  DELETE FROM public.orb_message_telemetry WHERE user_id = u;
  DELETE FROM public.orb_messages WHERE user_id = u;
  DELETE FROM public.orb_threads WHERE user_id = u;
  DELETE FROM public.orb_questions WHERE user_id = u;
  DELETE FROM public.orb_interests WHERE user_id = u;
  DELETE FROM public.orb_metrics WHERE user_id = u;
  DELETE FROM public.orb_suggestions WHERE user_id = u;
END $$;