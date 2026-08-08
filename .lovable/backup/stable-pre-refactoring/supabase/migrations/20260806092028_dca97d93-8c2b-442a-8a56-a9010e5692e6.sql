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
        least(c.mutuals, 8) * 25
        + CASE WHEN c.language = (SELECT language FROM me) THEN 10 ELSE 0 END
        + CASE WHEN c.location <> '' AND lower(c.location) = lower((SELECT location FROM me)) THEN 9 ELSE 0 END
        + least(hs.n, 6) * 4
        + least(ts.n, 6) * 4
        + least(ints.n, 6) * 3
        + least(act.n, 10) * 0.8
        + CASE
            WHEN c.last_seen_at > now() - interval '2 days' THEN 5
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
GRANT EXECUTE ON FUNCTION public.compute_connection_suggestions(uuid, integer) TO service_role;