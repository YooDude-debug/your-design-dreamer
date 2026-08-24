insert into public.profiles (id, username, display_name)
select u.id,
       left(regexp_replace(lower(split_part(u.email, '@', 1)), '[^a-z0-9._-]', '', 'g'), 24)
         || case when exists (
              select 1 from public.profiles p2
              where p2.username = left(regexp_replace(lower(split_part(u.email, '@', 1)), '[^a-z0-9._-]', '', 'g'), 24)
            ) then '_' || left(u.id::text, 4) else '' end,
       left(regexp_replace(lower(split_part(u.email, '@', 1)), '[^a-z0-9._-]', '', 'g'), 24)
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
  and coalesce(u.email, '') <> ''
  and (
    exists (select 1 from public.connections c where c.requester_id = u.id or c.addressee_id = u.id)
    or u.last_sign_in_at is not null
  )
on conflict (id) do nothing;

delete from public.connections c
where not exists (select 1 from auth.users u where u.id = c.requester_id)
   or not exists (select 1 from auth.users u where u.id = c.addressee_id);