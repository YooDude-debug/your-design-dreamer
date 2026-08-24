CREATE TYPE public.moderation_status AS ENUM ('pending','approved','review','blocked');

ALTER TABLE public.slang_tags
  ADD COLUMN moderation_status public.moderation_status NOT NULL DEFAULT 'approved',
  ADD COLUMN transcript text NOT NULL DEFAULT '',
  ADD COLUMN moderation_reason text NOT NULL DEFAULT '',
  ADD COLUMN moderation_labels text[] NOT NULL DEFAULT '{}',
  ADD COLUMN moderation_is_music boolean NOT NULL DEFAULT false,
  ADD COLUMN moderation_confidence numeric NOT NULL DEFAULT 0,
  ADD COLUMN moderation_ai jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN moderated_at timestamptz,
  ADD COLUMN moderated_by uuid;

ALTER TABLE public.slang_tags ALTER COLUMN moderation_status SET DEFAULT 'pending';

CREATE INDEX idx_slang_tags_moderation_status ON public.slang_tags (moderation_status);

DROP POLICY IF EXISTS slang_tags_select ON public.slang_tags;
CREATE POLICY slang_tags_select ON public.slang_tags
FOR SELECT TO authenticated
USING (
  (deleted_at IS NULL AND moderation_status = 'approved')
  OR auth.uid() = owner_id
  OR auth.uid() = creator_id
  OR public.has_role(auth.uid(), 'admin')
);

CREATE TABLE public.slang_tag_moderation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id uuid NOT NULL REFERENCES public.slang_tags(id) ON DELETE CASCADE,
  actor_type text NOT NULL DEFAULT 'ai',
  actor_id uuid,
  actor_username text NOT NULL DEFAULT '',
  action text NOT NULL,
  from_status public.moderation_status,
  to_status public.moderation_status,
  reason text NOT NULL DEFAULT '',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.slang_tag_moderation_events TO authenticated;
GRANT ALL ON public.slang_tag_moderation_events TO service_role;

ALTER TABLE public.slang_tag_moderation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY slang_tag_moderation_events_select_admin ON public.slang_tag_moderation_events
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_slang_tag_moderation_events_tag ON public.slang_tag_moderation_events (tag_id, created_at DESC);