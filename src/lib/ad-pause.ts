import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cachedClientRead, invalidateClientCache } from "@/lib/client-cache";


export const AD_PAUSE_MONTHLY_QUOTA = 3;

const pad = (n: number) => String(n).padStart(2, "0");

/** Lokaler Kalendertag als YYYY-MM-DD. */
export const localDateKey = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Lokaler Monat als YYYY-MM. */
export const localMonthKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

/** Nächste lokale Mitternacht (24:00 Uhr Ortszeit des heutigen Tages). */
export const localMidnight = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);

/** Restlaufzeit bis 24:00 Uhr als hh:mm:ss. */
export function formatRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

type PauseRow = { id: string; local_date: string; ends_at: string };

export type AdPauseState = {
  loading: boolean;
  /** Werbepause aktiv (Ortszeit, vor 24:00 Uhr). */
  active: boolean;
  /** Verbleibende Werbepausen im aktuellen Kalendermonat. */
  remaining: number;
  quota: number;
  /** Millisekunden bis 24:00 Uhr Ortszeit. */
  remainingMs: number;
  activate: () => Promise<boolean>;
  /** Kontingent und aktive Pause neu laden. */
  refresh: () => Promise<void>;
};

/** Werbepausen-Kern: Kontingent, aktive Pause und Countdown bis 24:00 Uhr Ortszeit. */
export function useAdPause(userId: string | undefined): AdPauseState {
  const [rows, setRows] = useState<PauseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(
    async (force = false) => {
      if (!userId) {
        setRows([]);
        setLoading(false);
        return;
      }
      const key = `ad-pauses:${userId}:${localMonthKey()}`;
      // Mehrere Verbraucher (Werbefeed, Slider, Einstellungen) teilen sich eine
      // Abfrage: identische Lesevorgaenge werden kurzzeitig zwischengespeichert.
      if (force) invalidateClientCache(key);
      const data = await cachedClientRead(key, async () => {
        const res = await supabase
          .from("ad_pauses")
          .select("id,local_date,ends_at")
          .eq("user_id", userId)
          .eq("month_key", localMonthKey())
          .order("local_date", { ascending: true });
        return res.data ?? [];
      });
      setRows(data ?? []);
      setLoading(false);
    },
    [userId],
  );


  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const today = localDateKey(new Date(now));
  const todayRow = rows.find((r) => r.local_date === today);
  const endsAt = todayRow ? new Date(todayRow.ends_at).getTime() : 0;
  const active = Boolean(todayRow) && endsAt > now;

  const activate = useCallback(async () => {
    if (!userId) return false;
    const nowDate = new Date();
    const { error } = await supabase.from("ad_pauses").insert({
      user_id: userId,
      local_date: localDateKey(nowDate),
      month_key: localMonthKey(nowDate),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      ends_at: localMidnight(nowDate).toISOString(),
    });
    await load(true);
    return !error;
  }, [userId, load]);

  return {
    loading,
    active,
    remaining: Math.max(0, AD_PAUSE_MONTHLY_QUOTA - rows.length),
    quota: AD_PAUSE_MONTHLY_QUOTA,
    remainingMs: active ? endsAt - now : 0,
    activate,
    refresh: () => load(true),

  };
}

export type AdsEnabledState = {
  loading: boolean;
  /** Dauerhafter Werbe-Schalter (nur Admin-Konten). */
  enabled: boolean;
  /** Werbung dauerhaft deaktiviert – gilt ausschliesslich fuer Admin-Konten. */
  disabled: boolean;
  set: (value: boolean) => Promise<boolean>;
};

/**
 * Gemeinsame Quelle fuer den dauerhaften Werbe-Schalter.
 *
 * Alle Verbraucher (Einstellungen, Werbefeed, Slider) lesen denselben Wert und
 * werden bei einer Aenderung sofort benachrichtigt – sonst zeigen die Ansichten
 * unterschiedliche Zustaende, bis sie neu gemountet werden.
 */
const adsStore = {
  value: true as boolean,
  loadedFor: null as string | null,
  /** Laufende Abfrage: gleichzeitige Verbraucher teilen ein Promise. */
  inFlight: null as { userId: string; promise: Promise<boolean> } | null,
  listeners: new Set<() => void>(),
  emit() {
    for (const fn of this.listeners) fn();
  },
};

/**
 * Dauerhafter Werbe-Schalter fuer Admin-Konten.
 *
 * Bewusst ohne Zeit- oder Kontingentlogik: der Wert bleibt bestehen, bis der
 * Admin ihn manuell aendert. Fuer alle anderen Konten bleibt die regulaere
 * Werbepause (`useAdPause`) unveraendert die einzige Steuerung.
 */
export function useAdsEnabled(userId: string | undefined, isAdmin: boolean): AdsEnabledState {
  const [enabled, setEnabled] = useState(adsStore.value);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sync = () => setEnabled(adsStore.value);
    adsStore.listeners.add(sync);
    return () => {
      adsStore.listeners.delete(sync);
    };
  }, []);

  useEffect(() => {
    if (!userId || !isAdmin) {
      adsStore.value = true;
      adsStore.loadedFor = null;
      adsStore.emit();
      setLoading(false);
      return;
    }
    // Bereits fuer dieses Konto geladen: der gemeinsame Wert wird
    // wiederverwendet (mehrere Verbraucher = eine Abfrage).
    if (adsStore.loadedFor === userId) {
      setEnabled(adsStore.value);
      setLoading(false);
      return;
    }
    let alive = true;

    // In-Flight-Dedupe: laeuft schon eine Abfrage fuer dasselbe Konto, warten
    // alle weiteren Verbraucher auf dasselbe Promise (ein REST-Request).
    if (!adsStore.inFlight || adsStore.inFlight.userId !== userId) {
      const promise = (async () => {
        const { data, error } = await supabase
          .from("profiles")
          .select("ads_enabled")
          .eq("id", userId)
          .maybeSingle();
        if (error) console.error("[ads] read failed", error.message);
        adsStore.value = data?.ads_enabled !== false;
        adsStore.loadedFor = userId;
        adsStore.inFlight = null;
        adsStore.emit();
        return adsStore.value;
      })();
      adsStore.inFlight = { userId, promise };
    }

    void adsStore.inFlight.promise.then((value) => {
      if (!alive) return;
      setEnabled(value);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [userId, isAdmin]);

  const set = useCallback(
    async (value: boolean) => {
      if (!userId || !isAdmin) return false;
      const { data, error } = await supabase
        .from("profiles")
        .update({ ads_enabled: value })
        .eq("id", userId)
        .select("ads_enabled")
        .maybeSingle();
      if (error || !data) {
        console.error("[ads] save failed", error?.message ?? "no row");
        return false;
      }
      adsStore.value = data.ads_enabled !== false;
      adsStore.loadedFor = userId;
      adsStore.emit();
      setEnabled(adsStore.value);
      return adsStore.value === value;
    },
    [userId, isAdmin],
  );

  return { loading, enabled, disabled: isAdmin && !enabled, set };
}

