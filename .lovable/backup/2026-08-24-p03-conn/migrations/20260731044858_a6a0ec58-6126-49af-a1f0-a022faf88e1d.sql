-- =========================================================
-- Y-Dude Interest Engine: core data structures
-- =========================================================

-- Category kinds
DO $$ BEGIN
  CREATE TYPE public.interest_category_kind AS ENUM ('topic','region','language','style','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.interest_content_type AS ENUM ('post','slang_tag','profile','ad');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------
-- 1. Categories
-- ---------------------------------------------------------
CREATE TABLE public.interest_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  kind public.interest_category_kind NOT NULL DEFAULT 'topic',
  parent_id uuid REFERENCES public.interest_categories(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.interest_categories TO authenticated;
GRANT ALL ON public.interest_categories TO service_role;
ALTER TABLE public.interest_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories readable by authenticated" ON public.interest_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories managed by admins" ON public.interest_categories
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_interest_categories_kind ON public.interest_categories(kind) WHERE active;
CREATE TRIGGER trg_interest_categories_updated BEFORE UPDATE ON public.interest_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------
-- 2. Configuration (no hardcoded values in code)
-- ---------------------------------------------------------
CREATE TABLE public.interest_engine_config (
  key text PRIMARY KEY,
  value numeric NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.interest_engine_config TO authenticated;
GRANT ALL ON public.interest_engine_config TO service_role;
ALTER TABLE public.interest_engine_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "config readable by authenticated" ON public.interest_engine_config
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "config managed by admins" ON public.interest_engine_config
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_interest_engine_config_updated BEFORE UPDATE ON public.interest_engine_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------
-- 3. Base interests (80% core, user controlled)
-- ---------------------------------------------------------
CREATE TABLE public.user_interests (
  user_id uuid NOT NULL,
  category_id uuid NOT NULL REFERENCES public.interest_categories(id) ON DELETE CASCADE,
  base_score numeric NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_interests TO authenticated;
GRANT ALL ON public.user_interests TO service_role;
ALTER TABLE public.user_interests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own base interests" ON public.user_interests
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_user_interests_category ON public.user_interests(category_id);
CREATE TRIGGER trg_user_interests_updated BEFORE UPDATE ON public.user_interests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------
-- 4. Dynamic scores (20%, learned)
-- ---------------------------------------------------------
CREATE TABLE public.user_interest_scores (
  user_id uuid NOT NULL,
  category_id uuid NOT NULL REFERENCES public.interest_categories(id) ON DELETE CASCADE,
  dynamic_score numeric NOT NULL DEFAULT 0,
  events_count integer NOT NULL DEFAULT 0,
  last_event_at timestamptz,
  last_decay_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_interest_scores TO authenticated;
GRANT ALL ON public.user_interest_scores TO service_role;
ALTER TABLE public.user_interest_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own dynamic scores" ON public.user_interest_scores
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_user_interest_scores_user_score ON public.user_interest_scores(user_id, dynamic_score DESC);
CREATE INDEX idx_user_interest_scores_decay ON public.user_interest_scores(last_decay_at);
CREATE TRIGGER trg_user_interest_scores_updated BEFORE UPDATE ON public.user_interest_scores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------
-- 5. Confidence per category
-- ---------------------------------------------------------
CREATE TABLE public.interest_confidence (
  user_id uuid NOT NULL,
  category_id uuid NOT NULL REFERENCES public.interest_categories(id) ON DELETE CASCADE,
  confidence numeric NOT NULL DEFAULT 0,
  view_count integer NOT NULL DEFAULT 0,
  engage_count integer NOT NULL DEFAULT 0,
  distinct_days integer NOT NULL DEFAULT 0,
  first_event_at timestamptz,
  last_event_at timestamptz,
  promoted boolean NOT NULL DEFAULT false,
  promoted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interest_confidence TO authenticated;
GRANT ALL ON public.interest_confidence TO service_role;
ALTER TABLE public.interest_confidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own confidence" ON public.interest_confidence
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_interest_confidence_promoted ON public.interest_confidence(user_id, promoted, confidence DESC);
CREATE TRIGGER trg_interest_confidence_updated BEFORE UPDATE ON public.interest_confidence
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------
-- 6. Raw interaction events (no message content, ever)
-- ---------------------------------------------------------
CREATE TABLE public.interaction_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  category_id uuid REFERENCES public.interest_categories(id) ON DELETE SET NULL,
  content_type public.interest_content_type,
  content_id uuid,
  peer_id uuid,
  weight numeric NOT NULL DEFAULT 0,
  dwell_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.interaction_events TO authenticated;
GRANT ALL ON public.interaction_events TO service_role;
ALTER TABLE public.interaction_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own events readable" ON public.interaction_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own events insertable" ON public.interaction_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_interaction_events_user_time ON public.interaction_events(user_id, created_at DESC);
CREATE INDEX idx_interaction_events_user_cat_time ON public.interaction_events(user_id, category_id, created_at DESC);
CREATE INDEX idx_interaction_events_peer ON public.interaction_events(user_id, peer_id, created_at DESC) WHERE peer_id IS NOT NULL;

-- ---------------------------------------------------------
-- 7. Content categories
-- ---------------------------------------------------------
CREATE TABLE public.content_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type public.interest_content_type NOT NULL,
  content_id uuid NOT NULL,
  category_id uuid NOT NULL REFERENCES public.interest_categories(id) ON DELETE CASCADE,
  owner_id uuid,
  weight numeric NOT NULL DEFAULT 1,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (content_type, content_id, category_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_categories TO authenticated;
GRANT ALL ON public.content_categories TO service_role;
ALTER TABLE public.content_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content categories readable" ON public.content_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "own content categories writable" ON public.content_categories
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE INDEX idx_content_categories_lookup ON public.content_categories(content_type, content_id);
CREATE INDEX idx_content_categories_category ON public.content_categories(category_id, content_type);

-- ---------------------------------------------------------
-- 8. Connection influence (frequency only, max 20% later)
-- ---------------------------------------------------------
CREATE TABLE public.connection_influence (
  user_id uuid NOT NULL,
  peer_id uuid NOT NULL,
  message_count integer NOT NULL DEFAULT 0,
  like_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  shared_interests integer NOT NULL DEFAULT 0,
  shared_slang_tags integer NOT NULL DEFAULT 0,
  strength numeric NOT NULL DEFAULT 0,
  last_interaction_at timestamptz,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, peer_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.connection_influence TO authenticated;
GRANT ALL ON public.connection_influence TO service_role;
ALTER TABLE public.connection_influence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own connection influence" ON public.connection_influence
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_connection_influence_strength ON public.connection_influence(user_id, strength DESC);
CREATE TRIGGER trg_connection_influence_updated BEFORE UPDATE ON public.connection_influence
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------
-- Seed: categories
-- ---------------------------------------------------------
INSERT INTO public.interest_categories (slug, name, kind) VALUES
  ('gaming','Gaming','topic'),
  ('travel','Reisen','topic'),
  ('music','Musik','topic'),
  ('tech','Technik','topic'),
  ('cars','Autos','topic'),
  ('cooking','Kochen','topic'),
  ('sports','Sport','topic'),
  ('football','Fußball','topic'),
  ('movies','Filme','topic'),
  ('animals','Tiere','topic'),
  ('fashion','Mode','topic'),
  ('streetfood','Streetfood','topic'),
  ('hiphop','HipHop','style'),
  ('comedy','Comedy','style'),
  ('memes','Memes','style'),
  ('slang','Slang','style'),
  ('berlin','Berlin','region'),
  ('germany','Deutschland','region'),
  ('greece','Griechenland','region'),
  ('lang-de','Deutsch','language'),
  ('lang-en','Englisch','language'),
  ('lang-el','Griechisch','language')
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------
-- Seed: configurable weights and parameters
-- ---------------------------------------------------------
INSERT INTO public.interest_engine_config (key, value, description) VALUES
  ('points.post_view', 2, 'Beitrag gesehen'),
  ('points.post_view_complete', 5, 'Beitrag vollständig gesehen'),
  ('points.post_like', 5, 'Like'),
  ('points.post_comment', 8, 'Kommentar'),
  ('points.post_share', 6, 'Beitrag geteilt'),
  ('points.post_save', 7, 'Beitrag gespeichert'),
  ('points.slangtag_play', 4, 'SlangTag angehört'),
  ('points.slangtag_use', 10, 'SlangTag benutzt'),
  ('points.slangtag_save', 12, 'SlangTag gespeichert'),
  ('points.profile_visit', 3, 'Profil besucht'),
  ('points.search', 4, 'Suchanfrage'),
  ('points.message', 15, 'Messenger-Interaktion (nur Häufigkeit)'),
  ('points.connection', 20, 'Neue Verbindung'),
  ('points.dwell_per_second', 0.5, 'Punkte pro Sekunde Verweildauer'),
  ('points.dwell_max', 15, 'Maximale Punkte aus Verweildauer pro Event'),
  ('weight.base', 0.8, 'Anteil Grundinteressen'),
  ('weight.dynamic', 0.2, 'Anteil dynamische Interessen'),
  ('weight.connection_max', 0.2, 'Maximaler Einfluss von Connections'),
  ('confidence.threshold', 100, 'Schwellenwert für Übernahme eines neuen Interesses'),
  ('confidence.min_events', 15, 'Mindestanzahl Aktionen für Übernahme'),
  ('confidence.min_days', 3, 'Mindestanzahl unterschiedlicher Tage'),
  ('confidence.view_weight', 1, 'Confidence-Gewicht passiver Aktionen'),
  ('confidence.engage_weight', 4, 'Confidence-Gewicht aktiver Aktionen'),
  ('confidence.demote_factor', 0.5, 'Anteil des Schwellenwerts, unter dem ein Interesse wieder verworfen wird'),
  ('decay.half_life_days', 21, 'Halbwertszeit dynamischer Scores in Tagen'),
  ('decay.min_score', 0.5, 'Dynamische Scores unter diesem Wert werden verworfen'),
  ('connection.message_weight', 1, 'Gewicht Nachrichtenhäufigkeit'),
  ('connection.like_weight', 2, 'Gewicht gegenseitiger Likes'),
  ('connection.comment_weight', 3, 'Gewicht Kommentare'),
  ('connection.shared_interest_weight', 4, 'Gewicht gemeinsamer Interessen'),
  ('connection.shared_tag_weight', 2, 'Gewicht gemeinsamer SlangTags'),
  ('connection.min_strength', 10, 'Mindeststärke, ab der eine Connection einfließt'),
  ('cache.profile_ttl_seconds', 300, 'Cache-Dauer des Interessenprofils'),
  ('recommend.default_limit', 20, 'Standardanzahl Empfehlungen')
ON CONFLICT (key) DO NOTHING;