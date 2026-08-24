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

  FOR r IN SELECT * FROM public.profiles p WHERE p.id = ANY(_ids) LOOP
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
      -- Geburtsdatum ist niemals oeffentlich, unabhaengig von Einstellungen
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

    -- Oeffentliche Kontokennzeichen (nur Creator/Unternehmer, niemals Admin)
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