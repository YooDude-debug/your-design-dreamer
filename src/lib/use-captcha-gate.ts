import { useCallback, useRef, useState } from "react";
import type { TurnstileHandle } from "@/components/Turnstile";

/**
 * Client-Gate für Cloudflare Turnstile.
 *
 * Wichtig: Dieses Gate blockiert das Absenden NICHT. Ein noch nicht fertiges
 * Client-Widget ist eine Race Condition, kein Sicherheitsmerkmal – die
 * verbindliche Prüfung passiert serverseitig (`verifyTurnstileToken`).
 * Beim Absenden wird dem Widget nur eine kurze Kulanzzeit gegeben, damit ein
 * bereits laufender Challenge-Durchlauf noch sein Token liefern kann.
 */
export const CAPTCHA_GRACE_MS = 1500;

export function useCaptchaGate() {
  const [token, setTokenState] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const tokenRef = useRef<string | null>(null);
  const handleRef = useRef<TurnstileHandle | null>(null);

  const setToken = useCallback((next: string | null) => {
    tokenRef.current = next;
    setTokenState(next);
  }, []);

  /** Kurzes Warten auf ein noch ausstehendes Token; danach ohne Token absenden. */
  const waitForToken = useCallback(async (maxMs = CAPTCHA_GRACE_MS) => {
    if (tokenRef.current) return tokenRef.current;
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
      if (tokenRef.current) return tokenRef.current;
    }
    return null;
  }, []);

  const reset = useCallback(() => {
    handleRef.current?.reset();
    setToken(null);
  }, [setToken]);

  return {
    /** Aktuelles Token (nur informativ – zum Absenden `waitForToken()` nutzen). */
    token,
    setToken,
    blocked,
    setBlocked,
    /** Prüfung initialisiert noch (nur für Button-Label, nie zum Blockieren). */
    pending: !token && !blocked,
    waitForToken,
    reset,
    handleRef,
  };
}
