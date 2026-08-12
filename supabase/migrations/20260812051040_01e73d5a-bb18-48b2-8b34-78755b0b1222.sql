-- 1) Ad-Test-Einstellungen von der Bot-Verwaltung entkoppeln
CREATE TABLE public.ad_test_settings (
  id boolean NOT NULL PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT false,
  ad_frequency integer NOT NULL DEFAULT 15,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ad_test_settings TO authenticated;
GRANT INSERT, UPDATE ON public.ad_test_settings TO authenticated;
GRANT ALL ON public.ad_test_settings TO service_role;

ALTER TABLE public.ad_test_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ad_test_settings_select_authenticated"
  ON public.ad_test_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "ad_test_settings_write_admin"
  ON public.ad_test_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER ad_test_settings_touch
  BEFORE UPDATE ON public.ad_test_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Bestehende Werte der Testwerbung uebernehmen
INSERT INTO public.ad_test_settings (id, enabled, ad_frequency)
SELECT true, COALESCE(s.live_test, false), COALESCE(s.ad_frequency, 15)
FROM public.test_bot_settings s WHERE s.id = true
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ad_test_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- 2) Bot-Sichtbarkeit aus dem Bootstrap-Status entfernen
CREATE OR REPLACE FUNCTION public.bootstrap_user_state()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN auth.uid() IS NULL THEN '{}'::jsonb ELSE jsonb_build_object(
    'user_id', auth.uid(),
    'liked_posts', COALESCE((SELECT jsonb_agg(post_id) FROM public.post_likes WHERE user_id = auth.uid()), '[]'::jsonb),
    'saved_posts', COALESCE((SELECT jsonb_agg(post_id) FROM public.post_saves WHERE user_id = auth.uid()), '[]'::jsonb),
    'shared_posts', COALESCE((SELECT jsonb_agg(post_id) FROM public.post_shares WHERE user_id = auth.uid()), '[]'::jsonb),
    'liked_tags', COALESCE((SELECT jsonb_agg(tag_id) FROM public.slang_tag_likes WHERE user_id = auth.uid()), '[]'::jsonb),
    'saved_tags', COALESCE((SELECT jsonb_agg(tag_id) FROM public.slang_tag_saves WHERE user_id = auth.uid()), '[]'::jsonb),
    'following', COALESCE((SELECT jsonb_agg(following_id) FROM public.follows WHERE follower_id = auth.uid()), '[]'::jsonb),
    'roles', COALESCE((SELECT jsonb_agg(role) FROM public.user_roles WHERE user_id = auth.uid()), '[]'::jsonb),
    'profile', COALESCE((SELECT to_jsonb(x) FROM (
        SELECT p.id, p.username, p.location, p.location_visibility, p.profile_visibility,
               p.verified, p.push_enabled, p.level, p.xp, p.ads_enabled
        FROM public.profiles p WHERE p.id = auth.uid()
      ) x), 'null'::jsonb),
    'granted_tag_ids', COALESCE((SELECT jsonb_agg(tag_id) FROM public.slang_tag_grants WHERE grantee_id = auth.uid()), '[]'::jsonb),
    'ad_pauses', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (
        SELECT a.id, a.local_date, a.ends_at, a.month_key
        FROM public.ad_pauses a
        WHERE a.user_id = auth.uid() AND a.local_date >= (CURRENT_DATE - 40)
        ORDER BY a.local_date
      ) x), '[]'::jsonb),
    'connections', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (
        SELECT c.id, c.requester_id, c.addressee_id, c.status, c.created_at, c.updated_at
        FROM public.connections c
        WHERE c.requester_id = auth.uid() OR c.addressee_id = auth.uid()
        ORDER BY c.created_at DESC
      ) x), '[]'::jsonb),
    'conversations', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (
        SELECT co.id, co.kind, co.title, co.created_by, co.last_message_at,
               (SELECT COALESCE(jsonb_agg(m2.user_id), '[]'::jsonb)
                  FROM public.conversation_members m2 WHERE m2.conversation_id = co.id) AS members,
               mine.last_read_at
        FROM public.conversations co
        JOIN public.conversation_members mine
          ON mine.conversation_id = co.id AND mine.user_id = auth.uid()
        ORDER BY co.last_message_at DESC
      ) x), '[]'::jsonb),
    'unread_counts', COALESCE((SELECT jsonb_object_agg(x.cid, x.n) FROM (
        SELECT m.conversation_id::text AS cid, COUNT(*)::int AS n
        FROM public.messages m
        JOIN public.conversation_members cm
          ON cm.conversation_id = m.conversation_id AND cm.user_id = auth.uid()
        WHERE m.sender_id <> auth.uid() AND m.read_at IS NULL
        GROUP BY m.conversation_id
      ) x), '{}'::jsonb),
    'notifications', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (
        SELECT n.id, n.user_id, n.actor_id, n.type, n.title, n.body, n.entity_type,
               n.entity_id, n.link, n.read, n.created_at
        FROM public.notifications n
        WHERE n.user_id = auth.uid()
        ORDER BY n.created_at DESC
        LIMIT 50
      ) x), '[]'::jsonb)
  ) END
$function$;

-- 3) Profil-Schutz ohne Bot-Feld
CREATE OR REPLACE FUNCTION public.guard_profile_internal_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin')
     OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  NEW.verified := OLD.verified;
  NEW.level := OLD.level;
  NEW.xp := OLD.xp;
  NEW.ads_enabled := OLD.ads_enabled;
  RETURN NEW;
END;
$function$;

-- 4) Bot-spezifische Objekte entfernen
DROP FUNCTION IF EXISTS public.test_bots_visible();
DROP TABLE IF EXISTS public.test_accounts;
DROP TABLE IF EXISTS public.test_bot_settings;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_test_bot;

-- 5) Automatische Bot-Laeufe abschalten (falls geplant)
DO $$
DECLARE j record;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    FOR j IN SELECT jobname FROM cron.job
      WHERE command ILIKE '%bot-live-run%' OR jobname ILIKE '%bot%'
    LOOP
      PERFORM cron.unschedule(j.jobname);
    END LOOP;
  END IF;
END $$;