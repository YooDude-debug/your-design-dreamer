CREATE INDEX IF NOT EXISTS market_searches_notify_idx ON public.market_searches (notify) WHERE notify;

CREATE OR REPLACE FUNCTION public.market_notify_saved_searches()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  s record;
  terms text[];
  hay text;
  ok boolean;
  term text;
  qmax numeric;
  qcat text;
  qlat numeric;
  qlon numeric;
  qrad numeric;
  dist numeric;
  existing uuid;
  pushed timestamptz;
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;
  hay := lower(coalesce(NEW.title,'') || ' ' || coalesce(NEW.description,''));

  FOR s IN
    SELECT id, user_id, label, query
      FROM public.market_searches
     WHERE notify AND user_id <> NEW.seller_id
     LIMIT 500
  LOOP
    terms := ARRAY(SELECT jsonb_array_elements_text(coalesce(s.query->'terms','[]'::jsonb)));
    CONTINUE WHEN array_length(terms,1) IS NULL;

    ok := true;
    FOREACH term IN ARRAY terms LOOP
      IF position(lower(term) in hay) = 0 THEN ok := false; EXIT; END IF;
    END LOOP;
    CONTINUE WHEN NOT ok;

    qmax := nullif(s.query->>'priceMaxCents','')::numeric;
    IF qmax IS NOT NULL AND NEW.price_cents > qmax THEN CONTINUE; END IF;

    qcat := nullif(s.query->>'categoryId','');
    IF qcat IS NOT NULL AND (NEW.category_id IS NULL OR NEW.category_id::text <> qcat) THEN CONTINUE; END IF;

    qlat := nullif(s.query->>'lat','')::numeric;
    qlon := nullif(s.query->>'lon','')::numeric;
    qrad := nullif(s.query->>'radiusKm','')::numeric;
    IF qlat IS NOT NULL AND qlon IS NOT NULL AND qrad IS NOT NULL THEN
      IF NEW.lat IS NULL OR NEW.lon IS NULL THEN CONTINUE; END IF;
      dist := 6371 * 2 * asin(sqrt(
        power(sin(radians(NEW.lat - qlat) / 2), 2) +
        cos(radians(qlat)) * cos(radians(NEW.lat)) *
        power(sin(radians(NEW.lon - qlon) / 2), 2)
      ));
      IF dist > qrad THEN CONTINUE; END IF;
    END IF;

    SELECT n.id, n.last_push_at INTO existing, pushed
      FROM public.notifications n
     WHERE n.user_id = s.user_id
       AND n.type = 'market_match'
       AND n.entity_id = s.id
       AND n.created_at > now() - interval '6 hours'
     ORDER BY n.created_at DESC
     LIMIT 1;

    IF existing IS NULL THEN
      INSERT INTO public.notifications
        (user_id, actor_id, type, title, body, entity_type, entity_id, link, group_count, last_push_at)
      VALUES (s.user_id, NULL, 'market_match', 'Neues Market-Angebot',
              left(coalesce(NEW.title,''), 120),
              'market_search', s.id, '/market/' || NEW.id::text, 1, now());
    ELSE
      UPDATE public.notifications
         SET group_count = group_count + 1,
             body = left(coalesce(NEW.title,''), 120),
             read = false,
             created_at = now(),
             link = '/market/' || NEW.id::text,
             last_push_at = CASE WHEN pushed IS NULL OR pushed < now() - interval '10 minutes'
                                 THEN now() ELSE pushed END
       WHERE id = existing;

      IF pushed IS NULL OR pushed < now() - interval '10 minutes' THEN
        UPDATE public.notification_jobs
           SET status = 'pending', attempts = 0, next_attempt_at = now(), last_error = NULL
         WHERE notification_id = existing;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS market_items_notify_searches ON public.market_items;
CREATE TRIGGER market_items_notify_searches
AFTER INSERT ON public.market_items
FOR EACH ROW EXECUTE FUNCTION public.market_notify_saved_searches();