UPDATE public.post_moderation_jobs
SET status = 'queued', next_attempt_at = now()
WHERE status = 'running'
  AND started_at <= now() - interval '5 minutes';