with data(username, name, lang, region, meaning, ex1, ex2, shared, slug) as (values
 ('bot_deniz','moin','Deutsch','Berlin, Deutschland','Grußformel, jederzeit verwendbar','Moin, alles klar?','Moin moin!',true,'deniz_moin'),
 ('bot_deniz','krass','Deutsch','Berlin, Deutschland','Ausdruck von Staunen','Das ist ja krass!','Krass, echt jetzt?',false,'deniz_krass'),
 ('bot_lina','moin','Deutsch','Hamburg, Deutschland','Norddeutscher Gruß zu jeder Tageszeit','Moin, na?','Moin, bis später!',true,'lina_moin'),
 ('bot_lina','digga','Deutsch','Hamburg, Deutschland','Freundschaftliche Anrede','Digga, komm mal her!','Alles gut, Digga?',true,'lina_digga'),
 ('bot_mia','moin','Deutsch','Köln, Deutschland','Kurzer Gruß, auch im Rheinland gebräuchlich','Moin, du auch hier?','Moin!',false,'mia_moin'),
 ('bot_jonas','läuft','Deutsch','München, Deutschland','Bestätigung, dass alles gut läuft','Läuft bei dir!','Läuft.',true,'jonas_laeuft'),
 ('bot_svenja','geil','Deutsch','Leipzig, Deutschland','Ausdruck von Begeisterung','Das ist geil!','Geil gemacht!',true,'svenja_geil'),
 ('bot_yannis','re','Ελληνικά','Athen, Griechenland','Umgangssprachliche Anrede (Griechisch)','Έλα ρε!','Τι κάνεις ρε;',true,'yannis_re'),
 ('bot_yannis','opa','Ελληνικά','Athen, Griechenland','Freudiger Ausruf','Ώπα, τι έγινε;','Ώπα!',true,'yannis_opa'),
 ('bot_eleni','re','Ελληνικά','Katerini, Griechenland','Umgangssprachliche Anrede (Griechisch)','Ρε, σοβαρά;','Άσε ρε!',true,'eleni_re'),
 ('bot_eleni','ela','Ελληνικά','Katerini, Griechenland','Komm / hey (Griechisch)','Έλα, πάμε!','Έλα ντε!',false,'eleni_ela'),
 ('bot_sam','bro','English','London, United Kingdom','Friendly address between mates','You good, bro?','Bro, look at this!',true,'sam_bro'),
 ('bot_sam','yo','English','London, United Kingdom','Casual greeting / call for attention','Yo, over here!','Yo!',false,'sam_yo'),
 ('bot_chloe','bro','English','Manchester, United Kingdom','Friendly address between mates','Alright bro?','Cheers, bro.',true,'chloe_bro'),
 ('bot_amelie','nah','English','New York, United States','Casual refusal or disagreement','Nah, not today.','Nah, forget it.',false,'amelie_nah')
)
insert into public.slang_tags (
  creator_id, owner_id, owner_type, kind, name, language, region,
  audio_url, duration, meaning, description, examples, community_shared, moderation_status, moderated_at
)
select p.id, p.id, 'user', 'community'::slang_tag_kind, d.name, d.lang, d.region,
       p.id || '/audio/' || d.slug || '.mp3', '0:01', d.meaning, d.meaning, array[d.ex1, d.ex2],
       d.shared, 'approved'::moderation_status, now()
from data d join public.profiles p on p.username = d.username and p.is_test_bot;