/**
 * Registrierungs-Tracking (technische Ereignisdaten).
 *
 * Es werden ausschliesslich Ereignisnamen, Fehlerursachen und eine zufaellige
 * Versuchs-ID uebertragen. Keine E-Mail, kein Passwort, kein Token, keine
 * personenbezogenen Inhalte.
 */

export const REGISTRATION_EVENTS = [
  "registration_started",
  "registration_submitted",
  "turnstile_loaded",
  "turnstile_completed",
  "turnstile_failed",
  "validation_failed",
  "auth_failed",
  "profile_creation_failed",
  "email_confirmation_pending",
  "registration_completed",
] as const;

export type RegistrationEvent = (typeof REGISTRATION_EVENTS)[number];

export const REGISTRATION_CAUSES = [
  "turnstile",
  "validation",
  "auth",
  "database",
  "profile_creation",
  "unknown",
] as const;

export type RegistrationCause = (typeof REGISTRATION_CAUSES)[number];

export const CAUSE_LABELS: Record<RegistrationCause, string> = {
  turnstile: "Turnstile",
  validation: "Validierung",
  auth: "Auth",
  database: "Datenbank",
  profile_creation: "Profil-Erstellung",
  unknown: "Unbekannter Fehler",
};

export const REGISTRATION_RANGES = ["today", "7d", "30d", "all"] as const;
export type RegistrationRange = (typeof REGISTRATION_RANGES)[number];

export const RANGE_LABELS: Record<RegistrationRange, string> = {
  today: "Heute",
  "7d": "7 Tage",
  "30d": "30 Tage",
  all: "Seit Beginn der Messung",
};

export type FunnelStage = {
  key: string;
  label: string;
  /** null = fuer diesen Zeitraum nicht messbar (keine Schaetzung). */
  count: number | null;
  /** Quelle der Zahl: Ereignisdaten oder Kontodaten. */
  source: "events" | "accounts";
};

export type RegistrationMetrics = {
  range: RegistrationRange;
  /** Beginn des ausgewerteten Zeitraums (ISO) oder null bei "seit Beginn". */
  from: string | null;
  /** Erstes ueberhaupt erfasste Ereignis (Beginn der Messung), ISO oder null. */
  measurementStart: string | null;
  /** true, wenn der Zeitraum vor dem Messbeginn liegt. */
  historyIncomplete: boolean;
  attempts: number;
  completed: number;
  failed: number;
  abandoned: number;
  /** Prozentwerte 0..100, null wenn keine Versuche vorliegen. */
  failureRate: number | null;
  abandonRate: number | null;
  conversionRate: number | null;
  eventCounts: Record<RegistrationEvent, number>;
  causeCounts: Record<RegistrationCause, number>;
  funnel: FunnelStage[];
};
