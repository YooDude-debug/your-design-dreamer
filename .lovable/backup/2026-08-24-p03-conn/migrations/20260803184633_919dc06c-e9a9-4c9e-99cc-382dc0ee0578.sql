-- ===== Enums =====
CREATE TYPE public.arena_challenge_status AS ENUM ('draft', 'active', 'judging', 'closed');

-- ===== Challenges =====
CREATE TABLE public.arena_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  company_name text NOT NULL DEFAULT '',
  logo_url text,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  target_audience text NOT NULL DEFAULT '',
  terms text NOT NULL DEFAULT '',
  region text NOT NULL DEFAULT '',
  prize text NOT NULL DEFAULT '',
  status public.arena_challenge_status NOT NULL DEFAULT 'active',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arena_challenges TO authenticated;
GRANT ALL ON public.arena_challenges TO service_role;
ALTER TABLE public.arena_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "arena_challenges_select" ON public.arena_challenges
  FOR SELECT TO authenticated
  USING (status <> 'draft' OR company_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "arena_challenges_insert" ON public.arena_challenges
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'business')
      OR public.has_role(auth.uid(), 'creator')
    )
  );

CREATE POLICY "arena_challenges_update" ON public.arena_challenges
  FOR UPDATE TO authenticated
  USING (company_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (company_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "arena_challenges_delete" ON public.arena_challenges
  FOR DELETE TO authenticated
  USING (company_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER arena_challenges_touch BEFORE UPDATE ON public.arena_challenges
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== Submissions =====
CREATE TABLE public.arena_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.arena_challenges(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL,
  tag_id uuid NOT NULL REFERENCES public.slang_tags(id) ON DELETE CASCADE,
  pitch text NOT NULL DEFAULT '',
  votes_count integer NOT NULL DEFAULT 0,
  likes_count integer NOT NULL DEFAULT 0,
  plays_count integer NOT NULL DEFAULT 0,
  comments_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, tag_id)
);
CREATE INDEX arena_submissions_challenge_idx ON public.arena_submissions(challenge_id);
CREATE INDEX arena_submissions_creator_idx ON public.arena_submissions(creator_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arena_submissions TO authenticated;
GRANT ALL ON public.arena_submissions TO service_role;
ALTER TABLE public.arena_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "arena_submissions_select" ON public.arena_submissions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "arena_submissions_insert" ON public.arena_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    creator_id = auth.uid()
    AND public.owns_slang_tag(tag_id)
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'business')
      OR public.has_role(auth.uid(), 'creator')
    )
    AND EXISTS (
      SELECT 1 FROM public.arena_challenges c
      WHERE c.id = challenge_id AND c.status = 'active'
        AND (c.ends_at IS NULL OR c.ends_at > now())
    )
  );

CREATE POLICY "arena_submissions_delete" ON public.arena_submissions
  FOR DELETE TO authenticated
  USING (creator_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER arena_submissions_touch BEFORE UPDATE ON public.arena_submissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== Counter-Trigger =====
CREATE OR REPLACE FUNCTION public.sync_arena_counter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE col text := TG_ARGV[0];
BEGIN
  IF TG_OP = 'INSERT' THEN
    EXECUTE format('UPDATE public.arena_submissions SET %I = %I + 1 WHERE id = $1', col, col)
      USING NEW.submission_id;
    RETURN NEW;
  ELSE
    EXECUTE format('UPDATE public.arena_submissions SET %I = GREATEST(0, %I - 1) WHERE id = $1', col, col)
      USING OLD.submission_id;
    RETURN OLD;
  END IF;
END;
$$;

-- ===== Votes =====
CREATE TABLE public.arena_votes (
  submission_id uuid NOT NULL REFERENCES public.arena_submissions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (submission_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.arena_votes TO authenticated;
GRANT ALL ON public.arena_votes TO service_role;
ALTER TABLE public.arena_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "arena_votes_select" ON public.arena_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "arena_votes_insert" ON public.arena_votes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "arena_votes_delete" ON public.arena_votes FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER arena_votes_count AFTER INSERT OR DELETE ON public.arena_votes
  FOR EACH ROW EXECUTE FUNCTION public.sync_arena_counter('votes_count');

-- ===== Likes =====
CREATE TABLE public.arena_likes (
  submission_id uuid NOT NULL REFERENCES public.arena_submissions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (submission_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.arena_likes TO authenticated;
GRANT ALL ON public.arena_likes TO service_role;
ALTER TABLE public.arena_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "arena_likes_select" ON public.arena_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "arena_likes_insert" ON public.arena_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "arena_likes_delete" ON public.arena_likes FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER arena_likes_count AFTER INSERT OR DELETE ON public.arena_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_arena_counter('likes_count');

-- ===== Plays =====
CREATE TABLE public.arena_plays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.arena_submissions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX arena_plays_submission_idx ON public.arena_plays(submission_id);
GRANT SELECT, INSERT ON public.arena_plays TO authenticated;
GRANT ALL ON public.arena_plays TO service_role;
ALTER TABLE public.arena_plays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "arena_plays_select" ON public.arena_plays FOR SELECT TO authenticated USING (true);
CREATE POLICY "arena_plays_insert" ON public.arena_plays FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE TRIGGER arena_plays_count AFTER INSERT ON public.arena_plays
  FOR EACH ROW EXECUTE FUNCTION public.sync_arena_counter('plays_count');

-- ===== Kommentare =====
CREATE TABLE public.arena_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.arena_submissions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL,
  slang_tag_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX arena_comments_submission_idx ON public.arena_comments(submission_id);
GRANT SELECT, INSERT, DELETE ON public.arena_comments TO authenticated;
GRANT ALL ON public.arena_comments TO service_role;
ALTER TABLE public.arena_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "arena_comments_select" ON public.arena_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "arena_comments_insert" ON public.arena_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "arena_comments_delete" ON public.arena_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER arena_comments_count AFTER INSERT OR DELETE ON public.arena_comments
  FOR EACH ROW EXECUTE FUNCTION public.sync_arena_counter('comments_count');

-- ===== Auszeichnungen / Gewinner =====
CREATE TABLE public.arena_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.arena_challenges(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL REFERENCES public.arena_submissions(id) ON DELETE CASCADE,
  place integer NOT NULL DEFAULT 1,
  licensed boolean NOT NULL DEFAULT false,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, submission_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arena_awards TO authenticated;
GRANT ALL ON public.arena_awards TO service_role;
ALTER TABLE public.arena_awards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "arena_awards_select" ON public.arena_awards FOR SELECT TO authenticated USING (true);

CREATE POLICY "arena_awards_manage" ON public.arena_awards FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.arena_challenges c WHERE c.id = challenge_id AND c.company_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.arena_challenges c WHERE c.id = challenge_id AND c.company_id = auth.uid())
  );

CREATE TRIGGER arena_awards_touch BEFORE UPDATE ON public.arena_awards
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();