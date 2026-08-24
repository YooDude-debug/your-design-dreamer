-- P-06: Missbrauchsbremse fuer Schreibpfade, die der Browser direkt nutzt.
CREATE OR REPLACE FUNCTION public.enforce_write_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  col text := TG_ARGV[0];
  max_rows int := TG_ARGV[1]::int;
  window_min int := TG_ARGV[2]::int;
  owner uuid;
  cnt int;
BEGIN
  IF uid IS NULL THEN
    RETURN NEW;
  END IF;

  EXECUTE format('SELECT ($1).%I', col) INTO owner USING NEW;
  IF owner IS DISTINCT FROM uid THEN
    RETURN NEW;
  END IF;

  EXECUTE format(
    'SELECT count(*) FROM public.%I WHERE %I = $1 AND created_at > now() - ($2 || '' minutes'')::interval',
    TG_TABLE_NAME, col
  ) INTO cnt USING uid, window_min;

  IF cnt >= max_rows THEN
    RAISE EXCEPTION 'RATE_LIMIT: zu viele Schreibvorgaenge, bitte spaeter erneut versuchen';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_write_rate_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS comments_rate_limit ON public.comments;
CREATE TRIGGER comments_rate_limit
  BEFORE INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_write_rate_limit('user_id', '40', '10');

DROP TRIGGER IF EXISTS messages_rate_limit ON public.messages;
CREATE TRIGGER messages_rate_limit
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_write_rate_limit('sender_id', '150', '10');

DROP TRIGGER IF EXISTS slang_tags_rate_limit ON public.slang_tags;
CREATE TRIGGER slang_tags_rate_limit
  BEFORE INSERT ON public.slang_tags
  FOR EACH ROW EXECUTE FUNCTION public.enforce_write_rate_limit('creator_id', '30', '10');