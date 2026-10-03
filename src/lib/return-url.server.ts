/**
 * Prüft Rücksprung-Adressen für Zahlungsseiten (Checkout, Kundenportal).
 *
 * Nur Adressen der eigenen App sind erlaubt: der Ursprung der laufenden
 * Anfrage oder eine der festen App-Domains. Alles andere wird abgelehnt,
 * damit niemand eine Zahlungsseite auf eine fremde Website zurückleiten kann.
 */
const FIXED_ORIGINS = new Set([
  "https://y-dude.com",
  "https://www.y-dude.com",
  "https://y-dude.lovable.app",
]);

export function isAllowedReturnUrl(raw: string, requestOrigin: string | null): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.username || url.password) return false;
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return false;
  if (FIXED_ORIGINS.has(url.origin)) return true;
  return !!requestOrigin && url.origin === requestOrigin;
}

async function currentRequestOrigin(): Promise<string | null> {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    return new URL(getRequest().url).origin;
  } catch {
    return null;
  }
}

/** Gibt die Adresse zurück oder wirft `invalid_return_url`. */
export async function assertSafeReturnUrl(raw: string): Promise<string> {
  if (!isAllowedReturnUrl(raw, await currentRequestOrigin())) {
    throw new Error("invalid_return_url");
  }
  return raw;
}
