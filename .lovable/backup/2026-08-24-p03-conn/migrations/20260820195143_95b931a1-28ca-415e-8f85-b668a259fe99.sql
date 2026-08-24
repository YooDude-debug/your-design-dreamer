-- Profil-Detailfunktion: Testkonten für normale Nutzer ausschließen
CREATE OR REPLACE FUNCTION public.profile_details(_ids uuid[])
RETURNS TABLE(user_id uuid, details jsonb)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  r record;
  all_fields jsonb;
  visible jsonb;
  k text;
  vis text;
BEGIN
  IF uid IS NULL THEN RETURN; END IF;

  FOR r IN SELECT * FROM public.profiles p
           WHERE p.id = ANY(_ids) AND public.test_user_visible(p.id) LOOP
    all_fields := jsonb_build_object(
      'origin', r.origin,
      'languages', to_jsonb(r.languages),
      'birthday', r.birthday,
      'pronouns', r.pronouns,
      'interestTags', to_jsonb(r.interest_tags),
      'hobbies', to_jsonb(r.hobbies),
      'music', to_jsonb(r.fav_music),
      'games', to_jsonb(r.fav_games),
      'movies', to_jsonb(r.fav_movies),
      'sports', to_jsonb(r.fav_sports),
      'website', r.website,
      'instagram', r.instagram,
      'tiktok', r.tiktok,
      'youtube', r.youtube,
      'twitch', r.twitch,
      'discord', r.discord
    );

    visible := '{}'::jsonb;
    FOR k IN SELECT jsonb_object_keys(all_fields) LOOP
      IF k = 'birthday' THEN
        vis := 'private';
      ELSE
        vis := COALESCE(r.field_visibility->>k,
                        CASE WHEN k = 'discord' THEN 'private' ELSE 'public' END);
      END IF;
      IF public.can_see_profile_field(r.id, vis) THEN
        visible := visible || jsonb_build_object(k, all_fields->k);
      END IF;
    END LOOP;

    visible := visible || jsonb_build_object(
      'isCreator', public.has_role(r.id, 'creator'),
      'isBusiness', public.has_role(r.id, 'business'));

    IF uid = r.id THEN
      visible := visible || jsonb_build_object(
        'fieldVisibility', COALESCE(r.field_visibility, '{}'::jsonb),
        'firstName', r.first_name,
        'lastName', r.last_name,
        'displayNameMode', r.display_name_mode,
        'usernameChangedAt', r.username_changed_at,
        'displayNameModeChangedAt', r.display_name_mode_changed_at);
    END IF;

    user_id := r.id;
    details := visible;
    RETURN NEXT;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.profile_locations(_ids uuid[])
RETURNS TABLE(user_id uuid, location text, location_visibility location_visibility)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.id,
         CASE
           WHEN p.id = auth.uid() OR public.has_role(auth.uid(), 'admin') THEN p.location
           WHEN p.location_visibility = 'public' THEN p.location
           WHEN p.location_visibility = 'connections' AND public.are_connected(auth.uid(), p.id) THEN p.location
           ELSE ''
         END,
         p.location_visibility
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.id = ANY(_ids)
    AND public.test_user_visible(p.id)
$function$;

-- Kontaktvorschläge: Testkonten werden nie für normale Nutzer erzeugt
CREATE OR REPLACE FUNCTION public.skip_test_user_suggestion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = NEW.suggested_id AND p.is_test_user)
     AND NOT EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = NEW.user_id AND me.is_test_user)
  THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.skip_test_user_suggestion() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS skip_test_user_suggestion ON public.connection_suggestions;
CREATE TRIGGER skip_test_user_suggestion
BEFORE INSERT ON public.connection_suggestions
FOR EACH ROW EXECUTE FUNCTION public.skip_test_user_suggestion();