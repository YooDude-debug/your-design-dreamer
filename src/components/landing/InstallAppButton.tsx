/**
 * Dezenter PWA-Installationshinweis für die Landingpage.
 *
 * Nutzt den nativen Chrome/Android-Prompt (`beforeinstallprompt`). Auf iOS
 * gibt es diesen Prompt nicht – dort wird stattdessen der kurze
 * "Teilen → Zum Home-Bildschirm"-Hinweis eingeblendet. Läuft die App bereits
 * installiert (standalone), wird nichts angezeigt.
 */

import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";
import { useLang } from "@/lib/lang-context";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const TEXTS = {
  de: {
    install: "App installieren",
    ios: "Installieren: Teilen-Symbol → „Zum Home-Bildschirm“",
  },
  en: {
    install: "Install app",
    ios: "Install: share icon → “Add to Home Screen”",
  },
  el: {
    install: "Εγκατάσταση εφαρμογής",
    ios: "Εγκατάσταση: κοινοποίηση → «Προσθήκη στην αρχική οθόνη»",
  },
} as const;

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function isIos(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in window);
}

export function InstallAppButton() {
  const { lang } = useLang();
  const t = TEXTS[lang as keyof typeof TEXTS] ?? TEXTS.en;
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const onInstalled = () => {
      setPrompt(null);
      setShowIosHint(false);
    };
    window.addEventListener("appinstalled", onInstalled);
    if (isIos()) setShowIosHint(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (prompt) {
    return (
      <button
        type="button"
        onClick={async () => {
          try {
            await prompt.prompt();
            await prompt.userChoice;
          } finally {
            setPrompt(null);
          }
        }}
        className="inline-flex items-center gap-2 rounded-full border border-brand/60 px-4 py-1.5 text-xs font-semibold text-brand transition-all hover:bg-brand/10 hover:shadow-glow-subtle active:shadow-glow-active sm:text-sm"
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        {t.install}
      </button>
    );
  }

  if (showIosHint) {
    return (
      <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground sm:text-xs">
        <Share className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
        {t.ios}
      </p>
    );
  }

  return null;
}
