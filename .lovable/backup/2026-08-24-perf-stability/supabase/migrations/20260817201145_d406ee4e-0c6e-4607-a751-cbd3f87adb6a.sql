-- 1) Schreibrechte auf Zähl-/Struktur-Tabellen einziehen.
--    Schreibvorgänge laufen ausschließlich über Trigger und
--    SECURITY-DEFINER-Funktionen (z. B. sync_post_hashtags,
--    globe_vote_close_round) bzw. service_role. Da für INSERT/UPDATE/DELETE
--    keine Policy existiert, sind diese Aktionen bereits blockiert – die
--    Rechte werden nur zusätzlich entfernt (keine Funktionsänderung).
REVOKE INSERT, UPDATE, DELETE ON public.hashtags FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.globe_entries FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.globe_vote_rounds FROM anon, authenticated;

-- 2) Lesen: Globe-Daten werden ausschließlich über die Funktionen
--    globe_vote_current_round / slang_tag_definitions gelesen, nie anonym
--    direkt über die Daten-API. Anonymer Direktzugriff wird entfernt,
--    angemeldetes Lesen bleibt unverändert.
REVOKE SELECT ON public.globe_entries FROM anon;
REVOKE SELECT ON public.globe_vote_rounds FROM anon;
REVOKE SELECT ON public.hashtags FROM anon;

DROP POLICY IF EXISTS globe_entries_read ON public.globe_entries;
CREATE POLICY globe_entries_read ON public.globe_entries
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS globe_vote_rounds_read ON public.globe_vote_rounds;
CREATE POLICY globe_vote_rounds_read ON public.globe_vote_rounds
  FOR SELECT TO authenticated USING (true);

GRANT ALL ON public.hashtags TO service_role;
GRANT ALL ON public.globe_entries TO service_role;
GRANT ALL ON public.globe_vote_rounds TO service_role;