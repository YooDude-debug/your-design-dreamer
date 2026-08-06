CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('post-moderation-worker')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'post-moderation-worker');

SELECT cron.schedule(
  'post-moderation-worker',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--28c6b349-006b-4137-bd0e-13eee9cc6ca0.lovable.app/api/public/moderation-run',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_61o67IwX23ltL0HAtT-Lyw_OjVERkdv"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  );
  $$
);