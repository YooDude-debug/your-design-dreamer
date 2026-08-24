-- Restore the original column-level grant matrix on public.profiles
GRANT SELECT (
  id, username, display_name, bio, language, avatar_url, cover_url,
  verified, level, xp, created_at, updated_at, last_seen_at, is_test_bot,
  location_visibility, profile_visibility
) ON public.profiles TO authenticated;

GRANT UPDATE (
  username, display_name, bio, location, language, avatar_url, cover_url,
  location_visibility, profile_visibility
) ON public.profiles TO authenticated;