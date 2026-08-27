/**
 * Zentrale Freigabe des Demo-/Testwerbebestands.
 *
 * Der Y-Dude Werbekernel (Plan, Scoring, Caps, Events, Platzierung) bleibt
 * vollständig erhalten. Nur der interne DEMO-Bestand (`ad-demo.ts`,
 * `ad-video-demo.ts`, `ad-catalog.shared.ts`) ist keine echte Werbung und darf
 * deshalb nicht mehr öffentlich ausgespielt werden.
 *
 * Regel (eine Stelle, überall gültig):
 *   Demowerbung nur für Admin-Konten UND nur bei aktivem Werbe-Testmodus.
 *
 * Sobald echte Werbequellen (eigene Kampagnen, AdSense, weitere Partner) an den
 * Kernel angeschlossen sind, laufen diese unabhängig von dieser Freigabe.
 */

import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getLiveTestSettings } from "@/lib/live-test.functions";
import { useData } from "@/lib/data-context";

export type DemoInventoryContext = {
  /** Admin-Sitzung? */
  isAdmin: boolean;
  /** Werbe-Testmodus im Admin-Cockpit aktiv? */
  testMode: boolean;
};

/** Einzige Entscheidungsregel für den Demo-Bestand. */
export function demoInventoryAllowed({ isAdmin, testMode }: DemoInventoryContext): boolean {
  return isAdmin && testMode;
}

/**
 * Clientseitige Freigabe. Für Nicht-Admins wird der Testmodus nie abgefragt,
 * die Antwort ist immer `false`.
 */
export function useDemoInventoryAllowed(): boolean {
  const { isAdmin } = useData();
  const loadSettings = useServerFn(getLiveTestSettings);
  const [testMode, setTestMode] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      setTestMode(false);
      return;
    }
    let alive = true;
    void loadSettings()
      .then((s) => {
        if (alive) setTestMode(Boolean(s?.liveTest));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [isAdmin, loadSettings]);

  return demoInventoryAllowed({ isAdmin: Boolean(isAdmin), testMode });
}
