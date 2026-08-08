import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Liest die persistierte Supabase-Session im Browser und hält sie aktuell.
 * Läuft ausschließlich in Effekten, damit SSR-HTML und Client-Render identisch
 * bleiben (keine Hydration-Mismatches).
 */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      setChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next ?? null);
      setChecked(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, checked, isSignedIn: Boolean(session) };
}

/**
 * Öffentliche Seiten (Landingpage, Login) leiten angemeldete Nutzer direkt in
 * die App. So landet man nach Refresh oder Zurück-Navigation nicht mehr auf der
 * Landingpage, solange die Session gültig ist.
 */
export function useRedirectWhenSignedIn(to = "/dev") {
  const navigate = useNavigate();
  const { session, checked } = useSession();

  useEffect(() => {
    if (!checked || !session) return;
    void navigate({ to, replace: true });
  }, [checked, session, navigate, to]);

  return { checked, isSignedIn: Boolean(session) };
}
