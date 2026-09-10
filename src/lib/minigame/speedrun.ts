/**
 * Konstanten und Layout-Helfer fuer Steintreppe + Speedrun.
 * Bewusst getrennt von der Engine, damit die Spiellogik schlank bleibt.
 */

/** Sekunden bis zur ersten moeglichen Steintreppe. */
export const STAIR_FIRST_AT = 25;
/** Hoehenversatz je Stufe in px. */
export const STAIR_RISE = 26;

/** Kurzer Countdown vor dem Speedrun (Sekunden). */
export const SPEEDRUN_COUNTDOWN = 0.6;
/** Dauer des Speedruns (Sekunden). */
export const SPEEDRUN_DURATION = 7;
/** Abklingzeit bis zur naechsten Treppe (Sekunden, plus Zufall). */
export const SPEEDRUN_COOLDOWN = 45;
/** Maximal gleichzeitig sichtbare Woerter. */
export const SPEEDRUN_MAX_WORDS = 4;
/** Nachrueck-Takt neuer Woerter (Sekunden). */
export const SPEEDRUN_SPAWN_GAP = { min: 0.6, max: 0.8 };
/** Lebensdauer eines Speedrun-Wortes (Sekunden). */
export const SPEEDRUN_WORD_TTL = 2.2;
/** Bonuspunkte je richtigem Treffer. */
export const SPEEDRUN_HIT_SCORE = 120;
/** Zusatzbonus fuer einen fehlerfreien Speedrun. */
export const SPEEDRUN_PERFECT_BONUS = 250;

/**
 * Stufenanzahl/-breite je nach Canvasbreite.
 * Die Treppe belegt hoechstens ca. 40 % der Breite.
 */
export function stairLayout(canvasWidth: number): { count: number; stepW: number } {
  const mobile = canvasWidth < 480;
  let count = mobile ? 4 : 5;
  let stepW = mobile ? 42 : 48;
  const maxTotal = canvasWidth * 0.4;
  if (count * stepW > maxTotal) {
    stepW = Math.max(30, Math.floor(maxTotal / count));
  }
  if (count * stepW > maxTotal && count > 3) {
    count = 3;
    stepW = Math.max(30, Math.floor(maxTotal / count));
  }
  return { count, stepW };
}
