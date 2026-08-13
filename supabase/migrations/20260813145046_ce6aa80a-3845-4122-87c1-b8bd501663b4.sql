CREATE OR REPLACE FUNCTION public.notify_post_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.moderation_status IS DISTINCT FROM OLD.moderation_status
     AND NEW.moderation_status IN ('approved'::moderation_status, 'blocked'::moderation_status) THEN
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

-- Nachtrag: Beiträge, deren Hintergrundprüfung erfolgreich war, deren Ergebnis
-- aber wegen des Fehlers oben nie gespeichert wurde.
UPDATE public.posts p
SET moderation_status = CASE j.result
      WHEN 'allow' THEN 'approved'::moderation_status
      WHEN 'review' THEN 'review'::moderation_status
      WHEN 'block' THEN 'blocked'::moderation_status
      ELSE p.moderation_status END,
    moderated_at = coalesce(p.moderated_at, j.finished_at, now()),
    hidden_at = CASE WHEN j.result = 'block' THEN coalesce(p.hidden_at, now()) ELSE p.hidden_at END
FROM public.post_moderation_jobs j
WHERE j.post_id = p.id
  AND j.status = 'done'
  AND j.result IN ('allow','review','block')
  AND p.moderation_status = 'pending';