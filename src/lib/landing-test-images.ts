import athens from "@/assets/athens.jpg";
import berlin from "@/assets/berlin.jpg";
import rio from "@/assets/rio.jpg";
import rostock from "@/assets/rostock.jpg";
import thessaloniki from "@/assets/thessaloniki.jpg";
import tokyo from "@/assets/tokyo.jpg";

/**
 * Feste Bildauswahl für den öffentlichen SlangTag Tester der Landingpage.
 * Es werden ausschließlich bereits vorhandene Projekt-Assets genutzt –
 * keine externen Bilder, keine Speicherung, kein Datenbankbezug.
 */
export const TESTER_IMAGES = [berlin, rostock, athens, thessaloniki, tokyo, rio] as const;

/** Zufälliges Testbild, das nicht dem aktuellen entspricht. */
export function pickTestImage(current?: string): string {
  const options = TESTER_IMAGES.filter((src) => src !== current);
  const pool = options.length > 0 ? options : TESTER_IMAGES;
  return pool[Math.floor(Math.random() * pool.length)] as string;
}
