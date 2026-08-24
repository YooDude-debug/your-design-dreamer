create temp table seed(username text, img text, title text, descr text, region text, hashtags text[], tagname text, x numeric, y numeric, variant text);
insert into seed values
('bot_deniz','seed_deniz_1.jpg','Feierabend am Kanal','Sonne über Kreuzberg, kurz Luft holen.','Berlin, Deutschland','{berlin,feierabend}','moin',28,72,'glass'),
('bot_deniz','seed_deniz_2.jpg','U-Bahn Vibes','Morgens um sieben, alles noch leer.','Berlin, Deutschland','{berlin,alltag}','krass',66,34,'compact'),
('bot_lina','seed_lina_1.jpg','Hafen im Nebel','Elbe früh am Morgen, richtig gute Luft.','Hamburg, Deutschland','{hamburg,hafen}','moin',22,66,'glass'),
('bot_lina','seed_lina_2.jpg','Kaffee to go','Kurzer Stop auf dem Weg zur Arbeit.','Hamburg, Deutschland','{kaffee,alltag}','digga',70,28,'dot'),
('bot_mia','seed_mia_1.jpg','Rheinpromenade','Sonntagsspaziergang mit Blick auf den Dom.','Köln, Deutschland','{koeln,sonntag}','moin',35,60,'glass'),
('bot_mia','seed_mia_2.jpg','Streetfood Markt','Zu viele Optionen, zu wenig Hunger.','Köln, Deutschland','{food,markt}','moin',62,40,'compact'),
('bot_jonas','seed_jonas_1.jpg','Isar Runde','Feierabendrunde bei perfektem Licht.','München, Deutschland','{muenchen,sport}','läuft',30,68,'glass'),
('bot_jonas','seed_jonas_2.jpg','Bergblick','Kurzer Ausflug ins Voralpenland.','München, Deutschland','{berge,reisen}','läuft',72,30,'compact'),
('bot_svenja','seed_svenja_1.jpg','Late Night Studio','Kleine Session bis nachts.','Leipzig, Deutschland','{musik,studio}','geil',26,64,'glass'),
('bot_svenja','seed_svenja_2.jpg','Plattenladen','Fund des Tages für zwei Euro.','Leipzig, Deutschland','{vinyl,shopping}','geil',68,36,'dot'),
('bot_yannis','seed_yannis_1.jpg','Καφές στην Πλάκα','Πρωινός καφές με θέα.','Athen, Griechenland','{athens,coffee}','re',30,70,'glass'),
('bot_yannis','seed_yannis_2.jpg','Sunset Piräus','Το φως εδώ είναι αλλού.','Athen, Griechenland','{sunset,greece}','opa',64,32,'compact'),
('bot_eleni','seed_eleni_1.jpg','Παραλία','Νερό ακόμα κρύο, αλλά αξίζει.','Katerini, Griechenland','{beach,summer}','re',34,62,'glass'),
('bot_eleni','seed_eleni_2.jpg','Οικογενειακό τραπέζι','Πολύ φαγητό, πολλή φασαρία.','Katerini, Griechenland','{family,food}','ela',70,42,'dot'),
('bot_sam','seed_sam_1.jpg','Rooftop after work','London looking decent for once.','London, United Kingdom','{london,afterwork}','bro',28,70,'glass'),
('bot_sam','seed_sam_2.jpg','Tube ride home','Everyone tired, nobody talking.','London, United Kingdom','{london,commute}','yo',66,34,'compact'),
('bot_chloe','seed_chloe_1.jpg','Canal walk','Manchester actually dry today.','Manchester, United Kingdom','{manchester,walk}','bro',32,66,'glass'),
('bot_chloe','seed_chloe_2.jpg','Record shop finds','Spent way too long in here.','Manchester, United Kingdom','{vinyl,music}','bro',68,38,'dot'),
('bot_amelie','seed_amelie_1.jpg','Brooklyn morning','Bagel run before the crowd.','New York, United States','{nyc,morning}','nah',30,68,'glass'),
('bot_amelie','seed_amelie_2.jpg','Subway platform','Waiting on the L, as always.','New York, United States','{nyc,commute}','nah',64,36,'compact');

insert into public.posts (
  user_id, title, description, region, hashtags, image_url, audio_url, duration,
  placements, slang_tag_ids, visibility, moderation_status, moderated_at, created_at
)
select p.id, s.title, s.descr, s.region, s.hashtags,
  p.id || '/images/' || s.img,
  t.audio_url, '0:02',
  jsonb_build_array(jsonb_build_object(
    'id', gen_random_uuid()::text, 'tagId', t.id::text,
    'x', s.x, 'y', s.y, 'scale', 1, 'rotation', 0, 'variant', s.variant)),
  array[t.id], 'public'::post_visibility, 'approved'::moderation_status, now(),
  now() - (row_number() over (order by s.username, s.img) * interval '47 minutes')
from seed s
join public.profiles p on p.username = s.username and p.is_test_bot
join public.slang_tags t on t.owner_id = p.id and t.name = s.tagname;