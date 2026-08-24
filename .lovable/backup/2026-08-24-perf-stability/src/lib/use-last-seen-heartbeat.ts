/**
 * Heartbeat für den tatsächlichen Aktivitätszeitpunkt.
 *
 * Solange eine Session besteht und der Tab sichtbar ist, wird
 * `profiles.last_seen_at` über die RPC `touch_last_seen` aktualisiert
 * (serverseitig gedrosselt, wirkt nur auf das eigene Profil).
 */
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const INTERVAL_MS = 120_000;

export function useLastSeenHeartbeat() {
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const ping = async () => {
      if (stopped) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      await supabase.rpc("touch_last_seen");
    };

    void ping();
    timer = setInterval(() => void ping(), INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void ping();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}
