-- 1) Spaltenrechte: normale Nutzer dürfen nur Lese-/Zustellstatus setzen.
revoke update on public.messages from authenticated;
grant update (read_at, delivered_at) on public.messages to authenticated;
revoke update on public.messages from anon;
grant all on public.messages to service_role;

-- 2) Trigger-Schutz greift auch ohne Nutzerkennung (nur service_role/Eigentümer sind ausgenommen).
create or replace function public.guard_message_content_edits()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
BEGIN
  IF current_user in ('service_role', 'supabase_admin', 'postgres') THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL OR auth.uid() <> OLD.sender_id THEN
    IF NEW.body IS DISTINCT FROM OLD.body
       OR NEW.media_url IS DISTINCT FROM OLD.media_url
       OR NEW.kind IS DISTINCT FROM OLD.kind
       OR NEW.slang_tag_id IS DISTINCT FROM OLD.slang_tag_id
       OR NEW.slang_tag_ids IS DISTINCT FROM OLD.slang_tag_ids
       OR NEW.chat_slang_tag_id IS DISTINCT FROM OLD.chat_slang_tag_id
       OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
       OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id THEN
      RAISE EXCEPTION 'Only the sender may edit message content';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

create or replace function public.guard_message_read_state_update()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
BEGIN
  IF current_user in ('service_role', 'supabase_admin', 'postgres') THEN
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
    OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
    OR NEW.kind IS DISTINCT FROM OLD.kind
    OR NEW.body IS DISTINCT FROM OLD.body
    OR NEW.media_url IS DISTINCT FROM OLD.media_url
    OR NEW.slang_tag_id IS DISTINCT FROM OLD.slang_tag_id
    OR NEW.slang_tag_ids IS DISTINCT FROM OLD.slang_tag_ids
    OR NEW.chat_slang_tag_id IS DISTINCT FROM OLD.chat_slang_tag_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Only read/delivery timestamps may be updated on messages';
  END IF;
  RETURN NEW;
END;
$function$;

revoke execute on function public.guard_message_content_edits() from public, anon, authenticated;
revoke execute on function public.guard_message_read_state_update() from public, anon, authenticated;