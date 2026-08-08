DELETE FROM public.messages WHERE conversation_id IN ('ad1da1b7-824b-4b6a-a2e2-592b3fabb19a','2e94c716-31cb-4967-b15a-f347fdaa7b1b');
DELETE FROM public.notifications WHERE entity_id IN ('ad1da1b7-824b-4b6a-a2e2-592b3fabb19a','2e94c716-31cb-4967-b15a-f347fdaa7b1b');
DELETE FROM public.conversation_members WHERE conversation_id IN ('ad1da1b7-824b-4b6a-a2e2-592b3fabb19a','2e94c716-31cb-4967-b15a-f347fdaa7b1b');
DELETE FROM public.conversations WHERE id IN ('ad1da1b7-824b-4b6a-a2e2-592b3fabb19a','2e94c716-31cb-4967-b15a-f347fdaa7b1b');