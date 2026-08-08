-- Beitragsänderungen laufen ab jetzt ausschliesslich über die serverseitige
-- Moderationsprüfung. Der Browser darf Beiträge weder einfügen noch ändern.
REVOKE UPDATE ON public.posts FROM authenticated;
REVOKE INSERT ON public.posts FROM authenticated;
GRANT ALL ON public.posts TO service_role;