-- Ungelesene Nachrichten je Unterhaltung (Zaehler + Sammelmarkierung)
CREATE INDEX IF NOT EXISTS messages_unread_idx
  ON public.messages (conversation_id, sender_id)
  WHERE read_at IS NULL;

-- Mitgliedschaftspruefung: eigene Mitgliedschaften direkt abdecken
CREATE INDEX IF NOT EXISTS conversation_members_user_conv_idx
  ON public.conversation_members (user_id, conversation_id);

-- Lesestatus in EINEM Vorgang: prueft Mitgliedschaft, schreibt nur bei
-- tatsaechlicher Aenderung und liefert zurueck, was geschrieben wurde.
CREATE OR REPLACE FUNCTION public.mark_conversation_read(_conversation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _now timestamptz := now();
  _last_read timestamptz;
  _last_message timestamptz;
  _unread int;
  _touched int := 0;
  _wrote boolean := false;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT cm.last_read_at INTO _last_read
    FROM public.conversation_members cm
   WHERE cm.conversation_id = _conversation_id
     AND cm.user_id = _uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not a member of this conversation';
  END IF;

  SELECT c.last_message_at INTO _last_message
    FROM public.conversations c
   WHERE c.id = _conversation_id;

  SELECT count(*) INTO _unread
    FROM public.messages m
   WHERE m.conversation_id = _conversation_id
     AND m.read_at IS NULL
     AND m.sender_id <> _uid;

  IF _unread > 0 THEN
    UPDATE public.messages m
       SET read_at = _now
     WHERE m.conversation_id = _conversation_id
       AND m.read_at IS NULL
       AND m.sender_id <> _uid;
    _touched := _unread;
  END IF;

  -- Zeitstempel nur schreiben, wenn er wirklich veraltet ist.
  IF _touched > 0
     OR _last_read IS NULL
     OR (_last_message IS NOT NULL AND _last_read < _last_message)
  THEN
    UPDATE public.conversation_members cm
       SET last_read_at = _now
     WHERE cm.conversation_id = _conversation_id
       AND cm.user_id = _uid
       AND (cm.last_read_at IS NULL OR cm.last_read_at < _now);
    _wrote := true;
  END IF;

  RETURN jsonb_build_object(
    'conversation_id', _conversation_id,
    'last_read_at', CASE WHEN _wrote THEN _now ELSE _last_read END,
    'messages_marked', _touched,
    'wrote', _wrote
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_conversation_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;