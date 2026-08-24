create or replace function public.can_view_profile(_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  SELECT CASE
    WHEN auth.uid() = _profile_id THEN true
    ELSE COALESCE((
      SELECT CASE p.profile_visibility
        WHEN 'public' THEN true
        WHEN 'connections' THEN public.are_connected(auth.uid(), p.id)
        ELSE false
      END
      FROM public.profiles p
      WHERE p.id = _profile_id
    ), false)
    -- Wer mir eine Anfrage geschickt hat (oder umgekehrt), bleibt identifizierbar,
    -- damit die Anfrage mit Name/Handle/Avatar angezeigt werden kann.
    OR EXISTS (
      SELECT 1 FROM public.connections c
      WHERE (c.requester_id = auth.uid() AND c.addressee_id = _profile_id)
         OR (c.addressee_id = auth.uid() AND c.requester_id = _profile_id)
    )
  END
$$;