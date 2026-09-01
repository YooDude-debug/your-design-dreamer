-- Video Upload V1: serverseitig geprüfte Metadaten je hochgeladenem Video.
create type public.video_processing_status as enum ('uploaded', 'processing', 'ready', 'failed');

create table public.media_video_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  path text not null unique,
  status public.video_processing_status not null default 'uploaded',
  mime_type text,
  container text,
  file_size bigint,
  duration_ms integer,
  width integer,
  height integer,
  aspect_ratio numeric(8,4),
  rotation smallint not null default 0,
  thumbnail_path text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_video_assets_duration_ck
    check (duration_ms is null or (duration_ms > 0 and duration_ms <= 60000)),
  constraint media_video_assets_rotation_ck check (rotation in (0, 90, 180, 270)),
  constraint media_video_assets_dimensions_ck
    check ((width is null and height is null) or (width > 0 and height > 0)),
  -- Ein Video gilt nur als auslieferbar, wenn die Pflichtangaben vorliegen.
  constraint media_video_assets_ready_ck check (
    status <> 'ready'
    or (duration_ms is not null and width is not null and height is not null)
  )
);

grant select, insert, update, delete on public.media_video_assets to authenticated;
grant all on public.media_video_assets to service_role;

alter table public.media_video_assets enable row level security;

create policy "video assets are readable by owner"
  on public.media_video_assets for select
  to authenticated
  using ((select auth.uid()) = owner_id);

-- Schreiben erfolgt ausschließlich serverseitig nach echter Prüfung.
create policy "service role manages video assets"
  on public.media_video_assets for all
  to service_role
  using (true) with check (true);

create index media_video_assets_owner_idx
  on public.media_video_assets (owner_id, created_at desc);
create index media_video_assets_status_idx
  on public.media_video_assets (status) where status <> 'ready';

create trigger media_video_assets_touch
  before update on public.media_video_assets
  for each row execute function public.set_updated_at();