-- Least privilege: interne Dedup-Tabelle wird ausschliesslich von
-- SECURITY-DEFINER-Funktionen (track_slang_tag_click/reach) beschrieben.
REVOKE ALL ON public.slang_tag_track_dedup FROM anon;
REVOKE ALL ON public.slang_tag_track_dedup FROM authenticated;
GRANT ALL ON public.slang_tag_track_dedup TO service_role;

-- anon hat auf Kommentare/Nachrichten faktisch nie Zeilen erhalten
-- (RLS + can_view_post = false ohne Anmeldung). Grants entfernen.
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.comments FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.messages FROM anon;

-- Direkt aufrufbare Prüf-Hilfsfunktionen fuer anon sperren (Informationsabfluss:
-- Adminstatus, Folgen-/Verbindungsgraph). Fuer angemeldete Nutzer unveraendert.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.are_connected(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_following(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_view_post(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.test_user_visible(uuid) FROM anon;

-- Trigger-Hilfsfunktionen brauchen kein EXECUTE fuer anon (Trigger laufen
-- ohne EXECUTE-Pruefung des aufrufenden Rollennamens).
REVOKE EXECUTE ON FUNCTION public.guard_connection_update() FROM anon;
REVOKE EXECUTE ON FUNCTION public.guard_profile_identity() FROM anon;
REVOKE EXECUTE ON FUNCTION public.guard_profile_internal_fields() FROM anon;
REVOKE EXECUTE ON FUNCTION public.guard_reserved_username() FROM anon;
REVOKE EXECUTE ON FUNCTION public.guard_slang_tag_identity() FROM anon;
REVOKE EXECUTE ON FUNCTION public.reserved_usernames_normalize() FROM anon;