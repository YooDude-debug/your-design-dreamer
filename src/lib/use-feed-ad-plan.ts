/**
 * Werbeplan im normalen Feed (Client-Seite).
 *
 * Der Plan kommt serverseitig (variable Abstaende, gemischte Werbearten) und
 * wird hier nur noch auf Beitragspositionen abgebildet. Weggeklickte Werbung
 * bleibt am Beitrag verankert, damit nachladende Beitraege nichts verschieben.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getFeedAdPlan } from "@/lib/ads.functions";
import type { AdPlan, AdPlanSlot } from "@/lib/ad-catalog.shared";

export type FeedAdSlot = AdPlanSlot & { position: number };

export function useFeedAdPlan(enabled: boolean, ready = true) {
  const load = useServerFn(getFeedAdPlan);
  const [plan, setPlan] = useState<AdPlan | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const seen = useRef<string[]>([]);
  const inFlight = useRef(false);

  const request = useCallback(() => {
    // Ein Plan zur Zeit: mehrfach ausgeloeste Effekte teilen denselben Aufruf.
    if (inFlight.current) return;
    inFlight.current = true;
    void load({ data: { seen: seen.current.slice(-20) } })
      .then((p) => setPlan(p as AdPlan))
      .catch(() => undefined)
      .finally(() => {
        inFlight.current = false;
      });
  }, [load]);

  useEffect(() => {
    // Erst nach vollstaendigem Nutzer-Bootstrap, damit der Plan nicht mit
    // leerem Interessenprofil erstellt und danach wiederholt wird.
    if (!enabled || !ready || plan) return;
    request();
  }, [enabled, ready, plan, request]);

  const byIndex = useMemo(() => {
    const map = new Map<number, AdPlanSlot>();
    for (const slot of plan?.slots ?? []) map.set(slot.afterIndex, slot);
    return map;
  }, [plan]);

  const slotFor = useCallback(
    (index: number, postId: string): FeedAdSlot | null => {
      if (!enabled) return null;
      const slot = byIndex.get(index);
      if (!slot || dismissed.includes(postId)) return null;
      return { ...slot, position: index + 1 };
    },
    [byIndex, dismissed, enabled],
  );

  const noteShown = useCallback((adId: string) => {
    if (!seen.current.includes(adId)) seen.current.push(adId);
  }, []);

  const dismiss = useCallback((postId: string) => {
    setDismissed((prev) => (prev.includes(postId) ? prev : [...prev, postId]));
  }, []);

  return { slotFor, dismiss, noteShown, refresh: request };
}
