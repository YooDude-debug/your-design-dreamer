CREATE TABLE public.orb_visual_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scope text NOT NULL CHECK (scope IN ('normal','orb_core','y_dude')),
  build_id text NOT NULL,
  intent_kind text NOT NULL CHECK (intent_kind IN ('explicit','autonomous')),
  intent_category text NOT NULL,
  prompt_hash text NOT NULL,
  model text NOT NULL,
  status text NOT NULL DEFAULT 'started' CHECK (status IN ('started','ok','provider_error','invalid_image','quota')),
  failure_reason text,
  http_status integer,
  input_tokens integer,
  output_tokens integer,
  catalog_cost numeric,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.orb_visual_generations TO authenticated;
GRANT ALL ON public.orb_visual_generations TO service_role;
ALTER TABLE public.orb_visual_generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orb_visual_own_select" ON public.orb_visual_generations FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "orb_visual_own_insert" ON public.orb_visual_generations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'started');
CREATE POLICY "orb_visual_own_update" ON public.orb_visual_generations FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX orb_visual_generations_user_created_idx ON public.orb_visual_generations (user_id, created_at DESC, id);