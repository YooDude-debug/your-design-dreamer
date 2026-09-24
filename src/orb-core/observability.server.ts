/**
 * ORB Core – P3 Observability: Korrelation ORB-EVENT → MODELLAUFRUF.
 *
 * Ausschliesslich Messbarkeit. Diese Schicht:
 *  - erzeugt deterministische technische Kennungen (Ereignis, Modellaufruf),
 *  - schreibt genau eine strukturierte Protokollzeile je Modellaufruf und
 *    genau eine je Ereignis-Abschluss,
 *  - ruft NIE ein Modell auf, schreibt NIE in die Datenbank, ändert KEINE
 *    ORB-Logik, keine Schwellen, keine Reihenfolge, keine Abfragen.
 *
 * Datenschutz: protokolliert werden nur technische Kennungen, Pfadnamen,
 * Modellname, Dauer, Erfolg und Längen. Niemals Nachrichtentext,
 * Systemprompt, Modellantwort, Erinnerungsinhalte oder Zugangsschlüssel.
 * Die Ereignis-Kennung entsteht aus `crypto.randomUUID()`, nie aus dem Text.
 */

/** Woher kommt der Modellaufruf? Deterministisch, ohne Vermutung. */
export type OrbCallSource =
  /** Aufruf innerhalb eines echten ORB-Ereignisses (Chatzug, eigene Frage). */
  | "orb_event"
  /** Aufruf ohne ORB-Ereignis (Entwicklungs-, Mess- oder Testlauf). */
  | "development_test";

/** Welcher ORB-Pfad hat den Aufruf ausgelöst? */
export type OrbCallPath =
  /** Gesprächsbeitrag im Zug einer Benutzernachricht. */
  | "turn_reply"
  /** Formulierung einer eigenen/angeforderten Frage. */
  | "proactive_question"
  /** Pfad nicht zuordenbar (kein Ereigniskontext übergeben). */
  | "unattributed";

/** Wird das Ergebnis dem Benutzer gezeigt oder bleibt es intern? */
export type OrbCallType = "user_visible" | "internal";

/** Ereigniskontext eines einzelnen Verarbeitungsvorgangs. */
export type OrbEventContext = {
  /** Eindeutige, stabile, nicht personenbezogene Ereignis-Kennung. */
  readonly eventId: string;
  readonly source: OrbCallSource;
  readonly path: OrbCallPath;
  readonly callType: OrbCallType;
  /** Zähler der Modellaufrufe dieses Ereignisses (nur Messwert). */
  calls: number;
};

const PREFIX_EVENT = "evt";
const PREFIX_REQUEST = "mrq";

function uuid(): string {
  // Worker-Laufzeit stellt die Web-Crypto-API bereit.
  return crypto.randomUUID();
}

/** Neue Ereignis-Kennung – technisch, eindeutig, nicht aus dem Text erzeugt. */
export function newEventContext(input: {
  path: OrbCallPath;
  callType: OrbCallType;
  source?: OrbCallSource;
}): OrbEventContext {
  return {
    eventId: `${PREFIX_EVENT}_${uuid()}`,
    source: input.source ?? "orb_event",
    path: input.path,
    callType: input.callType,
    calls: 0,
  };
}

/** Ersatzkontext für Aufrufe ohne ORB-Ereignis (kein künstliches Ereignis). */
export function unattributedContext(): OrbEventContext {
  return {
    eventId: `${PREFIX_EVENT}_${uuid()}`,
    source: "development_test",
    path: "unattributed",
    callType: "internal",
    calls: 0,
  };
}

/** Neue Modellaufruf-Kennung, fortlaufend innerhalb des Ereignisses. */
export function nextModelRequest(ctx: OrbEventContext): {
  modelRequestId: string;
  index: number;
} {
  ctx.calls += 1;
  return { modelRequestId: `${PREFIX_REQUEST}_${uuid()}`, index: ctx.calls };
}

export type OrbModelCallRecord = {
  eventId: string;
  modelRequestId: string;
  /** Laufende Nummer des Aufrufs innerhalb des Ereignisses (1, 2, …). */
  index: number;
  source: OrbCallSource;
  path: OrbCallPath;
  callType: OrbCallType;
  /** Welche Sprachschicht: eigener OpenAI-Zugang oder Lovable-Gateway. */
  provider: "openai" | "lovable_gateway";
  model: string;
  endpoint: string;
  success: boolean;
  /** HTTP-Status, falls eine Antwort kam. */
  httpStatus: number | null;
  durationMs: number;
  /** Technischer Fehlergrund ohne Inhalt (z. B. "timeout", "empty_reply"). */
  failureKind: string | null;
  /** Antwortlänge in Zeichen – Menge, kein Inhalt. */
  replyChars: number;
  /** Vom Gateway vergebene Laufkennung, falls die Antwort sie mitschickt. */
  gatewayRunId: string | null;
};

/**
 * Genau eine deterministische Protokollzeile je Modellaufruf.
 * Kein KI-Aufruf, keine Klassifizierung durch ein Modell, kein Inhalt.
 */
export function logModelCall(record: OrbModelCallRecord): void {
  console.info(
    "[orb.obs.model_call]",
    JSON.stringify({
      event_id: record.eventId,
      model_request_id: record.modelRequestId,
      call_index: record.index,
      source: record.source,
      path: record.path,
      call_type: record.callType,
      provider: record.provider,
      model: record.model,
      endpoint: record.endpoint,
      success: record.success,
      http_status: record.httpStatus,
      duration_ms: record.durationMs,
      failure_kind: record.failureKind,
      reply_chars: record.replyChars,
      gateway_run_id: record.gatewayRunId,
    }),
  );
}

/**
 * Genau eine Abschlusszeile je Ereignis: wie viele Modellaufrufe entstanden.
 * Beantwortet später die Frage „Wie viele Modellaufrufe hat Ereignis X erzeugt?".
 */
export function logEventSummary(input: {
  ctx: OrbEventContext;
  /** Ergebnis des Ereignisses, wie es der Core ohnehin kennt. */
  outcome: string;
  dbQueries: number;
  totalMs: number;
}): void {
  console.info(
    "[orb.obs.event]",
    JSON.stringify({
      event_id: input.ctx.eventId,
      source: input.ctx.source,
      path: input.ctx.path,
      call_type: input.ctx.callType,
      model_calls: input.ctx.calls,
      outcome: input.outcome,
      db_queries: input.dbQueries,
      total_ms: input.totalMs,
    }),
  );
}

/** D1: technische Einordnung eines Hintergrund-Analyse-Laufs (keine Inhalte). */
export type OrbAnalysisRunRecord = {
  analysisRunId: string;
  httpStatus: number | null;
  failureKind: string | null;
  preSanitizeCount: number;
  postSanitizeCount: number;
  durationMs: number;
};

/** D: Anbieter der Hintergrundanalyse (Gateway, gleicher Weg wie der Chat). */
export const ANALYSIS_PROVIDER = "lovable_gateway";

/** D1: genau eine Zeile je tatsächlich gestartetem Analyse-Lauf. Nur Konsole. */
export function logAnalysisRun(record: OrbAnalysisRunRecord): void {
  console.info(
    "[orb.obs.analysis_run]",
    JSON.stringify({
      analysis_run_id: record.analysisRunId,
      provider: ANALYSIS_PROVIDER,
      http_status: record.httpStatus,
      failure_kind: record.failureKind,
      pre_sanitize_count: record.preSanitizeCount,
      post_sanitize_count: record.postSanitizeCount,
      duration_ms: record.durationMs,
    }),
  );
}

/**
 * D2: dieselben D1-Werte als `orb_metrics`-Spalten. Rein, ohne Inhalte;
 * nur Kennung, Anbieter, Status, Fehlerart, Zählwerte und Dauer.
 */
export function analysisRunColumns(record: OrbAnalysisRunRecord) {
  return {
    analysis_run_id: record.analysisRunId,
    provider: ANALYSIS_PROVIDER,
    http_status: record.httpStatus,
    failure_kind: record.failureKind,
    pre_sanitize_count: record.preSanitizeCount,
    post_sanitize_count: record.postSanitizeCount,
    duration_ms: record.durationMs,
  };
}
