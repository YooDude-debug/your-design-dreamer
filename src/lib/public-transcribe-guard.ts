/**
 * Ablauf-Schutz der öffentlichen Sprachdemo (ohne Anmeldung nutzbar).
 *
 * Reihenfolge, alles serverseitig und fail-closed:
 * 1. bestehende temporäre IP-Begrenzung,
 * 2. Bot-Prüfung (Cloudflare Turnstile, Token gegen Cloudflare geprüft),
 * 3. erst danach der kostenpflichtige Transkriptionsaufruf.
 * Ein Client-Status „geprüft“ zählt nie – nur Cloudflares `success: true`.
 * Es wird nichts gespeichert; Token und IP werden nicht protokolliert.
 */
export type PublicTranscribeResult =
  | { ok: true; text: string }
  | { ok: false; reason: "verification" | "rate_limited" };

export type PublicTranscribeDeps = {
  rateLimit: () => { ok: boolean };
  verify: (token: string | null) => Promise<boolean>;
  transcribe: () => Promise<string>;
};

export async function runPublicTranscription(
  token: string | null | undefined,
  deps: PublicTranscribeDeps,
): Promise<PublicTranscribeResult> {
  if (!deps.rateLimit().ok) return { ok: false, reason: "rate_limited" };
  const passed = await deps.verify(typeof token === "string" ? token : null).catch(() => false);
  if (passed !== true) return { ok: false, reason: "verification" };
  return { ok: true, text: await deps.transcribe() };
}
