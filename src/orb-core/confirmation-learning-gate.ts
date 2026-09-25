/**
 * P5-B5: Eine erfolgreich angewandte reine Bestätigung (B4-Ergebnis
 * ACTIVATED_SINGLE) wird nicht zusätzlich als neue Memory gespeichert.
 * Einziges Kriterium ist der tatsächliche B4-Erfolg – nicht Signal,
 * Diagnose, C1-Referenz oder sichtbare ID allein.
 */
import type { ConfirmationEffect } from "@/orb-core/confirmation-effect";

export function suppressLearningForConfirmation(effect: ConfirmationEffect): boolean {
  return effect === "ACTIVATED_SINGLE";
}
