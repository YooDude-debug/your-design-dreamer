ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE;
GRANT SELECT (parent_id), INSERT (parent_id) ON public.comments TO authenticated;

CREATE OR REPLACE FUNCTION public.push_notify(
  p_user uuid, p_actor uuid, p_type text, p_title text, p_body text,
  p_entity_type text, p_entity_id uuid, p_link text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_user IS NULL OR p_user = p_actor THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, actor_id, type, title, body, entity_type, entity_id, link)
  VALUES (p_user, p_actor, p_type, p_title, p_body, p_entity_type, p_entity_id, p_link);
END;
$$;
REVOKE ALL ON FUNCTION public.push_notify(uuid,uuid,text,text,text,text,uuid,text) FROM PUBLIC, anon, authenticated;

-- Like auf Beitrag
CREATE OR REPLACE FUNCTION public.notify_post_like() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner uuid;
BEGIN
  SELECT user_id INTO owner FROM public.posts WHERE id = NEW.post_id;
  PERFORM public.push_notify(owner, NEW.user_id, 'post_like', 'Neues Like',
    'hat deinen Beitrag geliked.', 'post', NEW.post_id, '/p/' || NEW.post_id::text);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_post_like() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS post_likes_notify ON public.post_likes;
CREATE TRIGGER post_likes_notify AFTER INSERT ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_post_like();

-- Kommentar, Antwort, Erwähnung
CREATE OR REPLACE FUNCTION public.notify_comment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  owner uuid;
  parent_author uuid;
  mentioned uuid;
  handle text;
  link text := '/p/' || NEW.post_id::text;
BEGIN
  SELECT user_id INTO owner FROM public.posts WHERE id = NEW.post_id;
  PERFORM public.push_notify(owner, NEW.user_id, 'comment', 'Neuer Kommentar',
    'hat deinen Beitrag kommentiert.', 'comment', NEW.id, link);

  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO parent_author FROM public.comments WHERE id = NEW.parent_id;
    IF parent_author IS DISTINCT FROM owner THEN
      PERFORM public.push_notify(parent_author, NEW.user_id, 'comment_reply', 'Neue Antwort',
        'hat auf deinen Kommentar geantwortet.', 'comment', NEW.id, link);
    END IF;
  END IF;

  FOR handle IN
    SELECT DISTINCT lower(m[1]) FROM regexp_matches(coalesce(NEW.body,''), '@([A-Za-z0-9_.]{2,40})', 'g') AS m
  LOOP
    SELECT id INTO mentioned FROM public.profiles WHERE lower(username) = handle;
    IF mentioned IS NOT NULL AND mentioned IS DISTINCT FROM owner AND mentioned IS DISTINCT FROM parent_author THEN
      PERFORM public.push_notify(mentioned, NEW.user_id, 'mention', 'Erwähnung',
        'hat dich in einem Kommentar erwähnt.', 'comment', NEW.id, link);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_comment() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS comments_notify ON public.comments;
CREATE TRIGGER comments_notify AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_comment();

-- SlangTag geliked
CREATE OR REPLACE FUNCTION public.notify_slangtag_like() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE creator uuid; tag_name text;
BEGIN
  SELECT creator_id, name INTO creator, tag_name FROM public.slang_tags WHERE id = NEW.tag_id;
  PERFORM public.push_notify(creator, NEW.user_id, 'slangtag_liked', 'SlangTag geliked',
    'hat deinen SlangTag $' || coalesce(tag_name,'') || ' geliked.', 'slangtag', NEW.tag_id,
    '/slangtag/' || coalesce(tag_name,''));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_slangtag_like() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS slang_tag_likes_notify ON public.slang_tag_likes;
CREATE TRIGGER slang_tag_likes_notify AFTER INSERT ON public.slang_tag_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_slangtag_like();

-- SlangTag in Beitrag verwendet
CREATE OR REPLACE FUNCTION public.notify_slangtag_used() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record;
BEGIN
  IF NEW.slang_tag_ids IS NULL OR array_length(NEW.slang_tag_ids, 1) IS NULL THEN RETURN NEW; END IF;
  FOR t IN
    SELECT id, name, creator_id FROM public.slang_tags
     WHERE id = ANY (NEW.slang_tag_ids) AND creator_id IS DISTINCT FROM NEW.user_id
  LOOP
    PERFORM public.push_notify(t.creator_id, NEW.user_id, 'slangtag_used', 'SlangTag verwendet',
      'hat deinen SlangTag $' || coalesce(t.name,'') || ' verwendet.', 'post', NEW.id,
      '/p/' || NEW.id::text);
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_slangtag_used() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS posts_notify_slangtag_used ON public.posts;
CREATE TRIGGER posts_notify_slangtag_used AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_slangtag_used();

-- Moderation abgeschlossen
CREATE OR REPLACE FUNCTION public.notify_post_moderation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.moderation_status IS DISTINCT FROM OLD.moderation_status
     AND NEW.moderation_status IN ('approved', 'rejected') THEN
    PERFORM public.push_notify(NEW.user_id, NULL, 'moderation',
      CASE WHEN NEW.moderation_status = 'approved' THEN 'Beitrag freigegeben' ELSE 'Beitrag abgelehnt' END,
      CASE WHEN NEW.moderation_status = 'approved'
        THEN 'Dein Beitrag ist jetzt sichtbar.'
        ELSE 'Dein Beitrag wurde abgelehnt: ' || coalesce(NEW.moderation_reason, 'Regelverstoß') END,
      'post', NEW.id, '/p/' || NEW.id::text);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_post_moderation() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS posts_notify_moderation ON public.posts;
CREATE TRIGGER posts_notify_moderation AFTER UPDATE OF moderation_status ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_post_moderation();

-- Werbe-Kampagnenstatus
CREATE OR REPLACE FUNCTION public.notify_campaign_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.push_notify(NEW.owner_id, NULL, 'ad_campaign', 'Kampagnenstatus',
      'Kampagne "' || coalesce(NEW.name,'') || '" ist jetzt: ' || coalesce(NEW.status,''),
      'campaign', NEW.id, '/arena');
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_campaign_status() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS ad_campaigns_notify_status ON public.ad_campaigns;
CREATE TRIGGER ad_campaigns_notify_status AFTER UPDATE OF status ON public.ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.notify_campaign_status();