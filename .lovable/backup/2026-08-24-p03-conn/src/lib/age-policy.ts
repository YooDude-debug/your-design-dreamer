/**
 * Jugendschutz: technisch durchgesetztes Mindestalter.
 *
 * Das Mindestalter ist eine bewusst zentral gehaltene Konfiguration, damit
 * Registrierung (Client), Registrierungs-Serverfunktion und Rechtstexte
 * denselben Wert verwenden. Es findet ausschliesslich eine Selbstauskunft
 * (Geburtsdatum) statt – keine Ausweis- oder Dokumentenprüfung.
 */
export const MIN_AGE_YEARS = 16;

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
