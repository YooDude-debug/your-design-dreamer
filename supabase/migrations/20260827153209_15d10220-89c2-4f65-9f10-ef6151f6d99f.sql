CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  rec record;
  existing uuid;
  pushed timestamptz;
  cnt int;
BEGIN
  IF NEW.conversation_id IS NULL OR NEW.sender_id IS NULL THEN RETURN NEW; END IF;

  FOR rec IN
    SELECT cm.user_id
      FROM public.conversation_members cm
     WHERE cm.conversation_id = NEW.conversation_id
       AND cm.user_id <> NEW.sender_id
  LOOP
    -- Tatsaechlich ungelesene Nachrichten dieses Absenders in dieser Unterhaltung.
    SELECT count(*)::int INTO cnt
      FROM public.messages m
     WHERE m.conversation_id = NEW.conversation_id
       AND m.sender_id = NEW.sender_id
       AND m.read_at IS NULL;

    -- Buendelung strikt je Absender: verschiedene Absender bleiben getrennt.
    SELECT n.id, n.last_push_at INTO existing, pushed
      FROM public.notifications n
     WHERE n.user_id = rec.user_id
       AND n.type = 'message'
       AND n.entity_type = 'conversation'
       AND n.entity_id = NEW.conversation_id
       AND n.actor_id = NEW.sender_id
       AND n.read = false
     ORDER BY n.created_at DESC
     LIMIT 1;

    IF existing IS NULL THEN
      INSERT INTO public.notifications
        (user_id, actor_id, type, title, body, entity_type, entity_id, link, group_count, last_push_at)
      VALUES (rec.user_id, NEW.sender_id, 'message', 'Neue Nachricht',
              'hat dir eine Nachricht gesendet', 'conversation', NEW.conversation_id,
              '/dev?chat=' || NEW.conversation_id::text, GREATEST(cnt, 1), now());
    ELSE
      UPDATE public.notifications
         SET group_count = GREATEST(cnt, 1),
             read = false,
             created_at = now(),
             link = '/dev?chat=' || NEW.conversation_id::text,
             last_push_at = CASE WHEN pushed IS NULL OR pushed < now() - interval '2 minutes'
                                 THEN now() ELSE pushed END
       WHERE id = existing;

      IF pushed IS NULL OR pushed < now() - interval '2 minutes' THEN
        UPDATE public.notification_jobs
           SET status = 'pending', attempts = 0, next_attempt_at = now(), last_error = NULL
         WHERE notification_id = existing;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;