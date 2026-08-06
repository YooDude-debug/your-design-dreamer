CREATE TABLE public.post_originals (
  post_id uuid NOT NULL PRIMARY KEY REFERENCES public.posts(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.post_originals TO authenticated;
GRANT ALL ON public.post_originals TO service_role;

ALTER TABLE public.post_originals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner or admin can read originals"
ON public.post_originals FOR SELECT TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX post_originals_owner_idx ON public.post_originals(owner_id);