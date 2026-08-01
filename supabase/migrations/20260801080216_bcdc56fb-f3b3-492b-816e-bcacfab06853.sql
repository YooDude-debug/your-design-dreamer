-- Admins dürfen SlangTags löschen (Ersteller/Besitzer-Policy existiert bereits)
CREATE POLICY "slang_tags_delete_admin" ON public.slang_tags
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Serverseitige Löschfunktion inkl. Rechteprüfung und Referenz-Bereinigung
CREATE OR REPLACE FUNCTION public.delete_slang_tag(_tag_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  t public.slang_tags;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO t FROM public.slang_tags WHERE id = _tag_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF NOT (t.owner_id = uid OR t.creator_id = uid OR public.has_role(uid, 'admin')) THEN
    RAISE EXCEPTION 'Not allowed to delete this SlangTag';
  END IF;

  UPDATE public.posts
     SET slang_tag_ids = array_remove(slang_tag_ids, _tag_id),
         placements = COALESCE((
           SELECT jsonb_agg(e)
           FROM jsonb_array_elements(placements) e
           WHERE e->>'tagId' <> _tag_id::text
         ), '[]'::jsonb)
   WHERE _tag_id = ANY(slang_tag_ids)
      OR placements::text LIKE '%' || _tag_id::text || '%';

  UPDATE public.comments
     SET slang_tag_ids = array_remove(slang_tag_ids, _tag_id)
   WHERE _tag_id = ANY(slang_tag_ids);

  UPDATE public.messages
     SET slang_tag_ids = array_remove(slang_tag_ids, _tag_id),
         slang_tag_id = CASE WHEN slang_tag_id = _tag_id THEN NULL ELSE slang_tag_id END
   WHERE _tag_id = ANY(slang_tag_ids) OR slang_tag_id = _tag_id;

  DELETE FROM public.content_categories
   WHERE content_type = 'slang_tag' AND content_id = _tag_id;

  DELETE FROM public.interaction_events
   WHERE content_type = 'slang_tag' AND content_id = _tag_id;

  DELETE FROM public.slang_tags WHERE id = _tag_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_slang_tag(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_slang_tag(uuid) TO authenticated;