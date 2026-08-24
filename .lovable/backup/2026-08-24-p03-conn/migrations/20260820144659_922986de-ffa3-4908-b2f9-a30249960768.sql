CREATE OR REPLACE FUNCTION public.search_channels(_q text DEFAULT ''::text, _limit integer DEFAULT 20)
 RETURNS TABLE(id uuid, name text, slug text, icon text, category_id uuid, category_name text, category_slug text, followers_count integer, posts_count integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH term AS (SELECT lower(btrim(coalesce(_q, ''))) AS q)
  SELECT c.id, c.name, c.slug, c.icon, c.category_id,
         cat.name, cat.slug, c.followers_count, c.posts_count
  FROM public.channels c
  LEFT JOIN public.channel_categories cat ON cat.id = c.category_id
  CROSS JOIN term
  WHERE c.is_active AND c.is_public
    AND (
      term.q = ''
      OR lower(c.name) LIKE '%' || term.q || '%'
      OR c.slug LIKE '%' || term.q || '%'
      OR EXISTS (
        -- Kategorie-Kette des Channels: eigene Kategorie plus alle Eltern
        WITH RECURSIVE chain AS (
          SELECT k.id, k.name, k.slug, k.parent_category_id
          FROM public.channel_categories k
          WHERE k.id = c.category_id
          UNION ALL
          SELECT p.id, p.name, p.slug, p.parent_category_id
          FROM public.channel_categories p
          JOIN chain ch ON ch.parent_category_id = p.id
        )
        SELECT 1 FROM chain
        WHERE lower(chain.name) LIKE '%' || term.q || '%' OR chain.slug LIKE '%' || term.q || '%'
      )
      OR EXISTS (
        -- direkte Unterkategorien der Channel-Kategorie
        SELECT 1 FROM public.channel_categories sub
        WHERE sub.parent_category_id = c.category_id
          AND sub.is_active
          AND (lower(sub.name) LIKE '%' || term.q || '%' OR sub.slug LIKE '%' || term.q || '%')
      )
    )
  ORDER BY c.followers_count DESC, c.posts_count DESC, c.name
  LIMIT least(greatest(coalesce(_limit, 20), 1), 50);
$function$;