create or replace function public.sync_channel_posts_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.channel_id is not null then
      update public.channels set posts_count = posts_count + 1 where id = new.channel_id;
    end if;
  elsif tg_op = 'DELETE' then
    if old.channel_id is not null then
      update public.channels set posts_count = greatest(posts_count - 1, 0) where id = old.channel_id;
    end if;
  else
    if coalesce(old.channel_id::text, '') <> coalesce(new.channel_id::text, '') then
      if old.channel_id is not null then
        update public.channels set posts_count = greatest(posts_count - 1, 0) where id = old.channel_id;
      end if;
      if new.channel_id is not null then
        update public.channels set posts_count = posts_count + 1 where id = new.channel_id;
      end if;
    end if;
  end if;
  return null;
end;
$$;

revoke execute on function public.sync_channel_posts_count() from public, anon, authenticated;
grant execute on function public.sync_channel_posts_count() to service_role;

drop trigger if exists posts_sync_channel_posts_count on public.posts;
create trigger posts_sync_channel_posts_count
after insert or delete or update of channel_id on public.posts
for each row execute function public.sync_channel_posts_count();

update public.channels c
set posts_count = coalesce(p.cnt, 0)
from (select channel_id, count(*)::int as cnt from public.posts where channel_id is not null group by channel_id) p
where p.channel_id = c.id and c.posts_count <> p.cnt;

update public.channels c
set posts_count = 0
where posts_count <> 0
  and not exists (select 1 from public.posts p where p.channel_id = c.id);