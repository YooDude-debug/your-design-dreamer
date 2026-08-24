-- 1) Neue, optionale Profilfelder -------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS birthday date,
  ADD COLUMN IF NOT EXISTS pronouns text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS interest_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hobbies text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS fav_music text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS fav_games text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS fav_movies text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS fav_sports text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS website text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS instagram text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tiktok text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS youtube text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS twitch text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS discord text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS field_visibility jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Nur der Eigentümer darf schreiben (bestehende Update-Policy greift);
-- Lesen erfolgt ausschliesslich über die maskierende Serverfunktion unten.
GRANT UPDATE (origin, languages, birthday, pronouns, interest_tags, hobbies,
              fav_music, fav_games, fav_movies, fav_sports, website, instagram,
              tiktok, youtube, twitch, discord, field_visibility)
  ON public.profiles TO authenticated;

-- 2) Feldweise Sichtbarkeit -------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_see_profile_field(_owner uuid, _vis text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    auth.uid() = _owner
    OR public.has_role(auth.uid(), 'admin')
    OR _vis = 'public'
    OR (_vis = 'followers' AND (public.is_following(auth.uid(), _owner)
                                OR public.are_connected(auth.uid(), _owner)))
  )
$$;

CREATE OR REPLACE FUNCTION public.profile_details(_ids uuid[])
RETURNS TABLE(user_id uuid, details jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  r record;
  all_fields jsonb;
  visible jsonb;
  k text;
  vis text;
BEGIN
  IF uid IS NULL THEN RETURN; END IF;

  FOR r IN SELECT * FROM public.profiles p WHERE p.id = ANY(_ids) LOOP
    all_fields := jsonb_build_object(
      'origin', r.origin,
      'languages', to_jsonb(r.languages),
      'birthday', r.birthday,
      'pronouns', r.pronouns,
      'interestTags', to_jsonb(r.interest_tags),
      'hobbies', to_jsonb(r.hobbies),
      'music', to_jsonb(r.fav_music),
      'games', to_jsonb(r.fav_games),
      'movies', to_jsonb(r.fav_movies),
      'sports', to_jsonb(r.fav_sports),
      'website', r.website,
      'instagram', r.instagram,
      'tiktok', r.tiktok,
      'youtube', r.youtube,
      'twitch', r.twitch,
      'discord', r.discord
    );

    visible := '{}'::jsonb;
    FOR k IN SELECT jsonb_object_keys(all_fields) LOOP
      vis := COALESCE(r.field_visibility->>k,
                      CASE WHEN k IN ('birthday', 'discord') THEN 'private' ELSE 'public' END);
      IF public.can_see_profile_field(r.id, vis) THEN
        visible := visible || jsonb_build_object(k, all_fields->k);
      END IF;
    END LOOP;

    IF uid = r.id THEN
      visible := visible || jsonb_build_object('fieldVisibility',
                              COALESCE(r.field_visibility, '{}'::jsonb));
    END IF;

    user_id := r.id;
    details := visible;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- 3) Profilstatistiken ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.profile_stats(_ids uuid[])
RETURNS TABLE(user_id uuid, stats jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id,
         jsonb_build_object(
           'memberSince', p.created_at,
           'posts', (SELECT count(*) FROM public.posts x
                      WHERE x.user_id = p.id AND x.hidden_at IS NULL),
           'comments', (SELECT count(*) FROM public.comments c WHERE c.user_id = p.id),
           'likesReceived', (SELECT COALESCE(sum(x.likes_count), 0) FROM public.posts x
                              WHERE x.user_id = p.id)
                            + (SELECT COALESCE(sum(t.likes_count), 0) FROM public.slang_tags t
                                WHERE t.owner_id = p.id AND t.deleted_at IS NULL),
           'followers', (SELECT count(*) FROM public.follows f WHERE f.following_id = p.id),
           'following', (SELECT count(*) FROM public.follows f WHERE f.follower_id = p.id),
           'slangTags', (SELECT count(*) FROM public.slang_tags t
                          WHERE t.owner_id = p.id AND t.deleted_at IS NULL),
           'slangTagUses', (SELECT COALESCE(sum(t.uses_count), 0) FROM public.slang_tags t
                             WHERE t.owner_id = p.id AND t.deleted_at IS NULL),
           'slangTagRank', (
             SELECT count(*) + 1 FROM (
               SELECT owner_id, sum(uses_count) AS u
               FROM public.slang_tags WHERE deleted_at IS NULL GROUP BY owner_id
             ) q
             WHERE q.u > COALESCE((SELECT sum(uses_count) FROM public.slang_tags t
                                    WHERE t.owner_id = p.id AND t.deleted_at IS NULL), 0)
           ),
           'verified', p.verified,
           'level', p.level,
           'xp', p.xp
         )
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.id = ANY(_ids)
    AND public.can_view_profile(p.id)
$$;

REVOKE ALL ON FUNCTION public.can_see_profile_field(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.profile_details(uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.profile_stats(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profile_details(uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.profile_stats(uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_see_profile_field(uuid, text) TO service_role;

-- 4) Protokoll sicherheitsrelevanter Kontoaktionen (Rate-Limit) -------------
CREATE TABLE IF NOT EXISTS public.account_security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  outcome text NOT NULL DEFAULT 'ok',
  detail text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.account_security_events TO authenticated;
GRANT ALL ON public.account_security_events TO service_role;
ALTER TABLE public.account_security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_security_events_admin_select ON public.account_security_events;
CREATE POLICY account_security_events_admin_select
  ON public.account_security_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS account_security_events_no_client_insert ON public.account_security_events;
CREATE POLICY account_security_events_no_client_insert
  ON public.account_security_events FOR INSERT TO authenticated, anon
  WITH CHECK (false);

DROP POLICY IF EXISTS account_security_events_no_client_update ON public.account_security_events;
CREATE POLICY account_security_events_no_client_update
  ON public.account_security_events FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS account_security_events_no_client_delete ON public.account_security_events;
CREATE POLICY account_security_events_no_client_delete
  ON public.account_security_events FOR DELETE TO authenticated, anon
  USING (false);

CREATE INDEX IF NOT EXISTS account_security_events_user_time_idx
  ON public.account_security_events (user_id, action, created_at DESC);