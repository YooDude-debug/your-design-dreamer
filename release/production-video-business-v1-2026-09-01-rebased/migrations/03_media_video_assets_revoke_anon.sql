-- Video Upload V1 Härtung: anonyme Rolle braucht keinerlei Zugriff auf die
-- Video-Metadaten. RLS erlaubt anon ohnehin keine Zeile; die Tabellenrechte
-- werden zusätzlich entzogen (Defense in Depth).
REVOKE ALL ON public.media_video_assets FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_video_assets TO authenticated;
GRANT ALL ON public.media_video_assets TO service_role;