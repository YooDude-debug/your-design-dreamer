CREATE OR REPLACE FUNCTION public.can_read_media(_object_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  owner_seg text;
  owner_uid uuid;
  stem text;
  pattern text;
BEGIN
  IF uid IS NULL OR _object_name IS NULL THEN
    RETURN false;
  END IF;

  owner_seg := (storage.foldername(_object_name))[1];

  IF owner_seg = uid::text THEN
    RETURN true;
  END IF;

  IF owner_seg IS NULL THEN
    RETURN false;
  END IF;

  -- Eigentuemersegment einmalig typisieren: der Vergleich laeuft danach
  -- uuid = uuid gegen die vorhandenen Indizes. Ist das Segment keine UUID,
  -- kann keine Zeile zutreffen (wie bisher) -> false.
  -- Variablenname bewusst nicht `owner_id`: sonst kollidiert er in plpgsql
  -- mit der Spalte `slang_tags.owner_id` (SQLSTATE 42702).
  IF owner_seg !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    RETURN false;
  END IF;
  owner_uid := owner_seg::uuid;

  IF _object_name ~ '__(t|m)\.webp$' THEN
    stem := regexp_replace(_object_name, '__(t|m)\.webp$', '');
  ELSE
    stem := regexp_replace(_object_name, '\.[^./]+$', '');
  END IF;
  pattern := stem || '.%';

  IF EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.conversation_members cm
      ON cm.conversation_id = m.conversation_id AND cm.user_id = uid
    WHERE m.media_url = _object_name
      AND m.sender_id = owner_uid
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.chat_slang_tags ct
    JOIN public.conversation_members cm
      ON cm.conversation_id = ct.conversation_id AND cm.user_id = uid
    WHERE (ct.audio_url = _object_name OR ct.audio_url LIKE pattern)
      AND ct.creator_id = owner_uid
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE (p.avatar_url LIKE pattern OR p.cover_url LIKE pattern
       OR p.avatar_url = _object_name OR p.cover_url = _object_name)
      AND p.id = owner_uid
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.slang_tags t
    WHERE (t.audio_url = _object_name OR t.audio_url LIKE pattern)
      AND t.owner_id = owner_uid
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.posts p
    WHERE (p.image_url = _object_name OR p.audio_url = _object_name
           OR p.image_url LIKE pattern OR p.audio_url LIKE pattern)
      AND p.user_id = owner_uid
      AND p.hidden_at IS NULL
      AND (
        p.user_id = uid
        OR p.visibility = 'public'
        OR (p.visibility = 'connections' AND public.are_connected(uid, p.user_id))
        OR (p.visibility = 'following' AND public.is_following(uid, p.user_id))
      )
  ) THEN
    RETURN true;
  END IF;

  -- Market-Artikelbilder: fuer alle angemeldeten Nutzer lesbar, solange der
  -- Artikel sichtbar ist. Bearbeiten/Loeschen bleibt beim Verkaeufer (RLS).
  IF EXISTS (
    SELECT 1
    FROM public.market_images mi
    JOIN public.market_items it ON it.id = mi.item_id
    WHERE (mi.path = _object_name OR mi.path LIKE pattern)
      AND it.seller_id = owner_uid
      AND (it.status IN ('active','reserved','sold') OR it.seller_id = uid)
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;