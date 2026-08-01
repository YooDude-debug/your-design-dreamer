-- 1) Doppelte Meldungen desselben Inhalts durch denselben Nutzer verhindern
DELETE FROM public.reports r
USING public.reports r2
WHERE r.reporter_id = r2.reporter_id
  AND r.target_type = r2.target_type
  AND r.target_id = r2.target_id
  AND r.created_at > r2.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS reports_unique_per_reporter
  ON public.reports (reporter_id, target_type, target_id);

-- 2) Spam-Schutz per Trigger (max. 10 Meldungen pro Stunde)
CREATE OR REPLACE FUNCTION public.enforce_report_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE recent integer;
BEGIN
  SELECT count(*) INTO recent
  FROM public.reports
  WHERE reporter_id = NEW.reporter_id
    AND created_at > now() - interval '1 hour';
  IF recent >= 10 THEN
    RAISE EXCEPTION 'Zu viele Meldungen in kurzer Zeit. Bitte spaeter erneut versuchen.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reports_rate_limit ON public.reports;
CREATE TRIGGER reports_rate_limit
  BEFORE INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.enforce_report_rate_limit();

-- 3) Beiträge ausblenden (Moderation)
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS hidden_at timestamptz;

DROP POLICY IF EXISTS posts_select ON public.posts;
CREATE POLICY posts_select ON public.posts
FOR SELECT
USING (
  (
    hidden_at IS NULL
    OR user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  )
  AND (
    visibility = 'public'::post_visibility
    OR user_id = auth.uid()
    OR (visibility = 'connections'::post_visibility AND public.are_connected(auth.uid(), user_id))
    OR (visibility = 'following'::post_visibility AND public.is_following(user_id, auth.uid()))
  )
);