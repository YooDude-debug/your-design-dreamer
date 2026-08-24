create or replace function public.notify_post_mentions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  handle text;
  mentioned uuid;
  txt text := coalesce(NEW.description,'') || ' ' || coalesce(NEW.title,'');
  old_txt text := '';
BEGIN
  IF TG_OP = 'UPDATE' THEN
    old_txt := coalesce(OLD.description,'') || ' ' || coalesce(OLD.title,'');
  END IF;

  FOR handle IN
    SELECT DISTINCT lower(m[1])
    FROM regexp_matches(txt, '@([A-Za-z0-9_.]{2,40})', 'g') AS m
  LOOP
    IF TG_OP = 'UPDATE' AND old_txt ILIKE '%@' || handle || '%' THEN
      CONTINUE;
    END IF;
    SELECT id INTO mentioned FROM public.profiles WHERE lower(username) = handle;
    IF mentioned IS NOT NULL AND mentioned IS DISTINCT FROM NEW.user_id THEN
      PERFORM public.push_notify(mentioned, NEW.user_id, 'mention', 'Erwähnung',
        'hat dich in einem Beitrag erwähnt.', 'post', NEW.id, '/p/' || NEW.id::text);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

revoke all on function public.notify_post_mentions() from public, anon, authenticated;

drop trigger if exists trg_notify_post_mentions on public.posts;
create trigger trg_notify_post_mentions
after insert or update of description, title on public.posts
for each row execute function public.notify_post_mentions();