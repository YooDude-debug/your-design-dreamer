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

/**
 * Grund, warum die Sicherheitsprüfung gerade nicht nutzbar ist.
 *
 * Nur `error`, `timeout`, `script` und `sitekey` sind echte Fehlschläge von
 * Cloudflare bzw. der Einbindung. `not_rendered` bedeutet lediglich: das Widget
 * ist (noch) nicht erschienen – das ist ein Lade-/Wartezustand und darf niemals
 * als fehlgeschlagene Prüfung gewertet werden.
 */
export type TurnstileFailureReason = "error" | "timeout" | "script" | "sitekey" | "not_rendered";

export function Turnstile({
  onToken,
  onUnavailable,
  onLoaded,
  handleRef,
  className,
}: {
  onToken: (token: string | null) => void;
  /** Wird gemeldet, sobald das Widget gerendert wurde (rein technisch). */
  onLoaded?: () => void;
  /**
   * Wird gemeldet, wenn die Sicherheitsprüfung auf diesem Gerät/Netz gar nicht
   * nutzbar ist (Fehler oder keine Antwort innerhalb von 20s). Formulare dürfen
   * dann trotzdem absenden – der Server entscheidet endgültig.
   */
  onUnavailable?: (unavailable: boolean, reason?: TurnstileFailureReason) => void;
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
  const loadedCb = useRef(onLoaded);
  loadedCb.current = onLoaded;

  // Zustände: LOADING → READY (wartet auf Nutzer) → SUCCESS (Token da)
  // bzw. FAILED/TIMEOUT. Ein SUCCESS darf niemals als Fehler angezeigt werden.
  const succeeded = useRef(false);

  const markUnavailable = useCallback((reason: TurnstileFailureReason) => {
    // Erfolgreiche Prüfung schlägt jeden späteren Timeout-/Fehlerzustand.
    if (succeeded.current) return;
    setFailed(true);
    unavailableCb.current?.(true, reason);
  }, []);

  const markSuccess = useCallback((token: string) => {
    succeeded.current = true;
    setFailed(false);
    unavailableCb.current?.(false);
    cb.current(token);
  }, []);

  const reset = useCallback(() => {
    if (widgetId.current && window.turnstile) {
      succeeded.current = false;
      window.turnstile.reset(widgetId.current);
      cb.current(null);
    }
  }, []);

  useEffect(() => {
    if (handleRef) handleRef.current = { reset };
  }, [handleRef, reset]);

  useEffect(() => {
    let active = true;
    // Wichtig: Ein wartendes Widget ist KEIN Fehler. Solange Cloudflare
    // gerendert hat und auf die Bestätigung des Nutzers wartet, darf keine
    // Meldung "konnte nicht geladen werden" erscheinen. Als Fehler gilt nur:
    // fehlender Site Key, Script-Fehler, error-/timeout-Callback von
    // Cloudflare oder ein Widget, das gar nicht erst erscheint.
    // Cloudflare rendert das Widget in einen Shadow-DOM; ein reines
    // querySelector("iframe") findet es dort NICHT. Deshalb wird jedes
    // Kindelement bzw. ein Shadow-Root ebenfalls als "gerendert" gewertet –
    // sonst erschien die Fehlermeldung selbst bei erfolgreicher Prüfung.
    const isRendered = () => {
      const el = containerRef.current;
      if (!el) return false;
      if (succeeded.current) return true;
      if (el.querySelector("iframe")) return true;
      if (el.querySelector("input[name='cf-turnstile-response']")) return true;
      for (const child of Array.from(el.children)) {
        if ((child as HTMLElement & { shadowRoot?: ShadowRoot | null }).shadowRoot) return true;
      }
      return el.children.length > 0;
    };
    let elapsed = 0;
    const timeout = window.setInterval(() => {
      if (!active) return;
      elapsed += 1000;
      if (isRendered()) {
        // Verspätetes Rendern: eine bereits gezeigte Meldung verschwindet.
        setFailed(false);
        unavailableCb.current?.(false);
        window.clearInterval(timeout);
        return;
      }
      if (elapsed >= 15000) markUnavailable("not_rendered");
      if (elapsed >= 40000) window.clearInterval(timeout);
    }, 1000);
    void (async () => {
      try {
        const [siteKey] = await Promise.all([loadSiteKey(), loadScript()]);
        if (!active || !siteKey || !containerRef.current || !window.turnstile) {
          if (active && !siteKey) markUnavailable("sitekey");
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
          callback: (token) => markSuccess(token),
          "error-callback": () => {
            succeeded.current = false;
            cb.current(null);
            markUnavailable("error");
          },
          "timeout-callback": () => {
            succeeded.current = false;
            cb.current(null);
            markUnavailable("timeout");
          },
          "expired-callback": () => {
            succeeded.current = false;
            cb.current(null);
          },
        });
        loadedCb.current?.();
      } catch {
        if (active) markUnavailable("script");
      }
    })();
    return () => {
      active = false;
      window.clearInterval(timeout);
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
  }, [markUnavailable, markSuccess]);

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
      {failed && (
        <p
          role="alert"
          className="mt-1 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11px] leading-relaxed text-destructive"
        >
          {t.unavailable}
        </p>
      )}
    </div>
  );
}
