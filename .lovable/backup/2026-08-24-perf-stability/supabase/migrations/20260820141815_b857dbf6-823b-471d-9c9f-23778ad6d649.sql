-- 1. Rollen-Enum
do $$ begin
  create type public.channel_role as enum ('owner','moderator');
exception when duplicate_object then null; end $$;

-- 2. Channel-Mitglieder (user_id -> channel_id -> role)
create table if not exists public.channel_members (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null,
  role public.channel_role not null default 'moderator',
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (channel_id, user_id)
);
create index if not exists channel_members_user_idx on public.channel_members(user_id);
create index if not exists channel_members_channel_idx on public.channel_members(channel_id, role);

grant select, insert, update, delete on public.channel_members to authenticated;
grant all on public.channel_members to service_role;
alter table public.channel_members enable row level security;

-- 3. Channel-Sperren
create table if not exists public.channel_bans (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null,
  reason text,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (channel_id, user_id)
);
create index if not exists channel_bans_channel_idx on public.channel_bans(channel_id);
create index if not exists channel_bans_user_idx on public.channel_bans(user_id);

grant select, insert, update, delete on public.channel_bans to authenticated;
grant all on public.channel_bans to service_role;
alter table public.channel_bans enable row level security;

-- 4. Beitrags-Felder für Channel-Moderation
alter table public.posts
  add column if not exists channel_pinned boolean not null default false,
  add column if not exists channel_approved_at timestamptz;
create index if not exists posts_channel_pinned_idx on public.posts(channel_id, channel_pinned)
  where channel_id is not null;

-- 5. Berechtigungsfunktionen
create or replace function public.is_channel_owner(_channel_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.channels c
    where c.id = _channel_id and c.owner_id = _user_id
  ) or exists (
    select 1 from public.channel_members m
    where m.channel_id = _channel_id and m.user_id = _user_id and m.role = 'owner'
  );
$$;

create or replace function public.is_channel_moderator(_channel_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select _user_id is not null and (
    public.is_channel_owner(_channel_id, _user_id)
    or exists (
      select 1 from public.channel_members m
      where m.channel_id = _channel_id and m.user_id = _user_id
    )
    or public.has_role(_user_id, 'admin'::app_role)
  );
$$;

create or replace function public.is_channel_banned(_channel_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.channel_bans b
    where b.channel_id = _channel_id and b.user_id = _user_id
  );
$$;

revoke all on function public.is_channel_owner(uuid, uuid) from public;
revoke all on function public.is_channel_moderator(uuid, uuid) from public;
revoke all on function public.is_channel_banned(uuid, uuid) from public;
grant execute on function public.is_channel_owner(uuid, uuid) to authenticated, service_role;
grant execute on function public.is_channel_moderator(uuid, uuid) to authenticated, service_role;
grant execute on function public.is_channel_banned(uuid, uuid) to authenticated, service_role;

-- 6. RLS: channel_members
drop policy if exists "members readable by team" on public.channel_members;
create policy "members readable by team" on public.channel_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_channel_moderator(channel_id, auth.uid()));

drop policy if exists "owners manage members" on public.channel_members;
create policy "owners manage members" on public.channel_members
  for insert to authenticated
  with check (public.is_channel_owner(channel_id, auth.uid()) or public.has_role(auth.uid(), 'admin'::app_role));

drop policy if exists "owners update members" on public.channel_members;
create policy "owners update members" on public.channel_members
  for update to authenticated
  using (public.is_channel_owner(channel_id, auth.uid()) or public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.is_channel_owner(channel_id, auth.uid()) or public.has_role(auth.uid(), 'admin'::app_role));

drop policy if exists "owners delete members" on public.channel_members;
create policy "owners delete members" on public.channel_members
  for delete to authenticated
  using (public.is_channel_owner(channel_id, auth.uid()) or public.has_role(auth.uid(), 'admin'::app_role));

-- 7. RLS: channel_bans
drop policy if exists "bans readable by team" on public.channel_bans;
create policy "bans readable by team" on public.channel_bans
  for select to authenticated
  using (user_id = auth.uid() or public.is_channel_moderator(channel_id, auth.uid()));

drop policy if exists "moderators create bans" on public.channel_bans;
create policy "moderators create bans" on public.channel_bans
  for insert to authenticated
  with check (public.is_channel_moderator(channel_id, auth.uid()));

drop policy if exists "moderators delete bans" on public.channel_bans;
create policy "moderators delete bans" on public.channel_bans
  for delete to authenticated
  using (public.is_channel_moderator(channel_id, auth.uid()));

-- 8. Channels: Moderatoren dürfen ihren Channel lesen
drop policy if exists "moderators read managed channels" on public.channels;
create policy "moderators read managed channels" on public.channels
  for select to authenticated
  using (public.is_channel_moderator(id, auth.uid()));

-- 9. Follower: Team darf Follower des eigenen Channels sehen
drop policy if exists "channel team reads followers" on public.channel_follows;
create policy "channel team reads followers" on public.channel_follows
  for select to authenticated
  using (public.is_channel_moderator(channel_id, auth.uid()));

-- 10. Beiträge: Channel-Moderation (nur Channel-Felder, kein Inhalt)
drop policy if exists "channel team reads channel posts" on public.posts;
create policy "channel team reads channel posts" on public.posts
  for select to authenticated
  using (channel_id is not null and public.is_channel_moderator(channel_id, auth.uid()));

drop policy if exists "channel team moderates channel posts" on public.posts;
create policy "channel team moderates channel posts" on public.posts
  for update to authenticated
  using (channel_id is not null and public.is_channel_moderator(channel_id, auth.uid()))
  with check (channel_id is null or public.is_channel_moderator(channel_id, auth.uid()) or user_id = auth.uid());

create or replace function public.guard_channel_post_moderation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Autor und Plattform-Admins bleiben unberührt.
  if auth.uid() is null or auth.uid() = old.user_id or public.has_role(auth.uid(), 'admin'::app_role) then
    return new;
  end if;

  -- Channel-Moderatoren dürfen ausschliesslich Channel-Zuordnung,
  -- Anpinnen und Freigabe ändern – niemals den Beitragsinhalt.
  if old.channel_id is not null and public.is_channel_moderator(old.channel_id, auth.uid()) then
    new := old;
    new.channel_id := coalesce(nullif(new.channel_id, old.channel_id), new.channel_id);
    return new;
  end if;

  raise exception 'not_allowed';
end $$;

create or replace function public.guard_channel_post_moderation_fields()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or v_uid = old.user_id or public.has_role(v_uid, 'admin'::app_role) then
    return new;
  end if;

  if old.channel_id is not null and public.is_channel_moderator(old.channel_id, v_uid) then
    -- Nur diese drei Felder dürfen von Channel-Moderatoren geändert werden.
    return old #= hstore('') || (
      select hstore('') -- Platzhalter, ersetzt unten
    );
  end if;

  raise exception 'not_allowed';
end $$;

drop function if exists public.guard_channel_post_moderation_fields();

drop trigger if exists trg_guard_channel_post_moderation on public.posts;
create trigger trg_guard_channel_post_moderation
  before update on public.posts
  for each row execute function public.guard_channel_post_moderation();

-- 11. Gesperrte Nutzer dürfen Beiträge nicht diesem Channel zuordnen
create or replace function public.guard_channel_ban_on_post()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.channel_id is not null and public.is_channel_banned(new.channel_id, new.user_id) then
    raise exception 'channel_banned';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_channel_ban_on_post on public.posts;
create trigger trg_guard_channel_ban_on_post
  before insert or update of channel_id on public.posts
  for each row execute function public.guard_channel_ban_on_post();

-- 12. Ersteller automatisch als Owner eintragen
create or replace function public.channel_owner_membership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id is not null then
    insert into public.channel_members (channel_id, user_id, role, created_by)
    values (new.id, new.owner_id, 'owner', new.owner_id)
    on conflict (channel_id, user_id) do update set role = 'owner';
  end if;
  return new;
end $$;

drop trigger if exists trg_channel_owner_membership on public.channels;
create trigger trg_channel_owner_membership
  after insert on public.channels
  for each row execute function public.channel_owner_membership();

insert into public.channel_members (channel_id, user_id, role, created_by)
select c.id, c.owner_id, 'owner', c.owner_id from public.channels c
where c.owner_id is not null
on conflict (channel_id, user_id) do nothing;