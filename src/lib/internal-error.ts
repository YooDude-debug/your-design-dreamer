/**
 * S6 – Fehlergrenze für DB-/RPC-Fehler.
 *
 * `internalError(dbError)` ersetzt `new Error(dbError.message)`: Die Meldung
 * und der Originalfehler (`cause`) bleiben für Server-Logs erhalten; die
 * errorMiddleware (src/start.ts) gibt nach außen nur SAFE_SERVER_ERROR weiter.
 * Keine Imports, keine Seiteneffekte.
 */

export const SAFE_SERVER_ERROR = "Interner Serverfehler";

export class OrbInternalError extends Error {
  override name = "OrbInternalError";
}

export function internalError(cause: unknown, context?: string): OrbInternalError {
  const detail =
    cause && typeof cause === "object" && "message" in cause
      ? String((cause as { message: unknown }).message)
      : String(cause);
  return new OrbInternalError(context ? `${context}: ${detail}` : detail, { cause });
}

const RUNTIME_ERRORS = [TypeError, ReferenceError, RangeError, SyntaxError, EvalError, URIError];

/**
 * true → nach außen nur SAFE_SERVER_ERROR. Betrifft markierte DB-/RPC-Fehler,
 * JS-Laufzeitfehler und geworfene Nicht-Error-Werte. Einfache `Error`s mit
 * bewusst gesetzten Meldungen (Validation, Unauthorized, Forbidden, ORB-Dev)
 * sowie eigene Unterklassen (ZodError, CodeAccessError) bleiben unverändert.
 */
export function shouldMaskServerError(error: unknown): boolean {
  if (error instanceof OrbInternalError) return true;
  if (!(error instanceof Error)) {
    // Framework-Steuerobjekte (redirect = Response, notFound) nie verändern.
    if (typeof Response !== "undefined" && error instanceof Response) return false;
    if (error && typeof error === "object" && "isNotFound" in error) return false;
    return true;
  }
  return RUNTIME_ERRORS.some((C) => error.constructor === C);
}

/** Kennung im Fehlertext, an der der Client „erneut anmelden“ erkennt. */
export const ORB_REAUTH_REQUIRED = "ORB_REAUTH_REQUIRED";

/**
 * true nur für Anmelde-/Rollenfehler beim LESEN: fehlendes/abgelaufenes Token
 * (PGRST301/PGRST302/401) oder Tabellenrecht fehlt, weil die Anfrage als `anon`
 * lief (42501 „permission denied for table“). RLS-Schreibablehnungen
 * („row-level security“) und alle übrigen DB-Fehler gelten NICHT als Auth.
 */
export function isAuthReadError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: unknown; message?: unknown; status?: unknown };
  const code = typeof e.code === "string" ? e.code : "";
  const msg = typeof e.message === "string" ? e.message.toLowerCase() : "";
  if (code === "PGRST301" || code === "PGRST302" || e.status === 401) return true;
  return code === "42501" && msg.includes("permission denied for table");
}

/** Klarer, nicht maskierter Fehler: Benutzer muss sich neu anmelden. */
export function reauthRequired(): Error {
  return new Error(`${ORB_REAUTH_REQUIRED}: Bitte melde dich erneut an.`);
}
