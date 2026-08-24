create temp table bots as select id, username from public.profiles where is_test_bot;

delete from public.arena_votes where submission_id in (select s.id from public.arena_submissions s join bots b on b.id=s.creator_id);
delete from public.arena_comments where submission_id in (select s.id from public.arena_submissions s join bots b on b.id=s.creator_id);
delete from public.arena_likes where submission_id in (select s.id from public.arena_submissions s join bots b on b.id=s.creator_id);
delete from public.arena_plays where submission_id in (select s.id from public.arena_submissions s join bots b on b.id=s.creator_id);
delete from public.arena_votes where user_id in (select id from bots);
delete from public.arena_submissions where creator_id in (select id from bots);

delete from public.post_likes where post_id in (select p.id from public.posts p join bots b on b.id=p.user_id) or user_id in (select id from bots);
delete from public.comments where post_id in (select p.id from public.posts p join bots b on b.id=p.user_id) or user_id in (select id from bots);
delete from public.post_shares where post_id in (select p.id from public.posts p join bots b on b.id=p.user_id) or user_id in (select id from bots);
delete from public.post_views where post_id in (select p.id from public.posts p join bots b on b.id=p.user_id) or user_id in (select id from bots);
delete from public.post_saves where post_id in (select p.id from public.posts p join bots b on b.id=p.user_id) or user_id in (select id from bots);
delete from public.post_hashtags where post_id in (select p.id from public.posts p join bots b on b.id=p.user_id);
delete from public.post_originals where post_id in (select p.id from public.posts p join bots b on b.id=p.user_id);
delete from public.post_moderation_jobs where post_id in (select p.id from public.posts p join bots b on b.id=p.user_id);
delete from public.posts where user_id in (select id from bots);

delete from public.slang_tag_plays where tag_id in (select t.id from public.slang_tags t join bots b on b.id=t.owner_id) or user_id in (select id from bots);
delete from public.slang_tag_likes where tag_id in (select t.id from public.slang_tags t join bots b on b.id=t.owner_id) or user_id in (select id from bots);
delete from public.slang_tag_saves where tag_id in (select t.id from public.slang_tags t join bots b on b.id=t.owner_id) or user_id in (select id from bots);
delete from public.slang_tag_shares where tag_id in (select t.id from public.slang_tags t join bots b on b.id=t.owner_id);
delete from public.slang_tag_votes where tag_id in (select t.id from public.slang_tags t join bots b on b.id=t.owner_id) or user_id in (select id from bots);
delete from public.slang_tag_grants where tag_id in (select t.id from public.slang_tags t join bots b on b.id=t.owner_id);
delete from public.slang_tag_share_requests where tag_id in (select t.id from public.slang_tags t join bots b on b.id=t.owner_id);
delete from public.slang_tag_moderation_events where tag_id in (select t.id from public.slang_tags t join bots b on b.id=t.owner_id);
delete from public.chat_slang_tags where creator_id in (select id from bots);
delete from public.slang_tags where owner_id in (select id from bots);

update public.profiles set language='Deutsch',  location='Berlin, DE'      where username='bot_deniz';
update public.profiles set language='Deutsch',  location='Hamburg, DE'     where username='bot_lina';
update public.profiles set language='Deutsch',  location='Köln, DE'        where username='bot_mia';
update public.profiles set language='Deutsch',  location='München, DE'     where username='bot_jonas';
update public.profiles set language='Deutsch',  location='Leipzig, DE'     where username='bot_svenja';
update public.profiles set language='Ελληνικά', location='Athen, GR'       where username='bot_yannis';
update public.profiles set language='Ελληνικά', location='Katerini, GR'    where username='bot_eleni';
update public.profiles set language='English',  location='London, UK'      where username='bot_sam';
update public.profiles set language='English',  location='Manchester, UK'  where username='bot_chloe';
update public.profiles set language='English',  location='New York, US'    where username='bot_amelie';