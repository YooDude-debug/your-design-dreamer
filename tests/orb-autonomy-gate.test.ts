/**
 * Tests zur finalen autonomen Freigabe (TARGETED FIX 01, Teil A und C).
 *
 * Geprüft wird die reine Entscheidungslogik in `src/orb-core/autonomy.ts`
 * sowie die Vertragsbedingung, dass die Prüfung im Engine-Pfad VOR der
 * Formulierung und vor jeder Persistenz liegt.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { AUTONOMY_MIN_ENERGY, finalAutonomyGate } from "@/orb-core/autonomy";
import { CURIOSITY_MIN_ENERGY, type CuriosityDecision, type KnowledgeGap } from "@/orb-core/curiosity";
import type { ImpulseCandidate, ImpulseDecision } from "@/orb-core/impulse";
import {
  appendFilterEntry,
  PRESENCE_FILTER_LOG_MAX,
} from "@/integrations/y-dude-orb/use-orb-presence";

const gap: KnowledgeGap = {
  id: "n1:detail",
  nodeId: "n1",
  memory: "Ich war im Urlaub in Griechenland.",
  topic: "reisen",
  kind: "detail",
  gap: "ORB kennt die Aussage nur allgemein.",
  importance: 0.7,
  confidence: 0.8,
  interestWeight: 0.6,
  relevance: 0.7,
  novelty: 1,
  conversationalFit: 1,
  score: 0.42,
  reason: "Detail offen.",
};

function curiosity(action: CuriosityDecision["action"], reason: string): CuriosityDecision {
  return { action, reason, score: gap.score, band: "hoch", gap: action === "ASK" ? gap : null };
}

const candidate: ImpulseCandidate = {
  gap: {
    id: "g1",
    type: "pending_decision",
    nodeIds: ["n1"],
    relatedNodes: ["n1"],
    topic: "reisen",
    reason: "Offene Entscheidung.",
    suggestedQuestion: "Hast du dich entschieden?",
    importance: 0.8,
    confidence: 0.8,
    futureRelevance: 0.8,
    expiresAt: Date.now() + 10_000,
    form: "question",
  } as unknown as ImpulseCandidate["gap"],
  priority: "P1",
  score: 0.5,
  reason: "Offene Entscheidung, Priorität P1.",
};

function impulse(action: ImpulseDecision["action"], suppressed = false): ImpulseDecision {
  return {
    action,
    impulse: action === "SPEAK" ? candidate : null,
    reason: action === "SPEAK" ? candidate.reason : "Keine Lücke mit Mehrwert.",
    candidates: action === "SPEAK" ? [candidate] : [],
    rememberPreference: null,
    suppressed,
  };
}

describe("Energie ist eine gemeinsame Ressource", () => {
  it("verwendet die bestehende Schwelle, keine neue", () => {
    expect(AUTONOMY_MIN_ENERGY).toBe(CURIOSITY_MIN_ENERGY);
    expect(AUTONOMY_MIN_ENERGY).toBe(0.15);
  });

  it("A1: Curiosity WAIT wegen Energie + Impulse SPEAK → FINAL WAIT", () => {
    const d = finalAutonomyGate({
      energy: 0.0895,
      curiosity: curiosity("WAIT", "Zu wenig Energie – ORB wartet."),
      impulse: impulse("SPEAK"),
    });
    expect(d.allowed).toBe(false);
    expect(d.gate).toBe("energy");
    expect(d.action).toBe("WAIT");
    expect(d.source).toBeNull();
    expect(d.reason).toContain("Energie");
  });

  it("A1b: Energie 0 + Impulse SPEAK → FINAL WAIT", () => {
    const d = finalAutonomyGate({
      energy: 0,
      curiosity: curiosity("WAIT", "Zu wenig Energie – ORB wartet."),
      impulse: impulse("SPEAK"),
    });
    expect(d.allowed).toBe(false);
    expect(d.gate).toBe("energy");
  });

  it("A2: Energie >= 0.15 + Impulse SPEAK → Impulse darf sprechen", () => {
    const d = finalAutonomyGate({
      energy: 0.15,
      curiosity: curiosity("WAIT", "Cooldown aktiv."),
      impulse: impulse("SPEAK"),
    });
    expect(d.allowed).toBe(true);
    expect(d.gate).toBe("pass");
    expect(d.source).toBe("impulse");
    expect(d.action).toBe("ASK");
  });

  it("A3: Energie < 0.15 + Curiosity ASK + Impulse STAY_SILENT → WAIT", () => {
    const d = finalAutonomyGate({
      energy: 0.1,
      curiosity: curiosity("ASK", "Detail offen."),
      impulse: impulse("STAY_SILENT"),
    });
    expect(d.allowed).toBe(false);
    expect(d.gate).toBe("energy");
    expect(d.action).toBe("WAIT");
  });

  it("Curiosity ASK + Impulse STAY_SILENT mit Energie → Curiosity spricht", () => {
    const d = finalAutonomyGate({
      energy: 0.4,
      curiosity: curiosity("ASK", "Detail offen."),
      impulse: impulse("STAY_SILENT"),
    });
    expect(d.allowed).toBe(true);
    expect(d.source).toBe("curiosity");
  });

  it("Suppression gewinnt vor allem anderen", () => {
    const d = finalAutonomyGate({
      energy: 0.9,
      curiosity: curiosity("ASK", "Detail offen."),
      impulse: { ...impulse("SPEAK"), suppressed: true },
    });
    expect(d.allowed).toBe(false);
    expect(d.gate).toBe("suppressed");
  });

  it("kein Kandidat → bestehendes Verhalten (DO_NOTHING bleibt DO_NOTHING)", () => {
    const d = finalAutonomyGate({
      energy: 0.9,
      curiosity: curiosity("DO_NOTHING", "Keine offene Wissenslücke."),
      impulse: impulse("STAY_SILENT"),
    });
    expect(d.allowed).toBe(false);
    expect(d.gate).toBe("no_candidate");
    expect(d.action).toBe("DO_NOTHING");
  });

  it("offene Frage (Curiosity WAIT, Impulse still) bleibt WAIT ohne Energie-Grund", () => {
    const d = finalAutonomyGate({
      energy: 0.9,
      curiosity: curiosity("WAIT", "Eine eigene Frage ist noch offen – ORB wartet."),
      impulse: impulse("STAY_SILENT"),
    });
    expect(d.gate).toBe("no_candidate");
    expect(d.action).toBe("WAIT");
  });
});

describe("A4: eine nicht gestellte Frage kostet nichts", () => {
  const source = readFileSync("src/orb-core/engine.server.ts", "utf8");
  const gateAt = source.indexOf("finalAutonomyGate({");
  const formulateAt = source.indexOf("await formulateQuestion(ctx, gap, impulse)");
  const questionInsertAt = source.indexOf('.from("orb_questions")\n      .insert(');
  const stateUpdateAt = source.indexOf('.from("orb_state")\n      .update({\n        curiosity:');

  it("die Freigabe liegt vor Formulierung und Persistenz", () => {
    expect(gateAt).toBeGreaterThan(0);
    expect(formulateAt).toBeGreaterThan(gateAt);
    expect(questionInsertAt).toBeGreaterThan(gateAt);
    expect(stateUpdateAt).toBeGreaterThan(gateAt);
  });

  it("der Energie- und Neugierabzug steht nur im Erfolgspfad", () => {
    const deductions = source.match(/energy: Math\.max\(0, ctx\.state\.energy - 0\.03\)/g) ?? [];
    expect(deductions).toHaveLength(1);
    expect(stateUpdateAt).toBeGreaterThan(formulateAt);
  });
});

describe("C: Nachvollziehbarkeit der Versuche", () => {
  const source = readFileSync("src/orb-core/engine.server.ts", "utf8");

  it("jeder Versuch – auch die Ablehnung – erzeugt einen Attempt-Datensatz", () => {
    expect(source).toContain("attempt: OrbAutonomyAttempt | null");
    expect(source).toContain('result: "silent"');
    expect(source).toContain('result: "asked"');
    expect(source).toContain('gate: "formulation"');
    expect(source).toContain('gate: "duplicate"');
    expect(source).toContain("[orb.autonomy]");
  });

  it("die Ablehnung schreibt keine Question, Message, State oder Metric", () => {
    const silentBlock = source.slice(
      source.indexOf("const silent = ("),
      source.indexOf("if (!gateDecision.allowed) return silent"),
    );
    for (const table of ["orb_questions", "orb_messages", "orb_state", "orb_metrics"]) {
      expect(silentBlock).not.toContain(table);
    }
  });

  it("die Herkunft erfolgreicher Fragen bleibt im Message-Snapshot rekonstruierbar", () => {
    expect(source).toContain("impulse: impulse");
    expect(source).toContain("impulse_scope: IMPULSE_SCOPE");
  });

  it("Browser-Vorfilter: gleicher Grund erzeugt keinen zweiten Eintrag", () => {
    let log = appendFilterEntry([], { at: 1, reason: "Noch zu aktiv.", idleMs: 1000 });
    log = appendFilterEntry(log, { at: 2, reason: "Noch zu aktiv.", idleMs: 2000 });
    expect(log).toHaveLength(1);
    log = appendFilterEntry(log, { at: 3, reason: "Cooldown aktiv.", idleMs: 3000 });
    expect(log).toHaveLength(2);
    expect(log[1]?.reason).toBe("Cooldown aktiv.");
  });

  it("Browser-Vorfilter: der Verlauf bleibt begrenzt", () => {
    let log: ReturnType<typeof appendFilterEntry> = [];
    for (let i = 0; i < PRESENCE_FILTER_LOG_MAX + 10; i += 1) {
      log = appendFilterEntry(log, { at: i, reason: `Grund ${i}`, idleMs: i });
    }
    expect(log).toHaveLength(PRESENCE_FILTER_LOG_MAX);
  });
});
