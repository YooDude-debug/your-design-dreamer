-- Direkte Moderator-Updates auf posts entfernen (zu breit, kollidiert mit Zaehlern)
drop policy if exists "channel team moderates channel posts" on public.posts;
drop trigger if exists trg_guard_channel_post_moderation on public.posts;
drop function if exists public.guard_channel_post_moderation();

-- Moderationsaktionen ausschliesslich ueber geprueften RPC
create or replace function public.channel_moderate_post(
  _post_id uuid,
  _action text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_channel uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select channel_id into v_channel from public.posts where id = _post_id;
  if v_channel is null then
    raise exception 'post_not_in_channel';
  end if;

  if not public.is_channel_moderator(v_channel, v_uid) then
    raise exception 'not_allowed';
  end if;

  if _action = 'approve' then
    update public.posts set channel_approved_at = now() where id = _post_id;
  elsif _action = 'remove' then
    -- Beitrag bleibt vollstaendig erhalten (inkl. SlangTags), nur die
    -- Channel-Zuordnung wird geloest.
    update public.posts
      set channel_id = null, channel_category_id = null,
          channel_pinned = false, channel_approved_at = null
      where id = _post_id;
  elsif _action = 'pin' then
    update public.posts set channel_pinned = true where id = _post_id;
  elsif _action = 'unpin' then
    update public.posts set channel_pinned = false where id = _post_id;
  else
    raise exception 'unknown_action';
  end if;
end $$;

revoke all on function public.channel_moderate_post(uuid, text) from public;
grant execute on function public.channel_moderate_post(uuid, text) to authenticated, service_role;

revoke all on function public.guard_channel_ban_on_post() from public;
revoke all on function public.channel_owner_membership() from public;