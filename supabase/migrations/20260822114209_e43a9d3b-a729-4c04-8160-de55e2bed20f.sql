REVOKE ALL ON FUNCTION public.globe_vote_ensure_round() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.globe_vote_week_end(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.globe_vote_week_end(timestamptz) TO authenticated, service_role;