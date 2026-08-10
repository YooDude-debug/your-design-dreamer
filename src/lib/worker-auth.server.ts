/**
 * Autorisierung fuer Hintergrund-Worker (Zeitplan/Cron).
 *
 * Verglichen wird ein geteiltes Server-Geheimnis, zeitkonstant. Oeffentliche
 * bzw. publishable Supabase-Schluessel gelten bewusst NICHT als Berechtigung.
 * Das Geheimnis wird nie geloggt und nie an den Browser ausgeliefert.
 */
import { timingSafeEqual } from "crypto";

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

/**
 * Prueft den Aufruf gegen die angegebenen Geheimnis-Variablen.
 * Erlaubte Header: `x-worker-secret` oder `Authorization: Bearer …`.
 */
export function isAuthorizedWorkerRequest(request: Request, envNames: string[]): boolean {
  const provided =
    request.headers.get("x-worker-secret") ??
    (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!provided) return false;

  let ok = false;
  for (const name of envNames) {
    const expected = process.env[name] ?? "";
    if (expected && safeEqual(provided, expected)) ok = true;
  }
  return ok;
}
