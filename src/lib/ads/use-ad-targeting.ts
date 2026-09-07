/**
 * Clientseitiger Zugriff auf die Werbefeed-Einstellung.
 *
 * Liest die gespeicherte Auswahl (aktuell `ad_preferences.interests`) und
 * liefert daraus ein `AdTargeting`. Leere Auswahl = keine Einschraenkung.
 * Spaeter kann dieselbe Struktur direkt aus der Werbe-API kommen.
 */

import { useEffect, useState } from "react";
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
      // Jugendschutz: 14–17-Jaehrige erhalten keine interessenbasierte
      // Werbeauswahl. Der Altersstatus kommt serverseitig aus der Datenbank;
      // bei Unsicherheit gilt fail-closed (keine Personalisierung).
      try {
        const { getMyAgeStatus } = await import("@/lib/age-status.functions");
        const { status } = await getMyAgeStatus();
        if (status !== "ADULT_18_PLUS") {
          if (alive) setTargeting(EMPTY_AD_TARGETING);
          return;
        }
      } catch {
        if (alive) setTargeting(EMPTY_AD_TARGETING);
        return;
      }
      const labels = await loadAdInterests(userId);
      if (alive) setTargeting(targetingFromLabels(labels));
    };
    void load();

    const onChange = (e: Event) => {
      const labels = (e as CustomEvent<string[]>).detail;
      // Auch bei einer Aenderung der Auswahl bleibt der Altersschutz massgeblich.
      if (Array.isArray(labels)) void load();
    };
    window.addEventListener(AD_TARGETING_CHANGED, onChange);
    return () => {
      alive = false;
      window.removeEventListener(AD_TARGETING_CHANGED, onChange);
    };
  }, [userId]);

  return targeting;
}
