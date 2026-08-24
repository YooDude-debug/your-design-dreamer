/**
 * Leichtgewichtiges Event-Tracking für den Slang-Challenge-Funnel.
 *
 * Es wird KEINE neue Analytics-Struktur eingeführt: die Events werden an
 * bereits vorhandene Consumer (`window.dataLayer`, `window.gtag`) gemeldet,
 * falls diese existieren. Ohne Consumer passiert nichts (nur Dev-Log).
 */

export type ChallengeEvent =
  | "challenge_seen"
  | "challenge_cta_clicked"
  | "signup_started"
  | "signup_completed"
  | "first_slangtag_started";

type TrackWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

const SEEN_PREFIX = "y-dude:track:";

/** Meldet ein Funnel-Event; `once` verhindert Mehrfachzählung pro Session. */
export function trackChallenge(
  event: ChallengeEvent,
  params: Record<string, string | number | boolean> = {},
  once = false,
) {
  if (typeof window === "undefined") return;
  const w = window as TrackWindow;

  if (once) {
    try {
      const key = `${SEEN_PREFIX}${event}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* Storage blockiert – Event trotzdem melden */
    }
  }

  const payload = { event, funnel: "slang_challenge", ...params };
  try {
    if (Array.isArray(w.dataLayer)) w.dataLayer.push(payload);
    if (typeof w.gtag === "function") w.gtag("event", event, payload);
  } catch {
    /* Tracking darf die App niemals blockieren */
  }
  if (import.meta.env.DEV) console.debug("[challenge]", payload);
}

const ONBOARDING_KEY = "y-dude:challenge-onboarding";

/** Merkt sich, dass der Nutzer über die Challenge in die Registrierung kam. */
export function markChallengeOnboarding() {
  try {
    localStorage.setItem(ONBOARDING_KEY, "1");
  } catch {
    /* ignorieren */
  }
}

export function hasChallengeOnboarding() {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearChallengeOnboarding() {
  try {
    localStorage.removeItem(ONBOARDING_KEY);
  } catch {
    /* ignorieren */
  }
}
