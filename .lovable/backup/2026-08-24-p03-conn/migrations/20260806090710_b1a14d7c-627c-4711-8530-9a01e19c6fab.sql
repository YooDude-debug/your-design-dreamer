-- 1) Profil-Einstellung
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_enabled boolean NOT NULL DEFAULT false;
GRANT SELECT (push_enabled), UPDATE (push_enabled) ON public.profiles TO authenticated;

-- 2) Benachrichtigungen: Titel + Sprungziel
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link text;

-- 3) Geräte / Push-Abonnements
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text NOT NULL DEFAULT '',
  failure_count integer NOT NULL DEFAULT 0,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own push subscriptions" ON public.push_subscriptions
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON public.push_subscriptions(user_id);

CREATE TRIGGER push_subscriptions_updated_at BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Versand-Warteschlange (nur Hintergrunddienst)
CREATE TABLE IF NOT EXISTS public.notification_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notification_id)
);
GRANT ALL ON public.notification_jobs TO service_role;
ALTER TABLE public.notification_jobs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS notification_jobs_pending_idx
  ON public.notification_jobs(status, next_attempt_at);

CREATE TRIGGER notification_jobs_updated_at BEFORE UPDATE ON public.notification_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) Automatisches Einreihen jeder neuen Benachrichtigung
CREATE OR REPLACE FUNCTION public.enqueue_notification_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_jobs (notification_id, user_id)
  VALUES (NEW.id, NEW.user_id)
  ON CONFLICT (notification_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_notification_push() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notifications_enqueue_push ON public.notifications;
CREATE TRIGGER notifications_enqueue_push AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_notification_push();

-- 6) Aufräumen alter Geräte / erledigter Aufträge
CREATE OR REPLACE FUNCTION public.cleanup_push_data()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.push_subscriptions
   WHERE last_seen_at < now() - interval '90 days' OR failure_count >= 5;
  DELETE FROM public.notification_jobs
   WHERE status IN ('done','failed') AND updated_at < now() - interval '7 days';
$$;
REVOKE ALL ON FUNCTION public.cleanup_push_data() FROM PUBLIC, anon, authenticated;