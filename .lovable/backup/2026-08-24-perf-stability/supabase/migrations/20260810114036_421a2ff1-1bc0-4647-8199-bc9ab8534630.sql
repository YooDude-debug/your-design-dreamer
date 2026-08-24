SELECT cron.unschedule('y-dude-push-run');

SELECT cron.schedule(
  'y-dude-push-run',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--28c6b349-006b-4137-bd0e-13eee9cc6ca0.lovable.app/api/public/push-run',
    headers := '{"Content-Type": "application/json", "x-worker-secret": "wk_7f3Qe1XzR9uJ2sBn6VtL4pKcMh8DyA0Ug5WoZiEsNrTbQxFvJmYd3H1kPaCwSu2e"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  );
  $$
);