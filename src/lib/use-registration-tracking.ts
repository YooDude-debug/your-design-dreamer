import { useCallback, useEffect, useRef } from "react";
import { trackRegistrationEvent } from "./registration-tracking.functions";
import type { RegistrationCause, RegistrationEvent } from "./registration-tracking.shared";

function newAttemptId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // Fallback fuer aeltere Browser ohne randomUUID.
    const hex = "0123456789abcdef";
    let out = "";
    for (let i = 0; i < 36; i++) {
      out +=
        i === 8 || i === 13 || i === 18 || i === 23
          ? "-"
          : i === 14
            ? "4"
            : hex[Math.floor(Math.random() * 16)];
    }
    return out;
  }
}

/**
 * Erfasst die technischen Schritte eines Registrierungsversuchs.
 *
 * Es wird ausschliesslich der Ereignisname, eine Fehlerursache aus einer
 * festen Liste und eine zufaellige Versuchs-ID gesendet – keine E-Mail, kein
 * Passwort, kein Token. Fehler beim Tracking blockieren die Registrierung nie.
 */
export function useRegistrationTracking() {
  const attemptId = useRef<string>("");
  const sent = useRef<Set<string>>(new Set());
  if (!attemptId.current) attemptId.current = newAttemptId();

  const track = useCallback(
    (event: RegistrationEvent, cause?: RegistrationCause, detail?: string) => {
      const key = `${event}:${cause ?? ""}:${detail ?? ""}`;
      if (sent.current.has(key)) return;
      sent.current.add(key);
      void trackRegistrationEvent({
        data: {
          attemptId: attemptId.current,
          event,
          cause: cause ?? null,
          detail: detail ?? null,
        },
      }).catch(() => {
        /* Tracking darf die Registrierung niemals blockieren */
      });
    },
    [],
  );

  /** Neuer Versuch nach einem Fehlschlag: erlaubt erneutes Zaehlen der Schritte. */
  const resetAttempt = useCallback(() => {
    attemptId.current = newAttemptId();
    sent.current = new Set();
  }, []);

  useEffect(() => {
    track("registration_started");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { attemptId, track, resetAttempt };
}
