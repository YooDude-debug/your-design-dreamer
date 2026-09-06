/**
 * Gemeinsame Typen für den Registrierungs-Check im Admin-Cockpit.
 *
 * Es werden ausschließlich technische Ergebnisse transportiert – niemals
 * Passwörter, Tokens, Secrets oder personenbezogene Daten.
 */

export type CheckStatus = "ok" | "failed" | "manual" | "info";

export type RegistrationCheckId =
  | "registration_ui"
  | "username"
  | "email"
  | "password"
  | "turnstile"
  | "auth"
  | "database"
  | "profile_creation"
  | "email_confirmation"
  | "login"
  | "age_check"
  | "advertising_protection"
  | "production";

export type CheckItem = {
  /** Kurzbeschreibung des Einzeltests. */
  label: string;
  status: CheckStatus;
  /** Verständliche Beschreibung des Ergebnisses. */
  detail: string;
  /** Technische Details (Fehlercode, Statuszeile) – ohne Geheimnisse. */
  technical?: string;
  httpStatus?: number;
  code?: string;
  /** Betroffene Route oder Serverfunktion. */
  target?: string;
  cause?: string;
  action?: string;
};

export type CheckGroup = {
  id: RegistrationCheckId;
  label: string;
  status: CheckStatus;
  durationMs: number;
  items: CheckItem[];
};

export type OverallStatus = "healthy" | "manual_required" | "failed";

export type RegistrationHealthReport = {
  id: string | null;
  kind: "automatic" | "manual";
  createdAt: string;
  overall: OverallStatus;
  durationMs: number;
  errorCount: number;
  groups: CheckGroup[];
  note?: string;
};

export type RegistrationHealthHistory = {
  last: RegistrationHealthReport | null;
  lastHealthy: { createdAt: string; kind: string } | null;
  lastFailure: { createdAt: string; kind: string; errorCount: number } | null;
  /** Anteil fehlerhafter Prüfungen der letzten 30 Tage in Prozent. */
  failureRate30d: number;
  runs30d: number;
  entries: {
    id: string;
    createdAt: string;
    kind: "automatic" | "manual";
    overall: OverallStatus;
    durationMs: number;
    errorCount: number;
  }[];
};

export const CHECK_LABELS: Record<RegistrationCheckId, string> = {
  registration_ui: "Registration UI",
  username: "Username",
  email: "E-Mail",
  password: "Passwort",
  turnstile: "Turnstile",
  auth: "Auth",
  database: "Datenbank",
  profile_creation: "Profilanlage",
  email_confirmation: "E-Mail-Bestätigung",
  login: "Login",
  age_check: "Geburtsdatum & Altersprüfung",
  advertising_protection: "Advertising-/Profiling-Schutz",
  production: "Production",
};

/** Schritte des manuellen Registrierungstests. */
export const MANUAL_STEPS = [
  "Registrierungsseite geöffnet",
  "Formular ausgefüllt",
  "Geburtsdatum eingegeben und akzeptiert",
  "Turnstile erfolgreich gelöst",
  "Konto wurde angelegt",
  "Bestätigungs-E-Mail erhalten",
  "Bestätigungslink funktioniert",
  "Login nach Bestätigung möglich",
  "Profil erreichbar und bearbeitbar",
] as const;

export type ManualStepResult = { label: string; status: "ok" | "failed"; note?: string };

/** Ableitung des Gesamtstatus: Fehler schlägt manuelle Prüfung, diese schlägt OK. */
export function overallFromGroups(groups: CheckGroup[]): OverallStatus {
  if (groups.some((g) => g.status === "failed")) return "failed";
  if (groups.some((g) => g.status === "manual")) return "manual_required";
  return "healthy";
}

export function worstStatus(items: { status: CheckStatus }[]): CheckStatus {
  if (items.some((i) => i.status === "failed")) return "failed";
  if (items.some((i) => i.status === "manual")) return "manual";
  if (items.every((i) => i.status === "info")) return "info";
  return "ok";
}
