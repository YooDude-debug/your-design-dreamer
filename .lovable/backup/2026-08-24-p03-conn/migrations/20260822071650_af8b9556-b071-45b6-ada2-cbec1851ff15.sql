-- Cleanup: verwaiste Vorschlags-Datensaetze und alte Werbe-Testtelemetrie entfernen
DELETE FROM public.connection_suggestions cs
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = cs.user_id)
   OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = cs.suggested_id);

DELETE FROM public.ad_test_events WHERE created_at < now() - interval '1 day';

DELETE FROM public.slang_tag_plays q
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = q.user_id) AND q.user_id IS NOT NULL;

DELETE FROM public.feed_signals s
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = s.user_id);

DELETE FROM public.notification_jobs WHERE created_at < now() - interval '2 days';