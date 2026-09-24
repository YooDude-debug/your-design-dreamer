-- READ-ONLY Diagnose: Telemetrie je ORB-Chatnachricht. Keine Änderung an orb_messages oder App-Logik.
CREATE TABLE public.orb_message_telemetry (
  message_id uuid PRIMARY KEY REFERENCES public.orb_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  direction text NOT NULL CHECK (direction IN ('USER','ORB')),
  server_ts timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  client_ts timestamptz,
  char_count integer NOT NULL,
  byte_count integer NOT NULL,
  chat_length integer NOT NULL,
  position integer NOT NULL
);
GRANT SELECT ON public.orb_message_telemetry TO authenticated;
GRANT ALL ON public.orb_message_telemetry TO service_role;
ALTER TABLE public.orb_message_telemetry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads own message telemetry" ON public.orb_message_telemetry
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX orb_message_telemetry_user_pos_idx ON public.orb_message_telemetry (user_id, position);

CREATE OR REPLACE FUNCTION public.orb_record_message_telemetry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pos integer;
BEGIN
  SELECT count(*) INTO pos FROM public.orb_messages m
   WHERE m.user_id = NEW.user_id
     AND (m.created_at, m.id) <= (NEW.created_at, NEW.id);
  INSERT INTO public.orb_message_telemetry
    (message_id, user_id, direction, server_ts, char_count, byte_count, chat_length, position)
  VALUES (NEW.id, NEW.user_id, CASE WHEN NEW.role = 'user' THEN 'USER' ELSE 'ORB' END,
          NEW.created_at, char_length(NEW.body), octet_length(NEW.body), pos, pos)
  ON CONFLICT (message_id) DO NOTHING;
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.orb_record_message_telemetry() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER orb_messages_telemetry_after_insert
  AFTER INSERT ON public.orb_messages
  FOR EACH ROW EXECUTE FUNCTION public.orb_record_message_telemetry();