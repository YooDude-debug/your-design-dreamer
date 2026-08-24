CREATE OR REPLACE FUNCTION public.can_read_content_category(_content_type interest_content_type, _content_id uuid, _owner_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL
     AND (
       _owner_id = auth.uid()
       OR public.has_role(auth.uid(), 'admin')
       OR (
         _content_type IN ('post'::interest_content_type, 'slang_tag'::interest_content_type)
         AND (
           (_content_type = 'post' AND EXISTS (
              SELECT 1 FROM public.posts p
              WHERE p.id = _content_id AND p.hidden_at IS NULL AND p.visibility = 'public'
            ))
           OR (_content_type = 'slang_tag' AND EXISTS (
              SELECT 1 FROM public.slang_tags t
              WHERE t.id = _content_id AND t.deleted_at IS NULL
            ))
         )
       )
     )
$function$;

REVOKE ALL ON FUNCTION public.can_read_content_category(interest_content_type, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_content_category(interest_content_type, uuid, uuid) TO authenticated;