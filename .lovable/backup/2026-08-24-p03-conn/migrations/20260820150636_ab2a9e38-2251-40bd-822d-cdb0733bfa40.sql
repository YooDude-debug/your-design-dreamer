with test_users as (
  select u.id from auth.users u where u.email like '%@y-dude.test'
)
delete from public.messages m where m.sender_id in (select id from test_users);

with test_users as (
  select u.id from auth.users u where u.email like '%@y-dude.test'
)
delete from public.conversations c where c.created_by in (select id from test_users);

with test_users as (
  select u.id from auth.users u where u.email like '%@y-dude.test'
)
delete from public.profiles p where p.id in (select id from test_users);