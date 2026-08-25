/**
 * Gemeinsame PWA-Installationslogik (eine Quelle für alle Einstiegspunkte).
 *
 * - Fängt den nativen `beforeinstallprompt` (Chrome/Android/Desktop-Chromium) ab.
 * - Erkennt, ob die App bereits installiert läuft (standalone).
 * - Liefert die Geräteklasse für die manuelle Anleitung (iOS/Android/Desktop).
 */

import { useCallback, useEffect, useState } from "react";

export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallDevice = "ios" | "android" | "desktop";

export function isStandaloneApp(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

export function detectInstallDevice(): InstallDevice {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in window)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export function usePwaInstall() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [device, setDevice] = useState<InstallDevice>("desktop");

  useEffect(() => {
    setDevice(detectInstallDevice());
    setInstalled(isStandaloneApp());

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setPrompt(null);
      setInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  /** Startet den nativen Prompt. Gibt `false` zurück, wenn keiner verfügbar ist. */
  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!prompt) return false;
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } finally {
      setPrompt(null);
    }
    return true;
  }, [prompt]);

  return {
    /** Nativer Install-Prompt verfügbar? */
    canPrompt: !!prompt && !installed,
    /** App läuft bereits installiert. */
    installed,
    device,
    promptInstall,
  };
}
