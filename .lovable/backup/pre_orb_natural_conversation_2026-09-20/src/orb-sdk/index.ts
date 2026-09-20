/**
 * ORB SDK – stabile, browsersichere Schnittstelle (Typen und Kennwerte).
 *
 * Diese Datei ist die EINZIGE Stelle, über die Y-Dude-Oberflächen ORB-Begriffe
 * beziehen. Die eigentliche Rechenlogik liegt unter `src/orb-core/` und wird
 * hier nicht erneut umgesetzt: es gibt genau eine Umsetzung des ORB Core.
 *
 * Bewusst NICHT exportiert werden interne Verfahren (Gewichtung, Verfall,
 * Relevanz, Wissenslücken, Zustandsübergänge, Schwellen der Entscheidungen).
 * Serverseitige Fähigkeiten liegen in `orb-core.server.ts`.
 */

// Zustands- und Darstellungstypen (werden von der Oberfläche gebraucht).
export type { OrbState, OrbDecision, OrbNodeType } from "@/orb-core/core";
export type {
  OrbNode,
  OrbConnection,
  OrbInterest,
  OrbSuggestion,
  OrbSnapshot,
  OrbTurn,
  OrbPerf,
  OrbThreadView,
  OrbCuriosityGap,
  OrbCuriosityInsight,
  OrbProactiveResult,
} from "@/orb-core/engine.server";

// Kennwerte, die die Oberfläche zur Darstellung benötigt (keine Heuristik).
export { W_MIN, STRONG_THRESHOLD, faceFromState } from "@/orb-core/core";
export { CURIOSITY_ASK_THRESHOLD } from "@/orb-core/curiosity";
export { MAX_INPUT_CHARS } from "@/orb-core/engine.server";

// Kernpräsenz: die Entscheidung bleibt vollständig im Core. Nach aussen sind
// nur der Auswertungseinstieg und die Frage sichtbar, ob eine Entscheidung eine
// sichtbare Nachricht erzeugen darf.
export {
  shouldAskProactively,
  presenceProducesUserMessage,
  curiosityBand,
  PROACTIVE_COOLDOWN_MS,
  PROACTIVE_MIN_IDLE_MS,
  PROACTIVE_MAX_IDLE_MS,
  PROACTIVE_SCOPE,
  PROACTIVE_SOCIAL_ACTIONS_ENABLED,
  type ProactiveContext,
  type ProactiveVerdict,
  type ProactiveDimension,
  type CuriosityBand,
} from "@/orb-core/presence";
