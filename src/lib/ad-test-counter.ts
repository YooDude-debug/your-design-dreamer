/**
 * Zähler für den Werbe-Live-Test im Hauptfeed.
 *
 * Gezählt werden ausschließlich echte Feed-Ereignisse:
 *  - ein Beitrag war tatsächlich im Feed sichtbar (eine Zählung pro Beitrag)
 *  - Öffnen eines Beitrags
 *  - Wechsel zum nächsten/vorherigen Beitrag in der Detailansicht
 *
 * Datenbank-Abfragen (z. B. der 10-Sekunden-Live-Refresh) zählen nie.
 *
 * Erreicht der Zähler den Schwellwert (15 oder 25), wird die Werbekarte an
 * einen konkreten Beitrag gebunden (`slotPostId`). Dadurch bleibt sie an ihrer
 * Stelle, auch wenn oben neue Beiträge dazukommen.
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
  /** Beitrag, nach dem die Werbekarte erscheint (null = keine). */
  slotPostId: string | null;
  /** Feed-Position der geplanten Einblendung (nur Anzeige/Protokoll). */
  slotPosition: number;
  ad: SponsoredAd | null;
  interactions: number;
  frequency: number;
  /** Interaktion durch Öffnen/Wechsel eines Beitrags. */
  registerInteraction: (index: number, postId?: string) => void;
  /** Beitrag war sichtbar – zählt genau einmal pro Beitrag. */
  noteFeedImpression: (postId: string, index?: number) => void;
  logAdEvent: (kind: AdTestKind, extra?: { adId?: string; position?: number }) => void;
  dismissAd: () => void;
};

export function useAdTestCounter(enabledForViewer: boolean): AdTestCounter {
  const loadSettings = useServerFn(getLiveTestSettings);
  const record = useServerFn(recordAdTestEvent);
  const [settings, setSettings] = useState<LiveTestSettings | null>(null);
  const [slot, setSlot] = useState<{ postId: string; position: number } | null>(null);
  const [shown, setShown] = useState(0);
  const [interactions, setInteractions] = useState(0);

  const counter = useRef(0);
  const lastAt = useRef(0);
  const seen = useRef<Set<string>>(new Set());
  const slotRef = useRef<{ postId: string; position: number } | null>(null);

  useEffect(() => {
    if (!enabledForViewer) return;
    let alive = true;
    // Einmaliger Wiederholversuch: ein einzelner Fehlschlag (z. B. kurz nach
    // einem neuen Build) darf die Testwerbung nicht für die ganze Sitzung
    // abschalten.
    const load = async () => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const next = await loadSettings({});
          if (alive) setSettings(next);
          return;
        } catch (error) {
          if (!alive) return;
          if (attempt === 1) {
            console.warn("[ad-test] Testeinstellungen konnten nicht geladen werden", error);
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 800));
        }
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [enabledForViewer, loadSettings]);

  const active = Boolean(enabledForViewer && settings?.liveTest);
  const frequency = settings?.adFrequency ?? 15;

  const logAdEvent = useCallback(
    (kind: AdTestKind, extra?: { adId?: string; position?: number }) => {
      if (!active) return;
      void record({
        data: {
          kind,
          adId: extra?.adId ?? "",
          feedPosition: extra?.position ?? slotRef.current?.position ?? 0,
          interactions: counter.current,
        },
      }).catch(() => undefined);
    },
    [active, record],
  );

  /** Zählt eine Feed-Interaktion und plant ggf. die Werbekarte ein. */
  const bump = useCallback(
    (index: number, postId?: string) => {
      counter.current += 1;
      setInteractions(counter.current);
      if (counter.current < frequency || slotRef.current || !postId) return;
      const position = index + 1;
      slotRef.current = { postId, position };
      setSlot({ postId, position });
      void record({
        data: { kind: "ad_scheduled", feedPosition: position, interactions: counter.current },
      }).catch(() => undefined);
      counter.current = 0;
      setInteractions(0);
    },
    [frequency, record],
  );

  const registerInteraction = useCallback(
    (index: number, postId?: string) => {
      if (!active) return;
      const now = Date.now();
      if (now - lastAt.current < DEBOUNCE_MS) return;
      lastAt.current = now;
      void record({
        data: { kind: "feed_step", feedPosition: index, interactions: counter.current + 1 },
      }).catch(() => undefined);
      bump(index, postId);
    },
    [active, bump, record],
  );

  const noteFeedImpression = useCallback(
    (postId: string, index = 0) => {
      if (!active || seen.current.has(postId)) return;
      seen.current.add(postId);
      void record({
        data: {
          kind: "feed_impression",
          adId: postId,
          feedPosition: index,
          interactions: counter.current + 1,
        },
      }).catch(() => undefined);
      bump(index, postId);
    },
    [active, bump, record],
  );

  const dismissAd = useCallback(() => {
    slotRef.current = null;
    setSlot(null);
    setShown((n) => n + 1);
  }, []);

  const ad = active && slot ? (SPONSORED_ADS[shown % SPONSORED_ADS.length] ?? null) : null;

  return {
    active,
    slotPostId: ad ? (slot?.postId ?? null) : null,
    slotPosition: slot?.position ?? 0,
    ad,
    interactions,
    frequency,
    registerInteraction,
    noteFeedImpression,
    logAdEvent,
    dismissAd,
  };
}
