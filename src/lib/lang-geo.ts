import type { Lang } from "./i18n-dict";

/**
 * Zentrale Zuordnung Land -> Oberflächensprache.
 * Deutschland/Österreich/Schweiz -> Deutsch, Griechenland/Zypern -> Griechisch,
 * alles andere -> Englisch.
 */
const DE_COUNTRIES = new Set(["DE", "AT", "CH", "LI", "LU"]);
const EL_COUNTRIES = new Set(["GR", "CY"]);

export function langFromCountry(code: string | null | undefined): Lang | null {
  const cc = (code ?? "").trim().toUpperCase();
  if (!cc || cc.length !== 2) return null;
  if (DE_COUNTRIES.has(cc)) return "de";
  if (EL_COUNTRIES.has(cc)) return "el";
  return "en";
}

const TZ_DE = new Set([
  "Europe/Berlin",
  "Europe/Vienna",
  "Europe/Zurich",
  "Europe/Busingen",
  "Europe/Vaduz",
  "Europe/Luxembourg",
]);
const TZ_EL = new Set(["Europe/Athens", "Asia/Nicosia", "Europe/Nicosia"]);

/**
 * Sofortige, kostenlose Vorabschätzung im Browser (keine Netzwerkanfrage).
 * Wird direkt beim ersten Rendern genutzt, damit nichts verzögert wird;
 * die serverseitige Länderkennung darf sie danach korrigieren.
 */
export function guessLangFromBrowser(): Lang {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    if (TZ_DE.has(tz)) return "de";
    if (TZ_EL.has(tz)) return "el";
    const nav = typeof navigator !== "undefined" ? (navigator.language ?? "") : "";
    const region = nav.split("-")[1]?.toUpperCase();
    const byRegion = langFromCountry(region);
    if (byRegion) return byRegion;
    const base = nav.slice(0, 2).toLowerCase();
    if (base === "de") return "de";
    if (base === "el") return "el";
  } catch {
    /* Umgebung ohne Intl/navigator */
  }
  return "en";
}
