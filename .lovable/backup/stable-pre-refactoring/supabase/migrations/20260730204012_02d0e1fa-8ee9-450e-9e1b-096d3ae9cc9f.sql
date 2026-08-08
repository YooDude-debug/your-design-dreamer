CREATE INDEX IF NOT EXISTS conversation_members_user_idx ON public.conversation_members (user_id);
CREATE INDEX IF NOT EXISTS conversations_last_message_idx ON public.conversations (last_message_at DESC);
CREATE INDEX IF NOT EXISTS messages_sender_idx ON public.messages (sender_id);