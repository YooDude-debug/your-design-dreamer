import { createServerFn } from "@tanstack/react-start";
import { getTurnstileSiteKeyFromEnv } from "./turnstile.server";

/** Liefert den öffentlichen Turnstile Site Key aus der Umgebung. */
export const getTurnstileSiteKey = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ siteKey: string }> => ({ siteKey: getTurnstileSiteKeyFromEnv() }),
);
