CREATE TABLE public.connection_suggestions (
  user_id uuid NOT NULL,
  suggested_id uuid NOT NULL,
  score numeric NOT NULL DEFAULT 0,
  mutual_count integer NOT NULL DEFAULT 0,
  reasons text[] NOT NULL DEFAULT '{}',
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, suggested_id)
);

GRANT SELECT ON public.connection_suggestions TO authenticated;
GRANT ALL ON public.connection_suggestions TO service_role;

ALTER TABLE public.connection_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "connection_suggestions_select_own"
ON public.connection_suggestions FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE INDEX idx_connection_suggestions_user_score
ON public.connection_suggestions (user_id, score DESC);

-- Interne Berechnung (kein Auth-Kontext nötig, wird von Wrapper/Cron gerufen)
CREATE OR REPLACE FUNCTION public.compute_connection_suggestions(_user uuid, _limit integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF _user IS NULL THEN RETURN 0; END IF;

  DELETE FROM public.connection_suggestions WHERE user_id = _user;

  WITH me AS (
    SELECT id, language, location, profile_visibility FROM public.profiles WHERE id = _user
  ),
  my_conn AS (
    SELECT CASE WHEN requester_id = _user THEN addressee_id ELSE requester_id END AS id
    FROM public.connections
    WHERE status = 'accepted' AND (requester_id = _user OR addressee_id = _user)
  ),
  linked AS (
    SELECT CASE WHEN requester_id = _user THEN addressee_id ELSE requester_id END AS id
    FROM public.connections
    WHERE requester_id = _user OR addressee_id = _user
  ),
  fof AS (
    SELECT CASE WHEN c.requester_id = mc.id THEN c.addressee_id ELSE c.requester_id END AS id,
           count(*)::int AS mutuals
    FROM public.connections c
    JOIN my_conn mc ON (c.requester_id = mc.id OR c.addressee_id = mc.id)
    WHERE c.status = 'accepted'
    GROUP BY 1
  ),
  my_hash AS (
    SELECT DISTINCT ph.hashtag_id AS id
    FROM public.post_hashtags ph JOIN public.posts p ON p.id = ph.post_id
    WHERE p.user_id = _user
    UNION
    SELECT hashtag_id FROM public.hashtag_follows WHERE user_id = _user
  ),
  my_tags AS (
    SELECT DISTINCT t AS id FROM public.posts p, unnest(p.slang_tag_ids) t WHERE p.user_id = _user
    UNION SELECT tag_id FROM public.slang_tag_likes WHERE user_id = _user
    UNION SELECT tag_id FROM public.slang_tag_saves WHERE user_id = _user
    UNION SELECT id FROM public.slang_tags WHERE creator_id = _user AND deleted_at IS NULL
  ),
  my_int AS (
    SELECT category_id AS id FROM public.user_interests WHERE user_id = _user
    UNION
    SELECT category_id FROM public.interest_confidence WHERE user_id = _user AND confidence >= 0.3
  ),
  cand AS (
    SELECT p.*, COALESCE(f.mutuals, 0) AS mutuals
    FROM public.profiles p
    LEFT JOIN fof f ON f.id = p.id
    CROSS JOIN me
    WHERE p.id <> _user
      AND p.id NOT IN (SELECT id FROM linked)
      AND p.profile_visibility <> 'private'
      AND (p.profile_visibility = 'public' OR COALESCE(f.mutuals, 0) > 0)
      AND NOT EXISTS (
        SELECT 1 FROM public.user_bans b
        WHERE b.user_id = p.id AND b.active
          AND (b.expires_at IS NULL OR b.expires_at > now())
      )
  ),
  scored AS (
    SELECT
      c.id,
      c.mutuals,
      (
        least(c.mutuals, 8) * 14
        + CASE WHEN c.language = (SELECT language FROM me) THEN 10 ELSE 0 END
        + CASE WHEN c.location <> '' AND lower(c.location) = lower((SELECT location FROM me)) THEN 9 ELSE 0 END
        + least(hs.n, 6) * 4
        + least(ts.n, 6) * 4
        + least(ints.n, 6) * 3
        + least(act.n, 10) * 1.2
        + CASE
            WHEN c.last_seen_at > now() - interval '2 days' THEN 6
            WHEN c.last_seen_at > now() - interval '7 days' THEN 3
            ELSE 0
          END
        + CASE WHEN c.avatar_url IS NOT NULL THEN 2 ELSE 0 END
        + CASE WHEN c.bio <> '' THEN 2 ELSE 0 END
        + CASE WHEN c.verified THEN 2 ELSE 0 END
        + random() * 7
      )::numeric AS score,
      hs.n AS hash_n, ts.n AS tag_n, ints.n AS int_n, act.n AS act_n,
      (c.language = (SELECT language FROM me)) AS same_lang,
      (c.location <> '' AND lower(c.location) = lower((SELECT location FROM me))) AS same_region
    FROM cand c
    CROSS JOIN LATERAL (
      SELECT count(DISTINCT ph.hashtag_id)::int AS n
      FROM public.post_hashtags ph JOIN public.posts p2 ON p2.id = ph.post_id
      WHERE p2.user_id = c.id AND ph.hashtag_id IN (SELECT id FROM my_hash)
    ) hs
    CROSS JOIN LATERAL (
      SELECT count(*)::int AS n FROM (
        SELECT DISTINCT t FROM public.posts p3, unnest(p3.slang_tag_ids) t
        WHERE p3.user_id = c.id AND t IN (SELECT id FROM my_tags)
        UNION
        SELECT tag_id FROM public.slang_tag_likes l
        WHERE l.user_id = c.id AND l.tag_id IN (SELECT id FROM my_tags)
      ) x
    ) ts
    CROSS JOIN LATERAL (
      SELECT count(*)::int AS n FROM public.user_interests ui
      WHERE ui.user_id = c.id AND ui.category_id IN (SELECT id FROM my_int)
    ) ints
    CROSS JOIN LATERAL (
      SELECT count(*)::int AS n FROM public.posts p4
      WHERE p4.user_id = c.id AND p4.created_at > now() - interval '30 days'
    ) act
  )
  INSERT INTO public.connection_suggestions (user_id, suggested_id, score, mutual_count, reasons)
  SELECT _user, s.id, s.score, s.mutuals,
    (ARRAY[]::text[]
      || CASE WHEN s.mutuals > 0 THEN ARRAY['mutual'] ELSE '{}'::text[] END
      || CASE WHEN s.same_lang THEN ARRAY['language'] ELSE '{}'::text[] END
      || CASE WHEN s.same_region THEN ARRAY['region'] ELSE '{}'::text[] END
      || CASE WHEN s.hash_n > 0 THEN ARRAY['hashtags'] ELSE '{}'::text[] END
      || CASE WHEN s.tag_n > 0 THEN ARRAY['slangtags'] ELSE '{}'::text[] END
      || CASE WHEN s.int_n > 0 THEN ARRAY['interests'] ELSE '{}'::text[] END
      || CASE WHEN s.act_n > 0 THEN ARRAY['active'] ELSE '{}'::text[] END
    )
  FROM scored s
  ORDER BY s.score DESC
  LIMIT greatest(_limit, 1);

  SELECT count(*)::int INTO v_count FROM public.connection_suggestions WHERE user_id = _user;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.compute_connection_suggestions(uuid, integer) FROM PUBLIC, anon, authenticated;

-- Öffentlicher Wrapper: nur für den eigenen Account, mit Frische-Fenster
CREATE OR REPLACE FUNCTION public.refresh_connection_suggestions(_force boolean DEFAULT false)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_fresh timestamptz;
BEGIN
  IF v_uid IS NULL THEN RETURN 0; END IF;

  SELECT max(computed_at) INTO v_fresh FROM public.connection_suggestions WHERE user_id = v_uid;
  IF NOT _force AND v_fresh IS NOT NULL AND v_fresh > now() - interval '10 minutes' THEN
    RETURN (SELECT count(*)::int FROM public.connection_suggestions WHERE user_id = v_uid);
  END IF;

  RETURN public.compute_connection_suggestions(v_uid, 30);
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_connection_suggestions(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_connection_suggestions(boolean) TO authenticated;

-- Vorschläge nach Änderungen an Verbindungen als veraltet markieren
CREATE OR REPLACE FUNCTION public.invalidate_connection_suggestions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.connection_suggestions
  WHERE user_id IN (
    COALESCE(NEW.requester_id, OLD.requester_id),
    COALESCE(NEW.addressee_id, OLD.addressee_id)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_connections_invalidate_suggestions
AFTER INSERT OR UPDATE OR DELETE ON public.connections
FOR EACH ROW EXECUTE FUNCTION public.invalidate_connection_suggestions();

-- Hintergrund-Aktualisierung für kürzlich aktive Nutzer
CREATE OR REPLACE FUNCTION public.refresh_stale_connection_suggestions(_max_users integer DEFAULT 50)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  n integer := 0;
BEGIN
  FOR r IN
    SELECT p.id
    FROM public.profiles p
    LEFT JOIN (
      SELECT user_id, max(computed_at) AS computed_at
      FROM public.connection_suggestions GROUP BY user_id
    ) s ON s.user_id = p.id
    WHERE p.last_seen_at > now() - interval '3 days'
      AND (s.computed_at IS NULL OR s.computed_at < now() - interval '30 minutes')
    ORDER BY s.computed_at NULLS FIRST
    LIMIT greatest(_max_users, 1)
  LOOP
    PERFORM public.compute_connection_suggestions(r.id, 30);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_stale_connection_suggestions(integer) FROM PUBLIC, anon, authenticated;