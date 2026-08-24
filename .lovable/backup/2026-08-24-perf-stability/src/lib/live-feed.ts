import { useSyncExternalStore } from "react";

/**
 * Live-Feed-Schalter: prüft im aktiven Zustand alle 10 Sekunden auf neue
 * Beiträge. Der Zustand gilt für die Sitzung (Standard: AUS) und beeinflusst
 * ausschließlich das Nachladen – Reihenfolge und Feed-Algorithmus bleiben
 * unverändert.
 */

const KEY = "ydude:livefeed";

let enabled = (() => {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(KEY) === "1";
})();

const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function setLiveFeed(next: boolean) {
  enabled = next;
  if (typeof window !== "undefined") window.sessionStorage.setItem(KEY, next ? "1" : "0");
  listeners.forEach((l) => l());
}

export function isLiveFeedEnabled() {
  return enabled;
}

export function useLiveFeed() {
  const on = useSyncExternalStore(subscribe, isLiveFeedEnabled, () => false);
  return { liveFeed: on, setLiveFeed, toggleLiveFeed: () => setLiveFeed(!isLiveFeedEnabled()) };
}

/** Prüfintervall des Live-Feeds in Millisekunden. */
export const LIVE_FEED_INTERVAL_MS = 10_000;
