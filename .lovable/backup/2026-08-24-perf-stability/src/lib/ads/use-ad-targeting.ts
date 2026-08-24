/**
 * Clientseitiger Zugriff auf die Werbefeed-Einstellung.
 *
 * Liest die gespeicherte Auswahl (aktuell `ad_preferences.interests`) und
 * liefert daraus ein `AdTargeting`. Leere Auswahl = keine Einschraenkung.
 * Spaeter kann dieselbe Struktur direkt aus der Werbe-API kommen.
 */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadAdInterests } from "@/lib/ads/ad-interests";
import {
  EMPTY_AD_TARGETING,
  targetingFromLabels,
  type AdTargeting,
} from "@/lib/ads/ad-targeting.shared";

/** Event-Name, damit ein Speichern der Einstellung sofort greift. */
export const AD_TARGETING_CHANGED = "y-dude:ad-targeting-changed";

export function notifyAdTargetingChanged(labels: string[]) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AD_TARGETING_CHANGED, { detail: labels }));
}

export function useAdTargeting(userId?: string | null): AdTargeting {
  const [targeting, setTargeting] = useState<AdTargeting>(EMPTY_AD_TARGETING);

  useEffect(() => {
    if (!userId) {
      setTargeting(EMPTY_AD_TARGETING);
      return;
    }
    let alive = true;
    const load = async () => {
      const labels = await loadAdInterests(userId);
      if (alive) setTargeting(targetingFromLabels(labels));
    };
    void load();

    const onChange = (e: Event) => {
      const labels = (e as CustomEvent<string[]>).detail;
      if (Array.isArray(labels)) setTargeting(targetingFromLabels(labels));
    };
    window.addEventListener(AD_TARGETING_CHANGED, onChange);
    return () => {
      alive = false;
      window.removeEventListener(AD_TARGETING_CHANGED, onChange);
    };
  }, [userId]);

  return targeting;
}
