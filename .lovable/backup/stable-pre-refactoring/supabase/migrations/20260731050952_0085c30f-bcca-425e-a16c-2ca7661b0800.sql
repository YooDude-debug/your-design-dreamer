-- ============ Enums ============
DO $$ BEGIN CREATE TYPE public.slang_tag_kind AS ENUM ('community','creator'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.slang_tag_owner_type AS ENUM ('user','creator','company'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.slang_tag_unlock_type AS ENUM ('open','follow','challenge','event','premium'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.verification_status AS ENUM ('none','pending','verified','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ slang_tags erweitern ============
ALTER TABLE public.slang_tags
  ADD COLUMN IF NOT EXISTS kind public.slang_tag_kind NOT NULL DEFAULT 'community',
  ADD COLUMN IF NOT EXISTS owner_id uuid,
  ADD COLUMN IF NOT EXISTS owner_type public.slang_tag_owner_type NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS company text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS verification_status public.verification_status NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS unlock_type public.slang_tag_unlock_type NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS follow_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS released_at timestamptz NOT NULL DEFAULT now(),
  -- Creator Drops (vorbereitet, noch nicht aktiv)
  ADD COLUMN IF NOT EXISTS drop_release_date timestamptz,
  ADD COLUMN IF NOT EXISTS drop_limit integer,
  ADD COLUMN IF NOT EXISTS drop_expires timestamptz,
  ADD COLUMN IF NOT EXISTS drop_rarity text;

UPDATE public.slang_tags SET owner_id = creator_id WHERE owner_id IS NULL;
ALTER TABLE public.slang_tags ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE public.slang_tags ALTER COLUMN owner_id SET DEFAULT auth.uid();

-- ============ Namensregeln ============
UPDATE public.slang_tags
   SET name = left(regexp_replace(name, '\s+', '', 'g'), 32)
 WHERE name ~ '\s' OR length(name) > 32;

ALTER TABLE public.slang_tags DROP CONSTRAINT IF EXISTS slang_tags_name_format;
ALTER TABLE public.slang_tags
  ADD CONSTRAINT slang_tags_name_format
  CHECK (name !~ '\s' AND char_length(name) BETWEEN 2 AND 32);

CREATE UNIQUE INDEX IF NOT EXISTS slang_tags_name_unique_ci ON public.slang_tags (lower(name));
CREATE INDEX IF NOT EXISTS slang_tags_owner_idx ON public.slang_tags (owner_id);
CREATE INDEX IF NOT EXISTS slang_tags_kind_idx ON public.slang_tags (kind);

-- ============ Follows ============
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT follows_no_self CHECK (follower_id <> following_id)
);
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS follows_select ON public.follows;
CREATE POLICY follows_select ON public.follows FOR SELECT TO authenticated
  USING (auth.uid() = follower_id OR auth.uid() = following_id);
DROP POLICY IF EXISTS follows_insert_own ON public.follows;
CREATE POLICY follows_insert_own ON public.follows FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id);
DROP POLICY IF EXISTS follows_delete_own ON public.follows;
CREATE POLICY follows_delete_own ON public.follows FOR DELETE TO authenticated
  USING (auth.uid() = follower_id);

CREATE INDEX IF NOT EXISTS follows_following_idx ON public.follows (following_id);

-- ============ Hilfsfunktionen ============
CREATE OR REPLACE FUNCTION public.is_following(_follower uuid, _following uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.follows WHERE follower_id = _follower AND following_id = _following)
$$;
GRANT EXECUTE ON FUNCTION public.is_following(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_use_slang_tag(_tag_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.slang_tags t
    WHERE t.id = _tag_id
      AND (
        t.kind = 'community'
        OR t.owner_id = _user_id
        OR NOT t.follow_required
        OR public.is_following(_user_id, t.owner_id)
      )
  )
$$;
GRANT EXECUTE ON FUNCTION public.can_use_slang_tag(uuid, uuid) TO authenticated;

-- Nur verifizierte Creator/Unternehmen dürfen Creator-SlangTags anlegen.
CREATE OR REPLACE FUNCTION public.enforce_slang_tag_kind()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NEW.owner_id IS NULL THEN NEW.owner_id := NEW.creator_id; END IF;

  IF NEW.kind = 'creator' THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = NEW.owner_id AND p.verified) THEN
      RAISE EXCEPTION 'Nur verifizierte Creator oder Unternehmen duerfen Creator-SlangTags erstellen';
    END IF;
    NEW.owner_type := CASE WHEN NEW.owner_type = 'user' THEN 'creator'::public.slang_tag_owner_type ELSE NEW.owner_type END;
    NEW.verification_status := 'verified';
    NEW.unlock_type := CASE WHEN NEW.unlock_type = 'open' THEN 'follow'::public.slang_tag_unlock_type ELSE NEW.unlock_type END;
    NEW.follow_required := true;
  ELSE
    NEW.owner_type := 'user';
    NEW.unlock_type := 'open';
    NEW.follow_required := false;
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_enforce_slang_tag_kind ON public.slang_tags;
CREATE TRIGGER trg_enforce_slang_tag_kind
  BEFORE INSERT OR UPDATE ON public.slang_tags
  FOR EACH ROW EXECUTE FUNCTION public.enforce_slang_tag_kind();

-- ============ RLS: Eigentümerrechte ============
DROP POLICY IF EXISTS slang_tags_update_own ON public.slang_tags;
CREATE POLICY slang_tags_update_own ON public.slang_tags FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = creator_id)
  WITH CHECK (auth.uid() = owner_id OR auth.uid() = creator_id);

DROP POLICY IF EXISTS slang_tags_delete_own ON public.slang_tags;
CREATE POLICY slang_tags_delete_own ON public.slang_tags FOR DELETE TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = creator_id);

DROP POLICY IF EXISTS slang_tags_insert_own ON public.slang_tags;
CREATE POLICY slang_tags_insert_own ON public.slang_tags FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = creator_id AND auth.uid() = owner_id);