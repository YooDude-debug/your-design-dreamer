/**
 * ORB Core – finale Freigabe des autonomen Sprechens (reine Logik).
 *
 * Diese Datei enthält KEINE Datenbank- und keine Netzwerkzugriffe und ruft
 * keine KI auf. Sie fasst die beiden bereits bestehenden Entscheidungen
 * (Curiosity und Impulse) zu genau einer letzten Freigabe zusammen, bevor eine
 * Frage formuliert wird.
 *
 * Grund: Energie ist eine gemeinsame Ressource des autonomen Verhaltens. Der
 * Curiosity-Zweig prüft sie bereits (`CURIOSITY_MIN_ENERGY`); der
 * Impulse-Zweig kennt keinen Energiewert. Ohne diese zentrale Prüfung konnte
 * ein Impuls eine aktive Energiesperre überstimmen.
 *
 * Es wird KEINE neue Schwelle eingeführt: verwendet wird ausschliesslich der
 * bestehende Wert `CURIOSITY_MIN_ENERGY`.
 */

import { CURIOSITY_MIN_ENERGY, type CuriosityDecision } from "@/orb-core/curiosity";
import type { ImpulseDecision } from "@/orb-core/impulse";

/** Globale Energiegrenze des autonomen Verhaltens (identisch zur Neugier). */
export const AUTONOMY_MIN_ENERGY = CURIOSITY_MIN_ENERGY;

/** Welches Tor hat die endgültige Entscheidung bestimmt? */
export type AutonomyGate = "suppressed" | "no_candidate" | "energy" | "pass";

export type AutonomyGateDecision = {
  /** Darf jetzt eine Frage formuliert werden? */
  allowed: boolean;
  gate: AutonomyGate;
  /** Herkunft der Freigabe – nur gesetzt, wenn `allowed`. */
  source: "curiosity" | "impulse" | null;
  /** Nach aussen sichtbare Handlung bei Ablehnung. */
  action: "DO_NOTHING" | "WAIT" | "ASK";
  reason: string;
};

export type AutonomyGateInput = {
  energy: number;
  curiosity: CuriosityDecision;
  impulse: ImpulseDecision;
};

/**
 * Endgültige Freigabe. Die Reihenfolge ist die Begründung:
 *
 *   1. Der Nutzer hat abgewinkt          → still (bestehendes Verhalten)
 *   2. Kein Kandidat aus beiden Zweigen  → still (bestehendes Verhalten)
 *   3. Energie unter der globalen Grenze → WAIT, auch bei Impulse SPEAK (neu)
 *   4. sonst Freigabe, Impulse hat Vorrang (bestehendes Verhalten)
 */
export function finalAutonomyGate(input: AutonomyGateInput): AutonomyGateDecision {
  const impulseCandidate = input.impulse.action === "SPEAK" ? input.impulse.impulse : null;
  const curiosityCandidate = input.curiosity.action === "ASK" ? input.curiosity.gap : null;

  if (input.impulse.suppressed) {
    return {
      allowed: false,
      gate: "suppressed",
      source: null,
      action: "WAIT",
      reason: input.impulse.reason,
    };
  }
  if (!impulseCandidate && !curiosityCandidate) {
    return {
      allowed: false,
      gate: "no_candidate",
      source: null,
      action: input.curiosity.action === "ASK" ? "WAIT" : input.curiosity.action,
      reason: input.curiosity.reason,
    };
  }
  if (input.energy < AUTONOMY_MIN_ENERGY) {
    return {
      allowed: false,
      gate: "energy",
      source: null,
      action: "WAIT",
      reason: `Zu wenig Energie (${input.energy.toFixed(3)} < ${AUTONOMY_MIN_ENERGY}) – ORB wartet.`,
    };
  }
  return {
    allowed: true,
    gate: "pass",
    source: impulseCandidate ? "impulse" : "curiosity",
    action: "ASK",
    reason: impulseCandidate ? input.impulse.reason : input.curiosity.reason,
  };
}

/* ------------------------------------------------- Nachvollziehbarkeit */

/**
 * Interner Versuchsnachweis. Er wird NICHT in einer neuen Tabelle gespeichert:
 * er wird im Ergebnisobjekt zurückgegeben und serverseitig einmal je Versuch
 * strukturiert protokolliert. Kein Takt-Logging, keine Chatnachricht.
 */
export type OrbAutonomyAttempt = {
  at: string;
  result: "asked" | "silent";
  curiosityAction: CuriosityDecision["action"];
  impulseAction: ImpulseDecision["action"];
  gate: AutonomyGate | "formulation" | "duplicate";
  reason: string;
  energy: number;
  curiosity: number;
  score: number | null;
  source: "curiosity" | "impulse" | null;
  duplicate: boolean | null;
  topic: string | null;
};
