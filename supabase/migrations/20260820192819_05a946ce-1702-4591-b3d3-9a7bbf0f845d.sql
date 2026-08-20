DELETE FROM public.message_translations WHERE message_id='22222222-2222-4222-8222-222222222222';
UPDATE public.notification_jobs SET status='pending', attempts=0, next_attempt_at=now()-interval '1 minute', last_error=null
WHERE notification_id IN (SELECT id FROM public.notifications WHERE entity_id='22222222-2222-4222-8222-222222222222');