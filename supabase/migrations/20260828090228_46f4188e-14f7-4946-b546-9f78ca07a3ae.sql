-- Ursache: public.comments_select gilt für Rolle PUBLIC (also auch anon bzw.
-- abgelaufene Sitzungen, die PostgREST auf anon zurückfällt). Die Policy ruft
-- public.can_view_post() auf, deren EXECUTE-Recht anon entzogen wurde
-- (Migration 20260801124755). Ergebnis: "permission denied for function
-- can_view_post" statt einer leeren Ergebnismenge.
--
-- Fix: EXECUTE für anon erlauben. Die Funktion ist SECURITY DEFINER mit
-- festem search_path, ohne dynamisches SQL, und gibt ausschließlich boolean
-- zurück. Sie liefert für anon (auth.uid() IS NULL) nur true bei öffentlichen,
-- nicht verborgenen Beiträgen sichtbarer Autoren – die RLS-Semantik bleibt
-- unverändert.

-- Definition unverändert neu setzen (Dokumentation der aktuellen Fassung,
-- inkl. explizitem search_path).
CREATE OR REPLACE FUNCTION public.can_view_post(_post_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = _post_id
      AND (p.hidden_at IS NULL OR p.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
      AND public.test_user_visible(p.user_id)
      AND (
        p.visibility = 'public'
        OR p.user_id = auth.uid()
        OR (p.visibility = 'connections' AND public.are_connected(auth.uid(), p.user_id))
        OR (p.visibility = 'following' AND public.is_following(p.user_id, auth.uid()))
      )
  )
$$;

REVOKE ALL ON FUNCTION public.can_view_post(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_post(uuid) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.can_view_post(uuid) IS
  'Sichtbarkeitsprüfung für Beiträge (nur boolean). Für anon/abgelaufene Sitzungen true ausschließlich bei öffentlichen, nicht verborgenen Beiträgen sichtbarer Autoren.';
