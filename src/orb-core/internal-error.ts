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
