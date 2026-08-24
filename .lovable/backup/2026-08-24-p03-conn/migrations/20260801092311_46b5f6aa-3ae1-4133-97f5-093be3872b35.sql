-- 1. Enums
CREATE TYPE public.report_target_type AS ENUM ('post', 'slang_tag', 'comment', 'profile', 'message');
CREATE TYPE public.report_status AS ENUM ('open', 'reviewing', 'resolved', 'dismissed');
CREATE TYPE public.ad_campaign_kind AS ENUM ('campaign', 'company_slang_tag', 'creator_slang_tag');
CREATE TYPE public.ad_campaign_status AS ENUM ('draft', 'active', 'paused', 'ended');

-- 2. Reports
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type public.report_target_type NOT NULL,
  target_id uuid NOT NULL,
  target_user_id uuid,
  reporter_id uuid NOT NULL,
  reason text NOT NULL DEFAULT '',
  details text NOT NULL DEFAULT '',
  status public.report_status NOT NULL DEFAULT 'open',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reports_status_idx ON public.reports (status, created_at DESC);
CREATE INDEX reports_target_idx ON public.reports (target_type, target_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY reports_insert_own ON public.reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY reports_select_own ON public.reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);
CREATE POLICY reports_select_admin ON public.reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY reports_update_admin ON public.reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY reports_delete_admin ON public.reports FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER reports_touch BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Warnings
CREATE TABLE public.user_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  admin_id uuid NOT NULL,
  reason text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_warnings_user_idx ON public.user_warnings (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_warnings TO authenticated;
GRANT ALL ON public.user_warnings TO service_role;
ALTER TABLE public.user_warnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_warnings_select_own ON public.user_warnings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY user_warnings_select_admin ON public.user_warnings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY user_warnings_insert_admin ON public.user_warnings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND auth.uid() = admin_id);
CREATE POLICY user_warnings_delete_admin ON public.user_warnings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Bans
CREATE TABLE public.user_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  admin_id uuid NOT NULL,
  reason text NOT NULL DEFAULT '',
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_bans_user_idx ON public.user_bans (user_id, active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_bans TO authenticated;
GRANT ALL ON public.user_bans TO service_role;
ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_bans_select_own ON public.user_bans FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY user_bans_select_admin ON public.user_bans FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY user_bans_insert_admin ON public.user_bans FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND auth.uid() = admin_id);
CREATE POLICY user_bans_update_admin ON public.user_bans FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY user_bans_delete_admin ON public.user_bans FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER user_bans_touch BEFORE UPDATE ON public.user_bans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. Admin audit log (security protocol)
CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  admin_username text NOT NULL DEFAULT '',
  action text NOT NULL,
  target_type text NOT NULL DEFAULT '',
  target_id uuid,
  target_user_id uuid,
  target_label text NOT NULL DEFAULT '',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_log_created_idx ON public.admin_audit_log (created_at DESC);

GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_audit_log_select_admin ON public.admin_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 6. Ad campaigns (Werbekern)
CREATE TABLE public.ad_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind public.ad_campaign_kind NOT NULL DEFAULT 'campaign',
  status public.ad_campaign_status NOT NULL DEFAULT 'draft',
  owner_id uuid,
  slang_tag_id uuid REFERENCES public.slang_tags(id) ON DELETE SET NULL,
  region text NOT NULL DEFAULT '',
  budget_cents integer NOT NULL DEFAULT 0,
  revenue_cents integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ad_campaigns_status_idx ON public.ad_campaigns (status, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_campaigns TO authenticated;
GRANT ALL ON public.ad_campaigns TO service_role;
ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY ad_campaigns_select_admin ON public.ad_campaigns FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY ad_campaigns_select_own ON public.ad_campaigns FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);
CREATE POLICY ad_campaigns_insert_admin ON public.ad_campaigns FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY ad_campaigns_update_admin ON public.ad_campaigns FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY ad_campaigns_delete_admin ON public.ad_campaigns FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER ad_campaigns_touch BEFORE UPDATE ON public.ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 7. Test accounts: activation + bot behaviour
ALTER TABLE public.test_accounts
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS bot_config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 8. SlangTags: soft delete so admins can restore
ALTER TABLE public.slang_tags
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

DROP POLICY IF EXISTS slang_tags_select ON public.slang_tags;
CREATE POLICY slang_tags_select ON public.slang_tags FOR SELECT TO authenticated
  USING (deleted_at IS NULL OR public.has_role(auth.uid(), 'admin'));