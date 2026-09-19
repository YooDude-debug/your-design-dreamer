/**
 * Ableitung der Avatar-Animation aus dem bestehenden ORB-Innenzustand.
 *
 * Reine Funktionen, keine Server- oder Datenbankzugriffe. Der Zustand
 * (`OrbState`) bleibt die einzige Quelle: es gibt keine zweite
 * State-Architektur für den Avatar.
 */

import type { OrbState } from "@/orb-sdk";

/** Sichtbare Tätigkeit des ORB – ausschliesslich aus vorhandenen UI-Flags. */
export type OrbActivity = "idle" | "listening" | "thinking" | "speaking";

/** Welche Darstellung der Benutzer gewählt hat. */
export type OrbAvatarMode = "face" | "emoji";

export const ORB_AVATAR_STORAGE_KEY = "orb.avatar.mode";

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export type OrbFaceAnimation = {
  /** Lidöffnung 0–1 (1 = normal geöffnet, >1 nicht erlaubt). */
  eyeOpen: number;
  /** Maximale Blickabweichung in Prozent der Bildbreite. */
  gazeRange: number;
  /** Basisintervall zwischen zwei Blinzlern in Millisekunden. */
  blinkBase: number;
  /** Zufällige Streuung des Blinkintervalls in Millisekunden. */
  blinkJitter: number;
  /** Augenbrauen: positiv = gehoben (fragend), negativ = leicht gesenkt. */
  brow: number;
  /** Lächeln 0–1 (weiche Mundwinkel, kein Cartoon-Grinsen). */
  smile: number;
  /** Anspannung 0–1 – strafft die Mimik (Angst, Unsicherheit). */
  tension: number;
  /** Dauer eines Atem-/Mikrobewegungszyklus in Sekunden. */
  breathSeconds: number;
  /** Kopfneigung in Grad – sehr klein gehalten. */
  tilt: number;
};

/**
 * Bildet die sechs bestehenden Zustandswerte auf subtile Animationsparameter ab.
 * Alle Ausgaben sind bewusst eng begrenzt (keine übertriebenen Emotionen).
 */
export function faceAnimationFromState(state: OrbState, activity: OrbActivity): OrbFaceAnimation {
  const curiosity = clamp(state.curiosity, 0, 1);
  const joy = clamp(state.joy, 0, 1);
  const fear = clamp(state.fear, 0, 1);
  const trust = clamp(state.trust, 0, 1);
  const uncertainty = clamp(state.uncertainty, 0, 1);
  const energy = clamp(state.energy, 0, 1);

  // Neugier und Angst öffnen die Augen leicht, Vertrauen entspannt sie.
  const eyeOpen = clamp(0.9 + 0.1 * curiosity + 0.08 * fear - 0.06 * trust, 0.82, 1);
  // Unsicherheit und Energie lassen den Blick etwas mehr wandern.
  const gazeRange = clamp(0.4 + 1.1 * uncertainty + 0.8 * energy, 0.4, 2.2);
  // Ruhiger Grundtakt; Angst und Energie blinzeln etwas häufiger.
  const blinkBase = clamp(5200 - 1400 * energy - 900 * fear + 1200 * trust, 2600, 7000);

  return {
    eyeOpen: activity === "listening" ? clamp(eyeOpen + 0.02, 0, 1) : eyeOpen,
    gazeRange: activity === "thinking" ? gazeRange * 1.4 : gazeRange,
    blinkBase: activity === "speaking" ? blinkBase * 1.15 : blinkBase,
    blinkJitter: 2200,
    brow: clamp(0.55 * uncertainty + 0.3 * curiosity - 0.2 * trust, -0.2, 0.7),
    smile: clamp(0.75 * joy + 0.2 * trust - 0.5 * fear - 0.2 * uncertainty, 0, 0.7),
    tension: clamp(0.7 * fear + 0.3 * uncertainty, 0, 0.8),
    breathSeconds: clamp(6.5 - 2.5 * energy, 3.6, 7),
    tilt: clamp((uncertainty - 0.35) * 2.2, -1.2, 1.6),
  };
}

/** Gültige gespeicherte Auswahl lesen (Fallback: bestehendes ORB-Emoji). */
export function parseAvatarMode(raw: string | null | undefined): OrbAvatarMode {
  return raw === "face" ? "face" : "emoji";
}
