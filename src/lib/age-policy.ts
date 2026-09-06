/**
 * Jugendschutz: technisch durchgesetztes Mindestalter.
 *
 * Das Mindestalter ist eine bewusst zentral gehaltene Konfiguration, damit
 * Registrierung (Client), Registrierungs-Serverfunktion und Rechtstexte
 * denselben Wert verwenden. Es findet ausschliesslich eine Selbstauskunft
 * (Geburtsdatum) statt – keine Ausweis- oder Dokumentenprüfung.
 *
 * Verbindlich ist immer die serverseitige Auswertung (Registrierung sowie die
 * Datenbankfunktion `public.my_age_status()`); der Client rechnet nur zur
 * sofortigen Rückmeldung mit.
 */
export const MIN_AGE_YEARS = 14;

/** Volljährigkeitsgrenze für werbebezogene Entscheidungen. */
export const ADULT_AGE_YEARS = 18;

/** Altersstatus eines Kontos. */
export type AgeStatus = "BLOCKED" | "MINOR_14_17" | "ADULT_18_PLUS" | "UNKNOWN";

/** ISO-Datum (YYYY-MM-DD) auf Plausibilität prüfen. */
export function isValidBirthdate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  const year = d.getUTCFullYear();
  return year >= 1900 && d.getTime() <= Date.now();
}

/** Alter in vollen Jahren zum Stichtag (Standard: heute). */
export function ageInYears(birthdate: string, now = new Date()): number {
  const d = new Date(`${birthdate}T00:00:00Z`);
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < d.getUTCMonth() ||
    (now.getUTCMonth() === d.getUTCMonth() && now.getUTCDate() < d.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** Erfüllt das Geburtsdatum das Mindestalter? */
export function meetsMinAge(birthdate: string, now = new Date()): boolean {
  return isValidBirthdate(birthdate) && ageInYears(birthdate, now) >= MIN_AGE_YEARS;
}

/**
 * Altersstatus aus einem Geburtsdatum ableiten.
 * Ungültige oder fehlende Angaben ergeben `BLOCKED` (fail-closed).
 */
export function ageStatusFromBirthdate(
  birthdate: string | null | undefined,
  now = new Date(),
): AgeStatus {
  if (!birthdate || !isValidBirthdate(birthdate)) return "BLOCKED";
  const age = ageInYears(birthdate, now);
  if (age < MIN_AGE_YEARS) return "BLOCKED";
  if (age < ADULT_AGE_YEARS) return "MINOR_14_17";
  return "ADULT_18_PLUS";
}

/** Darf dieses Konto in personalisiertes Werbe-Profiling einbezogen werden? */
export function allowsAdvertisingProfiling(status: AgeStatus): boolean {
  return status === "ADULT_18_PLUS";
}
