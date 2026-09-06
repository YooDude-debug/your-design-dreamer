import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { REGISTRATION_CAUSES, REGISTRATION_EVENTS } from "./registration-tracking.shared";

/**
 * Oeffentliches Tracking der Registrierungsschritte.
 *
 * Bewusst ohne Auth (die Registrierung ist anonym). Es werden nur die
 * fest definierten Ereignisnamen, eine Fehlerursache aus einer festen Liste
 * und eine zufaellige Versuchs-ID akzeptiert – keine Freitexte mit
 * personenbezogenen Inhalten, keine Tokens, keine Passwoerter.
 */
export const trackRegistrationEvent = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        attemptId: z.string().uuid(),
        event: z.enum(REGISTRATION_EVENTS),
        cause: z.enum(REGISTRATION_CAUSES).nullish(),
        detail: z
          .string()
          .trim()
          .max(60)
          .regex(/^[a-z0-9_.-]*$/)
          .nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { recordRegistrationEvent } = await import("./registration-tracking.server");
    return { ok: await recordRegistrationEvent(data) };
  });
