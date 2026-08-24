-- Trigger-Hilfsfunktion: darf nie direkt über die API aufrufbar sein
REVOKE ALL ON FUNCTION public.enforce_arena_challenge_identity() FROM PUBLIC, anon, authenticated;

-- Drop-Prüfung: nur angemeldete Nutzer und Serverprozesse
REVOKE ALL ON FUNCTION public.is_slang_tag_grant_active(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_slang_tag_grant_active(uuid) TO authenticated, service_role;