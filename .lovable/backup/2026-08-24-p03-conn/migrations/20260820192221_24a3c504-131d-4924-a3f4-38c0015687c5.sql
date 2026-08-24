-- Temporäre Testeinrichtung für die Prüfung der Push-Sprache.
UPDATE public.profiles SET ui_language='de', push_enabled=true WHERE username='cp-a-1787238011403';
UPDATE public.profiles SET ui_language='el', push_enabled=true WHERE username='cp-b-1787238011620';

WITH a AS (SELECT id FROM public.profiles WHERE username='cp-a-1787238011403'),
     b AS (SELECT id FROM public.profiles WHERE username='cp-b-1787238011620'),
     c AS (
       INSERT INTO public.conversations (id, kind, created_by)
       SELECT '11111111-1111-4111-8111-111111111111', 'direct', a.id FROM a
       RETURNING id
     ),
     m1 AS (
       INSERT INTO public.conversation_members (conversation_id, user_id) SELECT c.id, a.id FROM c, a RETURNING 1
     ),
     m2 AS (
       INSERT INTO public.conversation_members (conversation_id, user_id) SELECT c.id, b.id FROM c, b RETURNING 1
     ),
     msg AS (
       INSERT INTO public.messages (id, conversation_id, sender_id, kind, body, delivered_at)
       SELECT '22222222-2222-4222-8222-222222222222', c.id, a.id, 'text', 'Hallo, wie geht es dir?', now() FROM c, a
       RETURNING id
     )
INSERT INTO public.notifications (user_id, actor_id, type, body, entity_type, entity_id)
SELECT b.id, a.id, 'message', 'hat dir eine Nachricht gesendet', 'message', msg.id FROM a, b, msg;