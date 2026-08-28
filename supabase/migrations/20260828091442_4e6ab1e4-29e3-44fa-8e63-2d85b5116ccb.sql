-- =========================================================
-- 1) MARKET_FEE_SETTINGS: keine Client-Lesbarkeit mehr
--    Gebühren werden in market_start_transaction (SECURITY DEFINER)
--    serverseitig berechnet; das Admin-Cockpit liest als Admin.
-- =========================================================
DROP POLICY IF EXISTS "fee settings readable" ON public.market_fee_settings;
CREATE POLICY "fee settings admin read" ON public.market_fee_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

REVOKE ALL ON public.market_fee_settings FROM anon;
GRANT SELECT, UPDATE ON public.market_fee_settings TO authenticated;
GRANT ALL ON public.market_fee_settings TO service_role;

-- =========================================================
-- 2) MARKET_SELLER_PROFILES: volle Zeile nur Eigentümer/Admin,
--    öffentliche Felder über dedizierte Ansicht.
-- =========================================================
DROP POLICY IF EXISTS "seller profiles readable" ON public.market_seller_profiles;
CREATE POLICY "seller profile select own" ON public.market_seller_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- Sicherheitsannahme: die Ansicht enthaelt ausschliesslich Felder, die
-- Verkaeufer bewusst fuer den Marktplatz veroeffentlichen. Keine Kontakt-,
-- Zahlungs- oder Verwaltungsdaten. security_invoker bleibt aus, damit die
-- eigentuemer-beschraenkte Zeilenregel die oeffentliche Anzeige nicht blockiert.
CREATE OR REPLACE VIEW public.market_seller_profiles_public
WITH (security_invoker = false) AS
  SELECT
    user_id,
    seller_type,
    business_name,
    logo_path,
    description,
    website,
    verified_business
  FROM public.market_seller_profiles;

REVOKE ALL ON public.market_seller_profiles_public FROM anon;
GRANT SELECT ON public.market_seller_profiles_public TO authenticated;
GRANT ALL ON public.market_seller_profiles_public TO service_role;

REVOKE ALL ON public.market_seller_profiles FROM anon;

-- =========================================================
-- 3) ARENA: einheitliche Sichtbarkeitslogik
--    Einzige Quelle der Wahrheit: is_arena_challenge_visible()
-- =========================================================

-- Einreichung sichtbar = Challenge sichtbar ODER eigene Einreichung/Admin
CREATE OR REPLACE FUNCTION public.can_see_arena_submission(_submission_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1
    from public.arena_submissions s
    where s.id = _submission_id
      and (
        s.creator_id = auth.uid()
        or public.has_role(auth.uid(), 'admin'::app_role)
        or (
          public.is_arena_challenge_visible(s.challenge_id)
          and public.test_user_visible(s.creator_id)
        )
      )
  )
$$;

-- Engagement (Stimmen/Likes/Plays) nur fuer Einreicher, ausschreibendes
-- Unternehmen oder Admin – und nur wenn die Einreichung ueberhaupt sichtbar ist.
CREATE OR REPLACE FUNCTION public.can_see_arena_engagement(_submission_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  select public.has_role(auth.uid(), 'admin'::app_role)
      or exists (
        select 1
        from public.arena_submissions s
        join public.arena_challenges c on c.id = s.challenge_id
        where s.id = _submission_id
          and public.can_see_arena_submission(s.id)
          and (s.creator_id = auth.uid() or c.company_id = auth.uid())
      )
$$;

REVOKE ALL ON FUNCTION public.can_see_arena_submission(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_see_arena_engagement(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_arena_challenge_visible(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_arena_submission(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_see_arena_engagement(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_arena_challenge_visible(uuid) TO authenticated, service_role;

-- Einreichungen: eigene Zeilen bleiben lesbar, fremde nur bei sichtbarer Challenge
DROP POLICY IF EXISTS arena_submissions_select ON public.arena_submissions;
CREATE POLICY arena_submissions_select ON public.arena_submissions
  FOR SELECT TO authenticated
  USING (
    creator_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR (public.is_arena_challenge_visible(challenge_id) AND public.test_user_visible(creator_id))
  );

-- Einreichen nur in sichtbare, laufende Challenges
DROP POLICY IF EXISTS arena_submissions_insert ON public.arena_submissions;
CREATE POLICY arena_submissions_insert ON public.arena_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    creator_id = auth.uid()
    AND public.owns_slang_tag(tag_id)
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'business'::app_role)
      OR public.has_role(auth.uid(), 'creator'::app_role)
    )
    AND public.is_arena_challenge_visible(challenge_id)
    AND EXISTS (
      SELECT 1 FROM public.arena_challenges c
      WHERE c.id = arena_submissions.challenge_id
        AND c.status = 'active'::arena_challenge_status
        AND (c.ends_at IS NULL OR c.ends_at > now())
    )
  );

-- Kommentare: keine eigenen Kommentare zu unsichtbaren Einreichungen mehr lesbar
DROP POLICY IF EXISTS arena_comments_select ON public.arena_comments;
CREATE POLICY arena_comments_select ON public.arena_comments
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.can_see_arena_submission(submission_id)
  );

DROP POLICY IF EXISTS arena_comments_insert ON public.arena_comments;
CREATE POLICY arena_comments_insert ON public.arena_comments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_see_arena_submission(submission_id));

-- Auszeichnungen: an Challenge- und Einreichungssichtbarkeit gebunden
DROP POLICY IF EXISTS arena_awards_select ON public.arena_awards;
CREATE POLICY arena_awards_select ON public.arena_awards
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      public.is_arena_challenge_visible(challenge_id)
      AND (submission_id IS NULL OR public.can_see_arena_submission(submission_id))
    )
  );

-- Engagement-Tabellen: eigene Zeilen nur bei sichtbarer Einreichung
DROP POLICY IF EXISTS arena_votes_select ON public.arena_votes;
CREATE POLICY arena_votes_select ON public.arena_votes
  FOR SELECT TO authenticated
  USING (
    (user_id = auth.uid() AND public.can_see_arena_submission(submission_id))
    OR public.can_see_arena_engagement(submission_id)
  );

DROP POLICY IF EXISTS arena_likes_select ON public.arena_likes;
CREATE POLICY arena_likes_select ON public.arena_likes
  FOR SELECT TO authenticated
  USING (
    (user_id = auth.uid() AND public.can_see_arena_submission(submission_id))
    OR public.can_see_arena_engagement(submission_id)
  );

DROP POLICY IF EXISTS arena_plays_select ON public.arena_plays;
CREATE POLICY arena_plays_select ON public.arena_plays
  FOR SELECT TO authenticated
  USING (
    (user_id = auth.uid() AND public.can_see_arena_submission(submission_id))
    OR public.can_see_arena_engagement(submission_id)
  );

-- Auszeichnungen verwalten: nur ausschreibendes Unternehmen oder Admin
DROP POLICY IF EXISTS arena_awards_manage ON public.arena_awards;
CREATE POLICY arena_awards_manage ON public.arena_awards
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.arena_challenges c
      WHERE c.id = arena_awards.challenge_id AND c.company_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.arena_challenges c
      WHERE c.id = arena_awards.challenge_id AND c.company_id = auth.uid()
    )
  );
