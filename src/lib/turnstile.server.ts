/**
 * Serverseitige Cloudflare-Turnstile-Prüfung.
 *
 * Der Secret Key wird ausschließlich aus der Umgebung gelesen
 * (`CLOUDFLARE_TURNSTILE_SECRET_KEY`) und verlässt niemals den Server.
 * Der Site Key (`CLOUDFLARE_TURNSTILE_SITE_KEY`) ist per Definition öffentlich,
 * wird aber ebenfalls nur über die Umgebung bereitgestellt.
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function getTurnstileSiteKeyFromEnv(): string {
  return process.env["CLOUDFLARE_TURNSTILE_SITE_KEY"] ?? "";
}

/**
 * Prüft ein Turnstile-Token gegen die Cloudflare-API (fail-closed).
 * Gibt niemals technische Details nach außen – nur true/false.
 * true ausschließlich dann, wenn Cloudflare `success: true` liefert.
 */
export async function verifyTurnstileToken(
  token: string | undefined | null,
  remoteIp?: string,
): Promise<boolean> {
  const secret = process.env["CLOUDFLARE_TURNSTILE_SECRET_KEY"] ?? "";
  // Fehlende Konfiguration ist ein Betriebsfehler – niemals ein Freifahrtschein.
  if (!secret) {
    console.error("[turnstile] secret key missing – reject");
    return false;
  }
  // Kein, leeres, zu kurzes oder unplausibel langes Token: abgelehnt.
  if (typeof token !== "string") return false;
  const response = token.trim();
  if (response.length < 10 || response.length > 4096) {
    console.warn("[turnstile] missing or malformed token – reject");
    return false;
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", response);
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) {
      console.error("[turnstile] verify http", res.status);
      return false;
    }
    const json = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (json?.success !== true) {
      console.warn("[turnstile] rejected", json?.["error-codes"]);
      return false;
    }
    return true;
  } catch (err) {
    // Netzwerk-/Parse-Fehler: fail-closed.
    console.error("[turnstile] verify failed", err);
    return false;
  }
}


/** Ermittelt die Client-IP aus dem aktuellen Request (best effort). */
export async function currentRequestIp(): Promise<string | undefined> {
  try {
    const { getRequestIP } = await import("@tanstack/react-start/server");
    return getRequestIP({ xForwardedFor: true }) ?? undefined;
  } catch {
    return undefined;
  }
}
