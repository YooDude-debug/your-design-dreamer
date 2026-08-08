-- Freigaben: welcher SlangTag ist fuer welchen Nutzer nutzbar
CREATE TABLE public.slang_tag_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id uuid NOT NULL REFERENCES public.slang_tags(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  grantee_id uuid NOT NULL,
  granted_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tag_id, grantee_id)
);

GRANT SELECT, INSERT, DELETE ON public.slang_tag_grants TO authenticated;
GRANT ALL ON public.slang_tag_grants TO service_role;
ALTER TABLE public.slang_tag_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grants_select_involved" ON public.slang_tag_grants
FOR SELECT TO authenticated
USING (owner_id = auth.uid() OR grantee_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Nur der Eigentuemer des SlangTags darf freigeben
CREATE POLICY "grants_insert_owner" ON public.slang_tag_grants
FOR INSERT TO authenticated
WITH CHECK (
  granted_by = auth.uid()
  AND grantee_id <> auth.uid()
  AND public.owns_slang_tag(tag_id)
  AND EXISTS (SELECT 1 FROM public.slang_tags t WHERE t.id = tag_id AND t.owner_id = owner_id)
);

-- Eigentuemer entzieht Freigabe, Empfaenger darf sie selbst entfernen
CREATE POLICY "grants_delete_owner_or_grantee" ON public.slang_tag_grants
FOR DELETE TO authenticated
USING (owner_id = auth.uid() OR grantee_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX slang_tag_grants_grantee_idx ON public.slang_tag_grants (grantee_id);
CREATE INDEX slang_tag_grants_tag_idx ON public.slang_tag_grants (tag_id);

-- Darf ein Nutzer diesen SlangTag verwenden? (Eigentuemer/Ersteller oder Freigabe)
CREATE OR REPLACE FUNCTION public.has_slang_tag_grant(_tag_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.slang_tags t
    WHERE t.id = _tag_id AND (t.owner_id = _user_id OR t.creator_id = _user_id)
  ) OR EXISTS (
    SELECT 1 FROM public.slang_tag_grants g
    WHERE g.tag_id = _tag_id AND g.grantee_id = _user_id
  )
$$;

REVOKE ALL ON FUNCTION public.has_slang_tag_grant(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_slang_tag_grant(uuid, uuid) TO authenticated, service_role;

-- Weitergabe-Anfragen
CREATE TYPE public.share_request_status AS ENUM ('pending', 'approved', 'declined');

CREATE TABLE public.slang_tag_share_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id uuid NOT NULL REFERENCES public.slang_tags(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  requester_id uuid NOT NULL,
  target_id uuid NOT NULL,
  status public.share_request_status NOT NULL DEFAULT 'pending',
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.slang_tag_share_requests TO authenticated;
GRANT ALL ON public.slang_tag_share_requests TO service_role;
ALTER TABLE public.slang_tag_share_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "share_requests_select_involved" ON public.slang_tag_share_requests
FOR SELECT TO authenticated
USING (
  owner_id = auth.uid() OR requester_id = auth.uid() OR target_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

-- Anfragen darf nur stellen, wer den SlangTag selbst verwenden darf
CREATE POLICY "share_requests_insert_holder" ON public.slang_tag_share_requests
FOR INSERT TO authenticated
WITH CHECK (
  requester_id = auth.uid()
  AND target_id <> auth.uid()
  AND status = 'pending'
  AND public.has_slang_tag_grant(tag_id, auth.uid())
  AND EXISTS (SELECT 1 FROM public.slang_tags t WHERE t.id = tag_id AND t.owner_id = owner_id)
);

-- Nur der Eigentuemer entscheidet
CREATE POLICY "share_requests_update_owner" ON public.slang_tag_share_requests
FOR UPDATE TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "share_requests_delete_involved" ON public.slang_tag_share_requests
FOR DELETE TO authenticated
USING (owner_id = auth.uid() OR requester_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX slang_tag_share_requests_owner_idx ON public.slang_tag_share_requests (owner_id, status);
CREATE INDEX slang_tag_share_requests_requester_idx ON public.slang_tag_share_requests (requester_id);

CREATE TRIGGER slang_tag_share_requests_touch
BEFORE UPDATE ON public.slang_tag_share_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Genehmigung erzeugt die Freigabe automatisch
CREATE OR REPLACE FUNCTION public.apply_share_request_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> OLD.status AND NEW.status IN ('approved', 'declined') THEN
    NEW.decided_at := now();
  END IF;

  IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
    INSERT INTO public.slang_tag_grants (tag_id, owner_id, grantee_id, granted_by)
    VALUES (NEW.tag_id, NEW.owner_id, NEW.target_id, NEW.owner_id)
    ON CONFLICT (tag_id, grantee_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER slang_tag_share_requests_decision
BEFORE UPDATE ON public.slang_tag_share_requests
FOR EACH ROW EXECUTE FUNCTION public.apply_share_request_decision();