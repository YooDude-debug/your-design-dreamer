-- SEC-04: Arena counters must start at 0; only server-side counter functions change them.
CREATE OR REPLACE FUNCTION public.arena_submissions_reset_counters()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.votes_count := 0;
  NEW.likes_count := 0;
  NEW.plays_count := 0;
  NEW.comments_count := 0;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS arena_submissions_reset_counters ON public.arena_submissions;
CREATE TRIGGER arena_submissions_reset_counters
  BEFORE INSERT ON public.arena_submissions
  FOR EACH ROW EXECUTE FUNCTION public.arena_submissions_reset_counters();

REVOKE INSERT ON public.arena_submissions FROM anon, authenticated;
GRANT INSERT (id, challenge_id, creator_id, tag_id, pitch, created_at, updated_at)
  ON public.arena_submissions TO authenticated;
REVOKE UPDATE (votes_count, likes_count, plays_count, comments_count)
  ON public.arena_submissions FROM anon, authenticated;