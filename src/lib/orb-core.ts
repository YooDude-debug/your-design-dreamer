/**
 * ORB Core – reine Rechenlogik (ohne Datenbank, ohne Netzwerk).
 *
 * Grundprinzip: VERGESSEN ≠ LÖSCHEN.
 * Das Gewicht einer Verbindung wird zum Abfragezeitpunkt aus den gespeicherten
 * Werten berechnet:
 *
 *   W(t) = W₀ · e^(−λ(t−τ)) · I + Σ ΔW,  immer ≥ W_MIN
 *
 * Es gibt in dieser Datei keinen Vorgang, der eine Erinnerung entfernt. Der
 * Verfall senkt ausschliesslich das berechnete Gewicht; die Struktur bleibt.
 */

/** Untergrenze: ein Gewicht faellt nie unter diesen Wert. */
export const W_MIN = 0.05;
/** Obergrenze des Gewichts. */
export const W_MAX = 1;
/** Ab diesem berechneten Gewicht gilt eine Verbindung als "stark". */
export const STRONG_THRESHOLD = 0.5;
/** Eine Sekunde in Millisekunden – Basis der Zeitrechnung. */
const HOUR_MS = 3_600_000;

export type OrbNodeType =
  | "fact"
  | "emotion"
  | "memory"
  | "action"
  | "perception"
  | "decision"
  | "goal";

export type OrbState = {
  curiosity: number;
  joy: number;
  fear: number;
  trust: number;
  uncertainty: number;
  energy: number;
};

export type OrbDecision = "answer" | "ask" | "remind" | "warn" | "stay_silent";

export type DecayInput = {
  /** Gespeichertes Gewicht zum Zeitpunkt der letzten Aktivierung (W₀). */
  weight: number;
  /** Wichtigkeit der Verbindung (I) – hohe Wichtigkeit vergisst langsamer. */
  importance: number;
  /** Vergessensrate (λ) pro Stunde. */
  decayRate: number;
  /** Zeitpunkt der letzten Aktivierung (τ) in Millisekunden. */
  lastActivatedAt: number;
  /** Aktueller Zeitpunkt (t) in Millisekunden. */
  now: number;
};

/** Wert auf 0..1 begrenzen. */
export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Aktuelles Gewicht einer Verbindung. Reine Berechnung – der gespeicherte
 * Datensatz wird dadurch nie verändert und nie entfernt.
 */
export function currentWeight(input: DecayInput): number {
  const hours = Math.max(0, (input.now - input.lastActivatedAt) / HOUR_MS);
  // Wichtigkeit bremst den Verfall: I = 1 bedeutet halbe Vergessensrate.
  const effectiveRate = input.decayRate * (1 - 0.5 * clamp01(input.importance));
  const decayed = input.weight * Math.exp(-effectiveRate * hours);
  return Math.min(W_MAX, Math.max(W_MIN, decayed));
}

/**
 * Reaktivierung: W(t+1) = W(t) + ΔW. Ausgangspunkt ist immer das aktuell
 * berechnete (verfallene) Gewicht, nicht der alte Speicherwert.
 */
export function reactivate(input: DecayInput, delta: number): number {
  return Math.min(W_MAX, Math.max(W_MIN, currentWeight(input) + Math.max(0, delta)));
}

/** Verstärkung durch eine neue Erfahrung (ΔW). */
export function reinforcement(importance: number, repetitions = 1): number {
  return clamp01(0.08 + 0.22 * clamp01(importance)) * Math.min(3, Math.max(1, repetitions));
}

/** Starke Verbindung = durchgezogene Linie, schwache = gestrichelt. */
export function isStrong(weight: number): boolean {
  return weight >= STRONG_THRESHOLD;
}

/**
 * Wichtigkeit einer Erfahrung. Länge, Fragezeichen, Wiederholung und
 * Schlüsselwörter (Merken, Fehler, Ziel) erhöhen sie.
 */
export function scoreImportance(text: string, opts?: { isLearningEvent?: boolean }): number {
  const t = text.trim().toLowerCase();
  if (!t) return 0;
  let score = 0.25;
  if (t.length > 60) score += 0.1;
  if (t.length > 200) score += 0.1;
  if (t.includes("?")) score += 0.05;
  const markers = [
    "merk",
    "wichtig",
    "immer",
    "nie",
    "fehler",
    "falsch",
    "ziel",
    "remember",
    "important",
    "mistake",
    "goal",
  ];
  if (markers.some((m) => t.includes(m))) score += 0.2;
  // Persönliche Angaben und Vorlieben sind für ein Gedächtnis bedeutsam.
  const personal = [
    "ich heiße",
    "ich heisse",
    "mein name",
    "ich bin",
    "ich liebe",
    "ich mag",
    "ich hasse",
    "ich wohne",
    "my name",
    "i love",
    "i like",
    "i hate",
    "i live",
  ];
  if (personal.some((m) => t.includes(m))) score += 0.15;
  if (opts?.isLearningEvent) score += 0.35;
  return clamp01(score);
}

/** Bedeutende Lernerfahrung ("Riss") – hohe Wichtigkeit plus Fehlerbezug. */
export function isLearningEvent(text: string): boolean {
  const t = text.trim().toLowerCase();
  const markers = ["fehler", "falsch", "sorry", "korrektur", "mistake", "wrong", "λάθος"];
  return markers.some((m) => t.includes(m));
}

/** Nur bedeutende Erfahrungen werden dauerhaft gespeichert. */
export function shouldPersist(importance: number): boolean {
  return importance >= 0.35;
}

/**
 * Zustandsänderung aus einer Erfahrung. Werte bleiben in 0..1.
 * Dies ist eine technische Simulation, kein Bewusstsein.
 */
export function nextState(
  state: OrbState,
  ev: { importance: number; isQuestion: boolean; isLearning: boolean; recalled: number },
): OrbState {
  const i = clamp01(ev.importance);
  return {
    curiosity: clamp01(state.curiosity + (ev.isQuestion ? 0.08 : -0.02) + 0.05 * i),
    joy: clamp01(state.joy + (ev.isLearning ? -0.05 : 0.03) + 0.02 * ev.recalled),
    fear: clamp01(state.fear + (ev.isLearning ? 0.12 : -0.03)),
    trust: clamp01(state.trust + 0.02 + 0.03 * Math.min(3, ev.recalled)),
    uncertainty: clamp01(state.uncertainty + (ev.recalled === 0 ? 0.07 : -0.06 - 0.02 * i)),
    energy: clamp01(state.energy - 0.03 - 0.04 * i),
  };
}

/**
 * Regelbasierte Entscheidung – nachvollziehbar, kein autonomes Agentensystem.
 * Reihenfolge der Regeln ist die Begründung.
 */
export function decide(input: {
  state: OrbState;
  recalled: number;
  isQuestion: boolean;
  isLearning: boolean;
}): { decision: OrbDecision; reason: string } {
  const { state } = input;
  if (state.energy < 0.12) {
    return { decision: "stay_silent", reason: "Energie zu niedrig – kurze Pause." };
  }
  if (input.isLearning && state.fear > 0.35) {
    return { decision: "warn", reason: "Lernerfahrung mit hoher Vorsicht – Hinweis geben." };
  }
  if (state.uncertainty > 0.6 || (input.isQuestion && input.recalled === 0)) {
    return { decision: "ask", reason: "Unsicherheit hoch oder keine passende Erinnerung." };
  }
  if (input.recalled >= 2 && state.trust >= 0.4) {
    return { decision: "remind", reason: "Mehrere starke Erinnerungen passen zur Eingabe." };
  }
  return { decision: "answer", reason: "Ausreichend Kontext und Zustand für eine Antwort." };
}

/** Gesichtsausdruck: wird ausschliesslich aus dem Zustand berechnet. */
export function faceFromState(state: OrbState) {
  return {
    /** Augenöffnung (0.4 = schmal, 1.6 = weit) – Neugier und Angst. */
    eyeOpen: 0.6 + 0.9 * state.curiosity - 0.3 * state.fear,
    /** Mundkrümmung: positiv = Lächeln, negativ = vorsichtig. */
    mouthCurve: state.joy - state.fear - 0.3 * state.uncertainty,
    /** Kopfneigung in Grad – Unsicherheit neigt den Kopf. */
    tilt: (state.uncertainty - 0.3) * 14,
    /** Pulsdauer in Sekunden – viel Energie pulsiert schneller. */
    pulseSeconds: 4.2 - 2.4 * state.energy,
    /** Blickbewegung in Prozent – Nachdenken wandert mehr. */
    gaze: 0.2 + 0.8 * state.uncertainty,
    /** Bewegungsdämpfung: Angst reduziert Bewegung. */
    motion: clamp01(1 - state.fear * 0.8),
  };
}

/** Rangfolge der Erinnerungen: Gewicht × Wichtigkeit × Textähnlichkeit. */
export function relevanceScore(weight: number, importance: number, overlap: number): number {
  return weight * (0.5 + 0.5 * clamp01(importance)) * (0.3 + 0.7 * clamp01(overlap));
}

/** Einfache Wortüberlappung als Ähnlichkeitsmass (ohne Bibliothek). */
export function textOverlap(a: string, b: string): number {
  const words = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((w) => w.length > 3),
    );
  const wa = words(a);
  const wb = words(b);
  if (wa.size === 0 || wb.size === 0) return 0;
  let hits = 0;
  for (const w of wa) if (wb.has(w)) hits += 1;
  return hits / Math.min(wa.size, wb.size);
}
