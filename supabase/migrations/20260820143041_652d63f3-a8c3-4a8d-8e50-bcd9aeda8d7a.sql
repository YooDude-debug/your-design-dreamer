-- Channel-Follow: bestehende Relation channel_follows sauber erweitern.
-- "tier" trennt kostenloses Folgen von einer spaeteren, kostenpflichtigen
-- Mitgliedschaft. Aktuell wird ausschliesslich 'free' geschrieben.
ALTER TABLE public.channel_follows
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'free';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'channel_follows_tier_check'
  ) THEN
    ALTER TABLE public.channel_follows
      ADD CONSTRAINT channel_follows_tier_check CHECK (tier IN ('free', 'paid'));
  END IF;
END $$;

-- Follow-Status-Lookups laufen immer ueber (user_id, channel_id) -> Primary Key.
-- Zusaetzlich die Reihenfolge der persoenlichen Channel-Liste absichern.
CREATE INDEX IF NOT EXISTS idx_channel_follows_user_created
  ON public.channel_follows (user_id, created_at DESC);

GRANT UPDATE (tier) ON public.channel_follows TO authenticated;

DROP POLICY IF EXISTS "own follows update" ON public.channel_follows;
CREATE POLICY "own follows update" ON public.channel_follows
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);