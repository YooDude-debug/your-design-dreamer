DELETE FROM public.notification_jobs WHERE notification_id IN (SELECT id FROM public.notifications WHERE entity_id='22222222-2222-4222-8222-222222222222');
DELETE FROM public.notifications WHERE entity_id='22222222-2222-4222-8222-222222222222';
DELETE FROM public.message_translations WHERE message_id='22222222-2222-4222-8222-222222222222';
DELETE FROM public.messages WHERE id='22222222-2222-4222-8222-222222222222';
DELETE FROM public.conversation_members WHERE conversation_id='11111111-1111-4111-8111-111111111111';
DELETE FROM public.conversations WHERE id='11111111-1111-4111-8111-111111111111';
UPDATE public.profiles SET push_enabled=false WHERE username IN ('cp-a-1787238011403','cp-b-1787238011620');