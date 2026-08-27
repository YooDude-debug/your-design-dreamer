-- ============================================================ Moderation DSA
CREATE TYPE public.moderation_reason_code AS ENUM (
  'rule_violation',
  'illegal_content',
  'spam',
  'fraud',
  'harassment',
  'prohibited_market_item',
  'other'
);

CREATE TYPE public.moderation_action_kind AS ENUM (
  'content_removed',
  'content_hidden',
  'slang_tag_hidden',
  'market_item_removed',
  'user_warned',
  'user_banned',
  'no_action'
);

CREATE TYPE public.moderation_appeal_status AS ENUM (
  'submitted',
  'in_review',
  'upheld',
  'overturned',
  'rejected'
);

CREATE TABLE public.moderation_actions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target_type text NOT NULL,
  target_id uuid,
  target_user_id uuid,
  action_kind public.moderation_action_kind NOT NULL,
  reason_code public.moderation_reason_code NOT NULL DEFAULT 'rule_violation',
  public_reason text NOT NULL DEFAULT '',
  internal_note text NOT NULL DEFAULT '',
  automated boolean NOT NULL DEFAULT false,
  report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
  admin_id uuid,
  target_label text NOT NULL DEFAULT '',
  user_informed_at timestamp with time zone,
  appeal_deadline timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX moderation_actions_user_idx
  ON public.moderation_actions (target_user_id, created_at DESC);
CREATE INDEX moderation_actions_report_idx ON public.moderation_actions (report_id);

GRANT SELECT ON public.moderation_actions TO authenticated;
GRANT ALL ON public.moderation_actions TO service_role;
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY moderation_actions_select_own ON public.moderation_actions
  FOR SELECT TO authenticated
  USING (target_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.moderation_appeals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_id uuid NOT NULL REFERENCES public.moderation_actions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  message text NOT NULL DEFAULT '',
  status public.moderation_appeal_status NOT NULL DEFAULT 'submitted',
  decision_note text NOT NULL DEFAULT '',
  decided_by uuid,
  decided_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (action_id)
);

CREATE INDEX moderation_appeals_user_idx
  ON public.moderation_appeals (user_id, created_at DESC);
CREATE INDEX moderation_appeals_status_idx
  ON public.moderation_appeals (status, created_at DESC);

GRANT SELECT, INSERT ON public.moderation_appeals TO authenticated;
GRANT ALL ON public.moderation_appeals TO service_role;
ALTER TABLE public.moderation_appeals ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.owns_moderation_action(_action_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.moderation_actions
    WHERE id = _action_id AND target_user_id = _user_id
  )
$$;

CREATE POLICY moderation_appeals_select_own ON public.moderation_appeals
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY moderation_appeals_insert_own ON public.moderation_appeals
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.owns_moderation_action(action_id, auth.uid())
    AND status = 'submitted'
    AND decision_note = ''
    AND decided_by IS NULL
    AND decided_at IS NULL
  );

CREATE POLICY moderation_appeals_admin_update ON public.moderation_appeals
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER moderation_actions_updated_at
  BEFORE UPDATE ON public.moderation_actions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER moderation_appeals_updated_at
  BEFORE UPDATE ON public.moderation_appeals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------- reports: Entscheidung
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS decision_code public.moderation_reason_code,
  ADD COLUMN IF NOT EXISTS decided_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS reporter_informed_at timestamp with time zone;
