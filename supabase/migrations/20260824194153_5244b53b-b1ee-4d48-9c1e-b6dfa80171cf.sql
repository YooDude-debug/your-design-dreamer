CREATE OR REPLACE FUNCTION public.can_read_media(_object_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  owner_seg text;
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
      AND m.sender_id::text = owner_seg
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.chat_slang_tags ct
    JOIN public.conversation_members cm
      ON cm.conversation_id = ct.conversation_id AND cm.user_id = uid
    WHERE (ct.audio_url = _object_name OR ct.audio_url LIKE pattern)
      AND ct.creator_id::text = owner_seg
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE (p.avatar_url LIKE pattern OR p.cover_url LIKE pattern
       OR p.avatar_url = _object_name OR p.cover_url = _object_name)
      AND p.id::text = owner_seg
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.slang_tags t
    WHERE (t.audio_url = _object_name OR t.audio_url LIKE pattern)
      AND t.owner_id::text = owner_seg
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.posts p
    WHERE (p.image_url = _object_name OR p.audio_url = _object_name
           OR p.image_url LIKE pattern OR p.audio_url LIKE pattern)
      AND p.user_id::text = owner_seg
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

  -- Market-Artikelbilder: für alle angemeldeten Nutzer lesbar, solange der
  -- Artikel sichtbar ist. Bearbeiten/Löschen bleibt beim Verkäufer (RLS).
  IF EXISTS (
    SELECT 1
    FROM public.market_images mi
    JOIN public.market_items it ON it.id = mi.item_id
    WHERE (mi.path = _object_name OR mi.path LIKE pattern)
      AND it.seller_id::text = owner_seg
      AND (it.status IN ('active','reserved','sold') OR it.seller_id = uid)
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;

REVOKE ALL ON FUNCTION public.can_read_media(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_media(text) TO authenticated, service_role;