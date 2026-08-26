/**
 * Strukturierte Serverprotokolle (nur Server).
 *
 * Zweck: kritische Fehler und Ereignisse in einem einheitlichen, maschinenlesbaren
 * Format ausgeben, damit sie in der Protokollansicht gefunden und ausgewertet
 * werden können – ohne personenbezogene Daten und ohne Geheimnisse.
 *
 * Format (eine Zeile JSON):
 *   {"ts":"…","sev":"error","area":"payments","event":"webhook_rejected","ctx":{…}}
 *
 * Regeln:
 * - Niemals Passwörter, Tokens, Schlüssel, E-Mail-Adressen oder Nachrichteninhalte.
 * - Bezüge nur als technische Kennungen (z. B. Ereignis-ID, Transaktions-ID).
 * - Diese Datei verändert niemals den Ablauf: sie protokolliert nur.
 */

export type Severity = "debug" | "info" | "warn" | "error" | "critical";

/** Bereiche, damit Protokolle gezielt gefiltert werden können. */
export type Area =
  | "auth"
  | "payments"
  | "market"
  | "messenger"
  | "push"
  | "feed"
  | "database"
  | "moderation"
  | "server";

/** Feldnamen, die niemals protokolliert werden (unabhängig von der Schreibweise). */
const FORBIDDEN_KEY = /(pass|secret|token|key|authorization|cookie|email|phone|address|body|content|message_text|signature)/i;

const MAX_VALUE_LENGTH = 300;

/** Entfernt Geheimnisse/PII und kürzt lange Werte. */
export function sanitizeContext(context: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!context) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (FORBIDDEN_KEY.test(key)) {
      out[key] = "[redacted]";
      continue;
    }
    if (value == null) continue;
    if (typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
      continue;
    }
    if (value instanceof Error) {
      out[key] = `${value.name}: ${value.message}`.slice(0, MAX_VALUE_LENGTH);
      continue;
    }
    if (typeof value === "string") {
      out[key] = value.slice(0, MAX_VALUE_LENGTH);
      continue;
    }
    out[key] = "[object]";
  }
  return out;
}

export type LogInput = {
  area: Area;
  event: string;
  severity?: Severity;
  /** Technischer Kontext ohne personenbezogene Daten. */
  context?: Record<string, unknown>;
  /** Dauer der Operation in Millisekunden (für Latenzauffälligkeiten). */
  durationMs?: number;
};

/** Baut den Protokolleintrag (getrennt testbar, ohne Ausgabe). */
export function buildLogRecord(input: LogInput): Record<string, unknown> {
  const record: Record<string, unknown> = {
    ts: new Date().toISOString(),
    sev: input.severity ?? "info",
    area: input.area,
    event: input.event,
  };
  if (typeof input.durationMs === "number" && Number.isFinite(input.durationMs)) {
    record["ms"] = Math.round(input.durationMs);
  }
  const ctx = sanitizeContext(input.context);
  if (Object.keys(ctx).length > 0) record["ctx"] = ctx;
  return record;
}

/** Schreibt einen strukturierten Eintrag in das Serverprotokoll. */
export function logEvent(input: LogInput): void {
  const record = buildLogRecord(input);
  const line = JSON.stringify(record);
  const sev = record["sev"];
  if (sev === "error" || sev === "critical") console.error(line);
  else if (sev === "warn") console.warn(line);
  else console.log(line);
}

/** Kurzform für kritische Fehler mit Fehlerobjekt. */
export function logFailure(
  area: Area,
  event: string,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  logEvent({
    area,
    event,
    severity: "critical",
    context: { ...context, error: error instanceof Error ? error : String(error) },
  });
}

/** Schwelle, ab der eine Operation als auffällig langsam protokolliert wird. */
export const SLOW_MS = 1500;

/** Protokolliert nur, wenn eine Operation ungewöhnlich lange gedauert hat. */
export function logIfSlow(area: Area, event: string, durationMs: number, context?: Record<string, unknown>): void {
  if (durationMs < SLOW_MS) return;
  logEvent({ area, event: `${event}_slow`, severity: "warn", durationMs, context });
}
