import { useCallback, useEffect, useId, useRef, useState } from "react";
import { getTurnstileSiteKey } from "@/lib/turnstile.functions";
import { useLang } from "@/lib/lang-context";
import { authTexts } from "@/lib/i18n-auth";

/**
 * Cloudflare Turnstile (Managed Mode).
 *
 * Das Script wird erst geladen, wenn ein Widget tatsächlich gerendert wird
 * (also nur bei Formularen). Der Site Key kommt aus einer Server-Funktion,
 * damit im Quellcode kein Schlüssel steht.
 */

type TurnstileApi = {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      theme?: "auto" | "light" | "dark";
      size?: "normal" | "flexible" | "compact";
      appearance?: "always" | "execute" | "interaction-only";
      callback?: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
      "timeout-callback"?: () => void;
      retry?: "auto" | "never";
      "retry-interval"?: number;
      "refresh-expired"?: "auto" | "manual" | "never";
    },
  ) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | null = null;
let siteKeyPromise: Promise<string> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const el = existing ?? document.createElement("script");
    el.src = SCRIPT_SRC;
    el.async = true;
    el.defer = true;
    el.addEventListener("load", () => resolve());
    el.addEventListener("error", () => reject(new Error("script")));
    if (!existing) document.head.appendChild(el);
  });
  return scriptPromise;
}

function loadSiteKey(): Promise<string> {
  if (!siteKeyPromise) {
    siteKeyPromise = getTurnstileSiteKey()
      .then((r) => r.siteKey)
      .catch(() => "");
  }
  return siteKeyPromise;
}

export type TurnstileHandle = { reset: () => void };

export function Turnstile({
  onToken,
  onUnavailable,
  handleRef,
  className,
}: {
  onToken: (token: string | null) => void;
  /**
   * Wird gemeldet, wenn die Sicherheitsprüfung auf diesem Gerät/Netz gar nicht
   * nutzbar ist (Fehler oder keine Antwort innerhalb von 20s). Formulare dürfen
   * dann trotzdem absenden – der Server entscheidet endgültig.
   */
  onUnavailable?: (unavailable: boolean) => void;
  handleRef?: React.MutableRefObject<TurnstileHandle | null>;
  className?: string;
}) {
  const { lang } = useLang();
  const t = authTexts[lang].turnstile;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);
  const domId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [failed, setFailed] = useState(false);
  const cb = useRef(onToken);
  cb.current = onToken;
  const unavailableCb = useRef(onUnavailable);
  unavailableCb.current = onUnavailable;

  const markUnavailable = useCallback(() => {
    setFailed(true);
    unavailableCb.current?.(true);
  }, []);

  const reset = useCallback(() => {
    if (widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current);
      cb.current(null);
    }
  }, []);

  useEffect(() => {
    if (handleRef) handleRef.current = { reset };
  }, [handleRef, reset]);

  useEffect(() => {
    let active = true;
    // Notausgang: Wenn Cloudflare auf diesem Netz/Gerät nicht antwortet, darf
    // die Registrierung nicht dauerhaft blockiert bleiben.
    // 4s: Das Absenden ist ohnehin nie blockiert; dieser Timer sorgt nur dafür,
    // dass der Button-Zustand "Sicherheitsprüfung läuft" nicht hängen bleibt.
    const timeout = window.setTimeout(() => {
      if (!active) return;
      const el = containerRef.current;
      const solved = !!el?.querySelector<HTMLInputElement>("input[name='cf-turnstile-response']")
        ?.value;
      if (!solved) markUnavailable();
    }, 4000);
    void (async () => {
      try {
        const [siteKey] = await Promise.all([loadSiteKey(), loadScript()]);
        if (!active || !siteKey || !containerRef.current || !window.turnstile) {
          if (active && !siteKey) markUnavailable();
          return;
        }
        widgetId.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: "dark",
          size: "flexible",
          appearance: "always",
          retry: "auto",
          "retry-interval": 4000,
          "refresh-expired": "auto",
          callback: (token) => {
            unavailableCb.current?.(false);
            cb.current(token);
          },
          "error-callback": () => {
            cb.current(null);
            markUnavailable();
          },
          "timeout-callback": () => {
            cb.current(null);
            markUnavailable();
          },
          "expired-callback": () => cb.current(null),
        });
      } catch {
        if (active) markUnavailable();
      }
    })();
    return () => {
      active = false;
      window.clearTimeout(timeout);
      const id = widgetId.current;
      widgetId.current = null;
      if (id && window.turnstile) {
        try {
          window.turnstile.remove(id);
        } catch {
          /* Widget wurde schon entfernt */
        }
      }
    };
  }, [markUnavailable]);

  return (
    <div className={className}>
      {/* Feste Mindesthöhe verhindert Layoutverschiebungen beim Laden.
          Kein overflow/rounded/clip auf dem inneren Container – sonst schneidet
          der Rahmen die Ecken des Widgets (Cloudflare-Logo, Privacy/Terms) ab.
          Das Widget selbst ist mindestens 300px breit; auf schmalen
          Viewports wird es skaliert, damit der Erfolgszustand vollständig
          sichtbar bleibt. overflow-x-auto stellt sicher, dass niemals Inhalte
          abgeschnitten werden. */}
      <div className="w-full overflow-x-auto py-1">
        <div
          id={domId}
          ref={containerRef}
          className="min-h-[70px] w-full min-w-[300px] origin-top-left max-[420px]:scale-[0.9] max-[359px]:scale-[0.72] [color-scheme:dark]"
        />
      </div>
      {failed && <p className="mt-1 text-[11px] text-muted-foreground">{t.skipped}</p>}
    </div>
  );
}
