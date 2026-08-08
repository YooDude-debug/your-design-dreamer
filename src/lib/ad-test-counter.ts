/**
 * Zähler für den Werbe-Live-Test im Hauptfeed.
 *
 * Gezählt werden ausschließlich echte Feed-Interaktionen:
 *  - Öffnen eines Beitrags
 *  - Wechsel zum nächsten/vorherigen Beitrag in der Detailansicht
 *
 * Normales Scrollen erzeugt KEINE Interaktion. Sichtbarkeit wird getrennt
 * als eigene Impression gemeldet (siehe `noteFeedImpression`).
 *
 * Erreicht der Zähler den konfigurierten Schwellwert (15 oder 25), wird eine
 * Werbekarte für die nächste Feed-Position eingeplant.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getLiveTestSettings, recordAdTestEvent } from "@/lib/live-test.functions";
import { SPONSORED_ADS, type SponsoredAd } from "@/lib/ad-demo";
import type { AdTestKind, LiveTestSettings } from "@/lib/live-test.shared";

const DEBOUNCE_MS = 250;

export type AdTestCounter = {
  /** Testmodus aktiv und für diese Sitzung sichtbar. */
  active: boolean;
  /** Feed-Position, nach der die Werbekarte erscheint (null = keine). */
  slotIndex: number | null;
  ad: SponsoredAd | null;
  interactions: number;
  frequency: number;
  registerInteraction: (index: number) => void;
  noteFeedImpression: (postId: string) => void;
  logAdEvent: (kind: AdTestKind, extra?: { adId?: string; position?: number }) => void;
  dismissAd: () => void;
};

export function useAdTestCounter(enabledForViewer: boolean): AdTestCounter {
  const loadSettings = useServerFn(getLiveTestSettings);
  const record = useServerFn(recordAdTestEvent);
  const [settings, setSettings] = useState<LiveTestSettings | null>(null);
  const [slotIndex, setSlotIndex] = useState<number | null>(null);
  const [shown, setShown] = useState(0);
  const [interactions, setInteractions] = useState(0);

  const counter = useRef(0);
  const lastAt = useRef(0);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabledForViewer) return;
    let alive = true;
    void loadSettings({})
      .then((s) => {
        if (alive) setSettings(s);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [enabledForViewer, loadSettings]);

  const active = Boolean(enabledForViewer && settings?.liveTest && settings?.botsEnabled);
  const frequency = settings?.adFrequency ?? 15;

  const logAdEvent = useCallback(
    (kind: AdTestKind, extra?: { adId?: string; position?: number }) => {
      if (!active) return;
      void record({
        data: {
          kind,
          adId: extra?.adId ?? "",
          feedPosition: extra?.position ?? slotIndex ?? 0,
          interactions: counter.current,
        },
      }).catch(() => undefined);
    },
    [active, record, slotIndex],
  );

  const registerInteraction = useCallback(
    (index: number) => {
      if (!active) return;
      const now = Date.now();
      if (now - lastAt.current < DEBOUNCE_MS) return;
      lastAt.current = now;
      counter.current += 1;
      setInteractions(counter.current);
      void record({
        data: { kind: "feed_step", feedPosition: index, interactions: counter.current },
      }).catch(() => undefined);

      if (counter.current >= frequency && slotIndex === null) {
        const position = index + 1;
        setSlotIndex(position);
        void record({
          data: { kind: "ad_scheduled", feedPosition: position, interactions: counter.current },
        }).catch(() => undefined);
        counter.current = 0;
        setInteractions(0);
      }
    },
    [active, frequency, record, slotIndex],
  );

  const noteFeedImpression = useCallback(
    (postId: string) => {
      if (!active || seen.current.has(postId)) return;
      seen.current.add(postId);
      void record({
        data: { kind: "feed_impression", adId: postId, interactions: counter.current },
      }).catch(() => undefined);
    },
    [active, record],
  );

  const dismissAd = useCallback(() => {
    setSlotIndex(null);
    setShown((n) => n + 1);
  }, []);

  const ad = active && slotIndex !== null ? (SPONSORED_ADS[shown % SPONSORED_ADS.length] ?? null) : null;

  return {
    active,
    slotIndex: ad ? slotIndex : null,
    ad,
    interactions,
    frequency,
    registerInteraction,
    noteFeedImpression,
    logAdEvent,
    dismissAd,
  };
}
