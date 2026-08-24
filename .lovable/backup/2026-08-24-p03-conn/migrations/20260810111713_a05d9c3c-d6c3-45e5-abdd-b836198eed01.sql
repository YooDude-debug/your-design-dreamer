CREATE OR REPLACE FUNCTION public.guard_connection_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin')
     OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Systemfelder sind unveraenderlich
  NEW.id := OLD.id;
  NEW.requester_id := OLD.requester_id;
  NEW.addressee_id := OLD.addressee_id;
  NEW.created_at := OLD.created_at;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF auth.uid() IS DISTINCT FROM OLD.addressee_id THEN
      RAISE EXCEPTION 'Nur der Empfaenger darf eine Connection-Anfrage entscheiden';
    END IF;
    IF OLD.status <> 'pending' THEN
      RAISE EXCEPTION 'Der Status dieser Connection kann nicht mehr geaendert werden';
    END IF;
    IF NEW.status NOT IN ('accepted', 'declined') THEN
      RAISE EXCEPTION 'Ungueltiger Statuswechsel fuer Connections';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_connection_update ON public.connections;
CREATE TRIGGER guard_connection_update
BEFORE UPDATE ON public.connections
FOR EACH ROW EXECUTE FUNCTION public.guard_connection_update();

DROP POLICY IF EXISTS connections_update ON public.connections;
CREATE POLICY connections_update ON public.connections
FOR UPDATE TO authenticated
USING (auth.uid() = addressee_id AND status = 'pending')
WITH CHECK (auth.uid() = addressee_id AND status IN ('accepted', 'declined'));