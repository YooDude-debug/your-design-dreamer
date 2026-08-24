/**
 * Globe Vote – wöchentliche Abstimmungsrunde (serverseitige Zeitrechnung).
 *
 * Die Runde kommt ausschließlich aus der Datenbank (`globe_vote_current_round`).
 * Der Aufruf schließt fällige Runden (Gewinner → Globe, Rest raus aus der
 * aktiven Liste) und startet automatisch die nächste 7-Tage-Runde. Der Client
 * rechnet nur die Restzeit gegen die Serverzeit – eine verstellte Client-Uhr
 * hat keinen Einfluss.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type GlobeVoteRound = {
  id: string;
  roundNo: number;
  startsAt: number;
  endsAt: number;
  entries: number;
  /** Differenz Server- zu Clientuhr in Millisekunden. */
  skewMs: number;
};

export function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return d > 0 ? `${d}d ${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Positive Quote: Likes ÷ (Likes + Dislikes). 0, wenn niemand abgestimmt hat. */
export function positiveQuote(up: number, down: number) {
  const total = up + down;
  return total === 0 ? 0 : up / total;
}

export function useGlobeVoteRound() {
  const [round, setRound] = useState<GlobeVoteRound | null>(null);
  const [remaining, setRemaining] = useState(0);
  const loading = useRef(false);

  const load = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      const { data } = await supabase.rpc("globe_vote_current_round");
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return;
      const serverNow = new Date(row.server_now as string).getTime();
      setRound({
        id: row.id as string,
        roundNo: Number(row.round_no ?? 0),
        startsAt: new Date(row.starts_at as string).getTime(),
        endsAt: new Date(row.ends_at as string).getTime(),
        entries: Number(row.entries ?? 0),
        skewMs: serverNow - Date.now(),
      });
    } finally {
      loading.current = false;
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!round) return;
    const tick = () => {
      const left = round.endsAt - (Date.now() + round.skewMs);
      setRemaining(left);
      // Runde vorbei: Server entscheidet über Gewinner und startet die nächste.
      if (left <= 0) void load();
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [round, load]);

  return useMemo(
    () => ({ round, remaining, countdown: formatCountdown(remaining), reload: load }),
    [round, remaining, load],
  );
}
