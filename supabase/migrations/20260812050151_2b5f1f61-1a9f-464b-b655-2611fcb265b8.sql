CREATE TABLE public.beta_launch_state (
  id boolean PRIMARY KEY DEFAULT true,
  open_beta_enabled boolean NOT NULL DEFAULT false,
  activated_at timestamptz,
  activated_by uuid,
  scheduled_send_at timestamptz,
  send_started_at timestamptz,
  send_completed_at timestamptz,
  dispatch_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT beta_launch_state_singleton CHECK (id)
);

GRANT ALL ON public.beta_launch_state TO service_role;
ALTER TABLE public.beta_launch_state ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.beta_launch_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id uuid NOT NULL,
  subscriber_id uuid NOT NULL REFERENCES public.newsletter_subscribers(id) ON DELETE CASCADE,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  reason text NOT NULL DEFAULT '',
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT beta_launch_notifications_status_check
    CHECK (status IN ('sent', 'suppressed', 'failed')),
  CONSTRAINT beta_launch_notifications_unique_subscriber UNIQUE (subscriber_id)
);

GRANT ALL ON public.beta_launch_notifications TO service_role;
ALTER TABLE public.beta_launch_notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX beta_launch_notifications_dispatch_idx
  ON public.beta_launch_notifications (dispatch_id);

CREATE TRIGGER beta_launch_state_touch
  BEFORE UPDATE ON public.beta_launch_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.beta_launch_state (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;