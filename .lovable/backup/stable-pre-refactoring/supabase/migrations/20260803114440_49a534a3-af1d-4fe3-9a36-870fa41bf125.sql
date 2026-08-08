CREATE TYPE public.location_visibility AS ENUM ('public', 'connections', 'private');

ALTER TABLE public.profiles
  ADD COLUMN location_visibility public.location_visibility NOT NULL DEFAULT 'public';

DROP FUNCTION IF EXISTS public.profile_locations(uuid[]);

CREATE OR REPLACE FUNCTION public.profile_locations(_ids uuid[])
RETURNS TABLE(user_id uuid, location text, location_visibility public.location_visibility)
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
$function$;