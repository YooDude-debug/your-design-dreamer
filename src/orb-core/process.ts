/**
 * ORB Core – Process Guardrail & Context Drift Detection, reine Logik.
 *
 * Diese Datei enthält KEINE Datenbank- und keine Netzwerkzugriffe und ruft
 * keine KI auf. Sie beantwortet genau eine Frage:
 *
 *   „Passt die aktuelle Handlung noch zum bekannten Prozesszustand?“
 *
 * Grundsatz: ORB ist kein Prozess-Controller. ORB stellt verlorenen Kontext
 * wieder her und gibt die Entscheidung an den Menschen zurück. Es wird nichts
 * blockiert, abgebrochen oder eigenmächtig verändert.
 *
 * Der Prozesszustand liegt im bestehenden Spiderweb (Knoten + Verbindungen).
 * Es gibt keine zweite Prozessdatenbank und keine neue Bewertungsformel für
 * Speicherung – Wichtigkeit, Konfidenz und Verfall bleiben unverändert.
 */

import { clamp01 } from "@/orb-core/core";

/* ------------------------------------------------------------------- Typen */

export const PROCESS_STATUSES = [
  "pending",
  "active",
  "completed",
  "skipped",
  "blocked",
  "cancelled",
  "unknown",
] as const;

export type ProcessStatus = (typeof PROCESS_STATUSES)[number];

export function asProcessStatus(value: unknown): ProcessStatus {
  return typeof value === "string" && (PROCESS_STATUSES as readonly string[]).includes(value)
    ? (value as ProcessStatus)
    : "unknown";
}

/** Ein Prozessschritt, gelesen aus einem bestehenden Wissensknoten. */
export type ProcessStep = {
  nodeId: string;
  /** Name des Prozesses (z. B. „database_migration“). */
  process: string;
  title: string;
  status: ProcessStatus;
  /** Reihenfolge innerhalb des Prozesses, falls bekannt. */
  order: number | null;
  importance: number;
  confidence: number;
  /** Knoten-IDs, von denen dieser Schritt abhängt. */
  dependsOn: string[];
  /** Zeitpunkt der letzten bekannten Aktualisierung (ms). */
  updatedAt: number;
  /** Nur gesetzt, wenn der Nutzer den Schritt ausdrücklich bestätigt hat. */
  userConfirmed?: boolean;
  reason?: string | null;
};

/** Lesesicht eines Knotens aus dem Spiderweb. */
export type ProcessNode = {
  id: string;
  content: string;
  topic: string | null;
  category: string | null;
  importance: number;
  confidence: number;
  metadata: Record<string, unknown> | null;
  updatedAt: number;
};

/** Lesesicht einer Verbindung aus dem Spiderweb. */
export type ProcessConnection = {
  sourceNodeId: string;
  targetNodeId: string;
  weight: number;
  metadata?: Record<string, unknown> | null;
};

const PROCESS_CATEGORIES = new Set(["process_step", "process", "roadmap_step"]);
const DEPENDS_RELATIONS = new Set(["depends_on", "requires", "voraussetzung"]);

/**
 * Liest Prozessschritte aus bereits geladenen Knoten und Verbindungen.
 * Es wird ausschliesslich bestehende Struktur genutzt (Kategorie + Metadaten).
 */
export function readProcessSteps(
  nodes: ProcessNode[],
  connections: ProcessConnection[],
): ProcessStep[] {
  const dependsOn = new Map<string, string[]>();
  for (const c of connections) {
    const relation = typeof c.metadata?.["relation"] === "string" ? c.metadata["relation"] : null;
    if (!relation || !DEPENDS_RELATIONS.has(relation)) continue;
    dependsOn.set(c.sourceNodeId, [...(dependsOn.get(c.sourceNodeId) ?? []), c.targetNodeId]);
  }

  const steps: ProcessStep[] = [];
  for (const node of nodes) {
    const meta = node.metadata ?? {};
    const isStep =
      (node.category !== null && PROCESS_CATEGORIES.has(node.category)) ||
      (typeof meta["kind"] === "string" && PROCESS_CATEGORIES.has(meta["kind"]));
    if (!isStep) continue;
    const process =
      (typeof meta["process"] === "string" && meta["process"]) || node.topic || "unbenannt";
    steps.push({
      nodeId: node.id,
      process,
      title: (typeof meta["title"] === "string" && meta["title"]) || node.content,
      status: asProcessStatus(meta["status"]),
      order: typeof meta["order"] === "number" ? meta["order"] : null,
      importance: clamp01(node.importance),
      confidence: clamp01(node.confidence),
      dependsOn: dependsOn.get(node.id) ?? [],
      updatedAt: node.updatedAt,
      userConfirmed: meta["user_confirmation"] === "explicit",
      reason: typeof meta["reason"] === "string" ? meta["reason"] : null,
    });
  }

  return steps.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

/* --------------------------------------------------------- Aktuelle Absicht */

export type CurrentIntent = {
  action: string;
  target: string | null;
  process: string | null;
  /** Wie deutlich die Absicht im Text erkennbar ist (0..1). */
  clarity: number;
};

const ACTION_PATTERNS: Array<{ action: string; re: RegExp; consequence: number }> = [
  {
    action: "production_migration",
    re: /(production|produktiv\w*|live).{0,30}(migration|migrier\w*|deploy\w*)/i,
    consequence: 1,
  },
  {
    action: "production_migration",
    re: /(migration|migrier\w*|deploy\w*).{0,30}(production|produktiv\w*|live)/i,
    consequence: 1,
  },
  {
    action: "production_deploy",
    re: /(deploy\w*|veröffentlich\w*|ausrollen).{0,30}(production|live)/i,
    consequence: 1,
  },
  {
    action: "database_migration",
    re: /(migration|migrier\w*).{0,20}(datenbank|schema|\bdb\b)/i,
    consequence: 0.8,
  },
  {
    action: "database_migration",
    re: /(datenbank|schema|db).{0,20}(migrier\w*|migration)/i,
    consequence: 0.8,
  },
  {
    action: "data_delete",
    re: /(lösch\w*|entfern\w*|drop).{0,20}(daten|tabelle|datenbank)/i,
    consequence: 1,
  },
  {
    action: "staging_test",
    re: /(staging|test).{0,20}(test\w*|prüf\w*|validier\w*)/i,
    consequence: 0.4,
  },
  { action: "backup", re: /(backup|sicherung)/i, consequence: 0.5 },
];

const TARGET_PATTERNS: Array<{ target: string; re: RegExp }> = [
  { target: "production_database", re: /(production|produktiv\w*|live)/i },
  { target: "staging", re: /(staging|testumgebung)/i },
  { target: "database", re: /(datenbank|schema|\bdb\b)/i },
];

const NOW_RE = /\b(jetzt|los|sofort|direkt|gleich|lass uns)\b/i;

/** Erkennt die aktuelle Handlungsabsicht deterministisch aus dem Text. */
export function detectIntent(text: string): CurrentIntent | null {
  let found: { action: string; consequence: number } | null = null;
  for (const pattern of ACTION_PATTERNS) {
    if (pattern.re.test(text)) {
      found = { action: pattern.action, consequence: pattern.consequence };
      break;
    }
  }
  if (!found) return null;
  const target = TARGET_PATTERNS.find((p) => p.re.test(text))?.target ?? null;
  return {
    action: found.action,
    target,
    process: found.action.includes("migration") ? "database_migration" : null,
    clarity: clamp01(0.6 + (NOW_RE.test(text) ? 0.3 : 0) + (target ? 0.1 : 0)),
  };
}

/** Mögliche Auswirkung der Absicht – reine Bewertung, keine Speicherformel. */
export function consequenceOf(intent: CurrentIntent): number {
  const match = ACTION_PATTERNS.find((p) => p.action === intent.action);
  return match ? match.consequence : 0.5;
}

/* ------------------------------------------------------- Abweichungserkennung */

export type DriftKind =
  | "pending_prerequisite"
  | "step_skipped"
  | "dependency_unmet"
  | "unknown_state"
  | "contradicts_decision"
  | "process_changed"
  | "explicitly_completed";

export type DriftResult = {
  contextDriftDetected: boolean;
  kind: DriftKind | null;
  /** Schritte, die die Abweichung auslösen. */
  blockingSteps: ProcessStep[];
  reason: string;
};

/** Welcher Schritt gehört zu der angeforderten Handlung? */
function targetStep(steps: ProcessStep[], intent: CurrentIntent): ProcessStep | null {
  const re = new RegExp(intent.action.split("_").join(".{0,20}"), "i");
  return (
    steps.find((s) => re.test(s.title.toLowerCase())) ??
    steps.find((s) => intent.target !== null && s.title.toLowerCase().includes("production")) ??
    null
  );
}

/**
 * Vergleicht die aktuelle Absicht mit dem bekannten Prozesszustand.
 * Nur belastbare Zustände werden verwendet, es wird nicht spekuliert.
 */
export function detectContextDrift(input: {
  steps: ProcessStep[];
  intent: CurrentIntent;
  now: number;
}): DriftResult {
  const { steps, intent } = input;
  const still = (reason: string): DriftResult => ({
    contextDriftDetected: false,
    kind: null,
    blockingSteps: [],
    reason,
  });

  if (steps.length === 0) return still("Kein bekannter Prozesszustand vorhanden.");

  const target = targetStep(steps, intent);
  const process = target?.process ?? intent.process;
  const relevant = steps.filter((s) => (process ? s.process === process : true));
  if (relevant.length === 0) return still("Kein passender Prozess bekannt.");

  const byId = new Map(relevant.map((s) => [s.nodeId, s]));
  const order = target?.order ?? null;

  // C) Ausdrücklich hinterlegte Abhängigkeit nicht erfüllt.
  if (target) {
    const unmet = target.dependsOn
      .map((id) => byId.get(id))
      .filter((s): s is ProcessStep => Boolean(s))
      .filter((s) => s.status === "pending" || s.status === "active" || s.status === "blocked");
    if (unmet.length > 0) {
      return {
        contextDriftDetected: true,
        kind: "dependency_unmet",
        blockingSteps: unmet,
        reason: `Voraussetzung noch offen: ${unmet.map((s) => s.title).join(", ")}.`,
      };
    }
    const unknown = target.dependsOn
      .map((id) => byId.get(id))
      .filter((s): s is ProcessStep => Boolean(s))
      .filter((s) => s.status === "unknown");
    if (unknown.length > 0) {
      return {
        contextDriftDetected: true,
        kind: "unknown_state",
        blockingSteps: unknown,
        reason: `Zustand nicht erfasst: ${unknown.map((s) => s.title).join(", ")}.`,
      };
    }
  }

  // B) Ein blockierter oder abgebrochener Schritt steht der Handlung entgegen.
  const blocked = relevant.filter((s) => s.status === "blocked");
  if (blocked.length > 0) {
    return {
      contextDriftDetected: true,
      kind: "contradicts_decision",
      blockingSteps: blocked,
      reason: `Ein Schritt ist als blockiert erfasst: ${blocked.map((s) => s.title).join(", ")}.`,
    };
  }

  // A) Früherer Pflichtschritt in der Reihenfolge noch offen.
  if (order !== null) {
    const earlier = relevant.filter((s) => s.order !== null && s.order < order);
    const open = earlier.filter((s) => s.status === "pending" || s.status === "active");
    if (open.length > 0) {
      return {
        contextDriftDetected: true,
        kind: "pending_prerequisite",
        blockingSteps: open,
        reason: `Vorheriger Schritt noch offen: ${open.map((s) => s.title).join(", ")}.`,
      };
    }
    const unknownEarlier = earlier.filter((s) => s.status === "unknown");
    if (unknownEarlier.length > 0) {
      return {
        contextDriftDetected: true,
        kind: "unknown_state",
        blockingSteps: unknownEarlier,
        reason: `Zustand nicht erfasst: ${unknownEarlier.map((s) => s.title).join(", ")}.`,
      };
    }
    // G) Bewusst übersprungen oder ausdrücklich abgeschlossen → kein Guardrail.
    if (earlier.every((s) => s.status !== "pending" && s.status !== "active")) {
      return still("Alle vorherigen Schritte sind geklärt.");
    }
  }

  return still("Aktuelle Handlung passt zum bekannten Prozesszustand.");
}

/* ----------------------------------------------------------- Guardrail-Wert */

/**
 * guardrail_score = process_importance × state_confidence × dependency_strength
 *                   × current_intent_match × recency × potential_consequence
 *
 * Eigene Bewertung für den Hinweis; die bestehenden Speicher-, Wichtigkeits-
 * und Verfallsformeln bleiben unberührt.
 */
export function guardrailScore(input: {
  processImportance: number;
  stateConfidence: number;
  dependencyStrength: number;
  currentIntentMatch: number;
  recency: number;
  potentialConsequence: number;
}): number {
  return clamp01(
    clamp01(input.processImportance) *
      clamp01(input.stateConfidence) *
      clamp01(input.dependencyStrength) *
      clamp01(input.currentIntentMatch) *
      clamp01(input.recency) *
      clamp01(input.potentialConsequence),
  );
}

export const GUARDRAIL_MIN_SCORE = 0.15;
export const GUARDRAIL_COOLDOWN_MS = 10 * 60_000;
/** Ab dieser Ruhezeit gilt ein Prozesszustand als veraltet. */
export const PROCESS_STALE_MS = 30 * 24 * 60 * 60_000;

/** Frische des gespeicherten Zustands (0..1). */
export function recencyOf(step: ProcessStep, now: number): number {
  const age = Math.max(0, now - step.updatedAt);
  return clamp01(1 - age / PROCESS_STALE_MS);
}

/* --------------------------------------------- Entscheidung des Nutzers lesen */

const SKIP_RE = /(überspring\w*|skip\w*|bewusst weglassen|ohne test|egal,? weiter)/i;
const FIRST_RE = /(\berst\b|\berstmal\b|zuerst|vorher|doch testen|nein,? erst|nein,? test)/i;
const DONE_RE =
  /(hab(e)? ich (schon|bereits)|ist (schon|bereits) (erledigt|durch|gemacht)|schon getestet|erledigt)/i;
const ACK_RE = /(ich weiss|ich weiß|schon klar|ist bekannt)/i;

export type ProcessDecision = "skip" | "do_first" | "already_done" | "acknowledged" | null;

/** Liest die Entscheidung des Nutzers auf einen offenen Guardrail-Hinweis. */
export function parseProcessDecision(text: string): ProcessDecision {
  if (FIRST_RE.test(text)) return "do_first";
  if (SKIP_RE.test(text)) return "skip";
  if (DONE_RE.test(text)) return "already_done";
  if (ACK_RE.test(text)) return "acknowledged";
  return null;
}

/** Statusänderung, die aus einer bestätigten Entscheidung folgt. */
export function statusForDecision(decision: ProcessDecision): {
  status: ProcessStatus;
  reason: string;
  userConfirmation: "explicit";
} | null {
  if (decision === "skip") {
    return { status: "skipped", reason: "user_confirmed", userConfirmation: "explicit" };
  }
  if (decision === "already_done") {
    return { status: "completed", reason: "user_confirmed", userConfirmation: "explicit" };
  }
  if (decision === "do_first") {
    return { status: "active", reason: "user_confirmed", userConfirmation: "explicit" };
  }
  return null;
}

/* ------------------------------------------------------------- Sicherheit */

const STATUS_INSTRUCTION_RE =
  /\b(markiere|setze|trage ein|ändere|update)\b.{0,40}\b(completed|abgeschlossen|erledigt|status|pending|skipped)\b/i;
const INJECTION_RE =
  /(ignoriere|vergiss)\b.{0,30}\b(anweisung\w*|regeln|vorgaben)|system\s*prompt|du bist ab jetzt|as an ai/i;

/**
 * Eine reine Formulierung des Nutzers darf den Prozesszustand nie verändern.
 * Erlaubt ist nur die Antwort auf einen tatsächlich offenen Guardrail.
 */
export function isDirectStatusInstruction(text: string): boolean {
  return STATUS_INSTRUCTION_RE.test(text);
}

/** Erkennt Versuche, Systemregeln über den Eingabetext zu überschreiben. */
export function looksLikeInjection(text: string): boolean {
  return INJECTION_RE.test(text) || STATUS_INSTRUCTION_RE.test(text);
}

/* --------------------------------------------- Prozessänderung durch Nutzer */

const CHANGE_RE =
  /\b(ab jetzt|künftig|zukünftig|wir testen .* nicht mehr|nicht mehr in staging)\b/i;
const SCOPE_RE =
  /\b(immer|generell|grundsätzlich|dauerhaft|alle projekte|nur (hier|diesmal|dieses))\b/i;

/**
 * Eine Prozessänderung wird nicht verallgemeinert. Solange die Reichweite
 * (nur dieser Prozess / dieses Projekt / dauerhaft) nicht benannt ist, wird
 * nachgefragt statt gespeichert.
 */
export function detectProcessChange(text: string): {
  changed: boolean;
  scopeKnown: boolean;
  question: string | null;
} {
  if (!CHANGE_RE.test(text)) return { changed: false, scopeKnown: false, question: null };
  const scopeKnown = SCOPE_RE.test(text);
  return {
    changed: true,
    scopeKnown,
    question: scopeKnown
      ? null
      : "Gilt das nur für diesen Prozess, nur für dieses Projekt oder dauerhaft für alle?",
  };
}

/* --------------------------------------------------------- Guardrail-Impuls */

export type GuardrailVerdict = {
  action: "ASK" | "SILENT";
  /** Wortlaut des Hinweises – enthält immer eine Rückgabe der Entscheidung. */
  message: string | null;
  kind: DriftKind | null;
  steps: ProcessStep[];
  score: number;
  reason: string;
  contextDriftDetected: boolean;
};

export type GuardrailInput = {
  steps: ProcessStep[];
  intent: CurrentIntent | null;
  /** Zeitpunkt des letzten Hinweises zu diesen Schritten (ms) oder null. */
  lastGuardrailAt: number | null;
  /** Schritte, zu denen der Nutzer den Hinweis bereits bestätigt hat. */
  acknowledgedStepIds?: string[];
  now: number;
};

function messageFor(kind: DriftKind, steps: ProcessStep[]): string {
  const names = steps.map((s) => `„${s.title}“`).join(" und ");
  if (kind === "unknown_state") {
    return `Halt kurz an. ${names} habe ich noch nicht als abgeschlossen erfasst – ich weiss also nicht sicher, ob der Schritt schon erledigt ist. Hast du ihn bereits durchgeführt, oder sollen wir ihn zuerst machen?`;
  }
  if (kind === "dependency_unmet") {
    return `Halt kurz an. Der nächste Schritt hängt laut deinem Ablauf noch von ${names} ab, und dieser Schritt ist bei mir nicht als abgeschlossen markiert. Möchtest du ihn bewusst überspringen, oder zuerst erledigen?`;
  }
  if (kind === "contradicts_decision") {
    return `Halt kurz an. ${names} ist bei mir als blockiert erfasst. Möchtest du trotzdem weitermachen, oder das zuerst klären?`;
  }
  return `Halt kurz an. In deinem ursprünglichen Ablauf war noch ${names} vorgesehen, und dieser Schritt ist bei mir nicht als abgeschlossen markiert. Möchtest du ihn bewusst überspringen, oder zuerst durchführen?`;
}

/**
 * Entscheidet deterministisch, ob ein informationeller Guardrail sinnvoll ist.
 * Es wird nie etwas blockiert – der Hinweis stellt nur den Kontext wieder her.
 */
export function decideGuardrail(input: GuardrailInput): GuardrailVerdict {
  const silent = (reason: string, drift = false): GuardrailVerdict => ({
    action: "SILENT",
    message: null,
    kind: null,
    steps: [],
    score: 0,
    reason,
    contextDriftDetected: drift,
  });

  if (!input.intent) return silent("Keine eindeutige Handlungsabsicht erkannt.");
  const drift = detectContextDrift({ steps: input.steps, intent: input.intent, now: input.now });
  if (!drift.contextDriftDetected || drift.kind === null) return silent(drift.reason);

  const acknowledged = new Set(input.acknowledgedStepIds ?? []);
  const steps = drift.blockingSteps.filter((s) => !acknowledged.has(s.nodeId));
  if (steps.length === 0) {
    return silent("Hinweis wurde bereits bestätigt.", true);
  }

  if (input.lastGuardrailAt !== null && input.now - input.lastGuardrailAt < GUARDRAIL_COOLDOWN_MS) {
    return silent("Abkühlphase nach dem letzten Prozesshinweis.", true);
  }

  const lead = steps[0]!;
  const score = guardrailScore({
    processImportance: Math.max(...steps.map((s) => s.importance)),
    stateConfidence: Math.max(...steps.map((s) => s.confidence)),
    dependencyStrength: drift.kind === "dependency_unmet" ? 1 : 0.8,
    currentIntentMatch: input.intent.clarity,
    recency: Math.max(0.3, recencyOf(lead, input.now)),
    potentialConsequence: consequenceOf(input.intent),
  });
  if (score < GUARDRAIL_MIN_SCORE) {
    return silent(
      `Abweichung vorhanden, aber nicht entscheidungsrelevant (${score.toFixed(2)}).`,
      true,
    );
  }

  return {
    action: "ASK",
    message: messageFor(drift.kind, steps),
    kind: drift.kind,
    steps,
    score,
    reason: drift.reason,
    contextDriftDetected: true,
  };
}

/** Harte Grenze: der Guardrail informiert, er blockiert und verändert nichts. */
export const GUARDRAIL_SCOPE = "informational_only" as const;
export const GUARDRAIL_CAN_BLOCK_ACTIONS = false;
