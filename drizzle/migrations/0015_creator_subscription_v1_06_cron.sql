-- Creator Subscription V1 – pg_cron Automatik fuer die 3-Monats-Reifung.
-- Idempotent: bestehender Job wird zuerst entfernt.
DO $$
BEGIN
  PERFORM cron.unschedule('y-dude-exclusive-drop-maturation');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'y-dude-exclusive-drop-maturation',
  '7 * * * *',
  $$select public.run_exclusive_drop_maturation();$$
);