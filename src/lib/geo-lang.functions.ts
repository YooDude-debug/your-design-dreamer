import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

/**
 * Liefert das Land des Besuchers anhand der Edge-Header (öffentlich, kein Auth).
 * Wird nur aufgerufen, wenn noch keine manuelle Sprachwahl gespeichert ist.
 */
export const getVisitorCountry = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const h = getRequest().headers;
    const cc =
      h.get("cf-ipcountry") ??
      h.get("x-vercel-ip-country") ??
      h.get("x-country-code") ??
      h.get("x-geo-country") ??
      "";
    const code = cc.trim().toUpperCase();
    return { country: code.length === 2 && code !== "XX" ? code : null };
  } catch {
    return { country: null as string | null };
  }
});
