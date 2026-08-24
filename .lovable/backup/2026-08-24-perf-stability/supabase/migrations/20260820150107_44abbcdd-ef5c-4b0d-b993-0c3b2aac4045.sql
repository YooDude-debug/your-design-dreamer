-- Test-Konten des E2E-Laufs (Platzhalter-Profile "dude_xxxxxxxx" der Testnutzer)
with test_users as (
  select u.id
  from auth.users u
  where u.email like '%@y-dude.test'
)
delete from public.posts p where p.user_id in (select id from test_users);

with test_users as (
  select u.id from auth.users u where u.email like '%@y-dude.test'
)
delete from public.channels c
where c.owner_id in (select id from test_users)
   or c.name like 'E2E %'
   or c.name like 'CP %';

with test_users as (
  select u.id from auth.users u where u.email like '%@y-dude.test'
)
delete from public.profiles pr where pr.id in (select id from test_users);