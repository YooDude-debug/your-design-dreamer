create temp table bots as select id, username, row_number() over (order by username) rn from public.profiles where is_test_bot;
create temp table bp as select id, user_id, row_number() over (order by created_at desc) rn from public.posts where user_id in (select id from bots);

-- Likes: jeder Bot likt Beiträge anderer Bots (deterministisch gestreut)
insert into public.post_likes (post_id, user_id, created_at)
select p.id, b.id, now() - (random() * interval '2 days')
from bp p join bots b on b.id <> p.user_id
where (p.rn * 7 + b.rn * 3) % 5 < 3
on conflict do nothing;

-- Views: breiter als Likes
insert into public.post_views (post_id, user_id, created_at)
select p.id, b.id, now() - (random() * interval '2 days')
from bp p join bots b on b.id <> p.user_id
where (p.rn * 5 + b.rn) % 4 < 3
on conflict do nothing;

-- Shares: selten
insert into public.post_shares (post_id, user_id, created_at)
select p.id, b.id, now() - (random() * interval '2 days')
from bp p join bots b on b.id <> p.user_id
where (p.rn * 11 + b.rn * 5) % 17 = 0
on conflict do nothing;

-- Saves: selten
insert into public.post_saves (post_id, user_id, created_at)
select p.id, b.id, now() - (random() * interval '2 days')
from bp p join bots b on b.id <> p.user_id
where (p.rn * 13 + b.rn * 7) % 19 = 0
on conflict do nothing;

-- Kommentare
insert into public.comments (post_id, user_id, body, created_at)
select p.id, b.id,
  (array['Stark!','Sehr nice.','Da will ich auch hin.','Klasse Aufnahme.','Πολύ ωραίο!','Love this.','Clean shot.','Wo genau ist das?'])[1 + ((p.rn * 3 + b.rn * 5) % 8)],
  now() - (random() * interval '2 days')
from bp p join bots b on b.id <> p.user_id
where (p.rn * 9 + b.rn * 4) % 7 = 0;

-- SlangTag-Plays
insert into public.slang_tag_plays (tag_id, user_id, created_at)
select t.id, b.id, now() - (random() * interval '3 days')
from public.slang_tags t
join bots o on o.id = t.owner_id
join bots b on b.id <> t.owner_id
where (o.rn * 5 + b.rn * 3) % 3 < 2;

-- Arena: freigegebene Tags einreichen
insert into public.arena_submissions (challenge_id, creator_id, tag_id, pitch, created_at)
select '44444444-4444-4444-8444-000000000001', t.owner_id, t.id,
  'Mein ' || t.name || ' – typisch für ' || coalesce(t.region,'meine Region') || '.',
  now() - (random() * interval '3 days')
from public.slang_tags t
where t.owner_id in (select id from bots) and t.community_shared;

-- Arena-Votes
insert into public.arena_votes (submission_id, user_id, created_at)
select s.id, b.id, now() - (random() * interval '2 days')
from public.arena_submissions s
join bots b on b.id <> s.creator_id
where s.creator_id in (select id from bots)
  and (b.rn * 7 + length(s.pitch)) % 4 < 2
on conflict do nothing;

-- Zähler synchronisieren
update public.posts p set
  likes_count    = (select count(*) from public.post_likes  x where x.post_id = p.id),
  comments_count = (select count(*) from public.comments    x where x.post_id = p.id),
  shares_count   = (select count(*) from public.post_shares x where x.post_id = p.id),
  views_count    = (select count(*) from public.post_views  x where x.post_id = p.id),
  saves_count    = (select count(*) from public.post_saves  x where x.post_id = p.id)
where p.user_id in (select id from bots);

update public.arena_submissions s set
  votes_count = (select count(*) from public.arena_votes v where v.submission_id = s.id)
where s.creator_id in (select id from bots);