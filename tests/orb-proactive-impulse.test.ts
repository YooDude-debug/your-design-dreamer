/**
 * ORB Core – Proactive Intent & Gap Intelligence.
 *
 * Geprüft wird ausschliesslich die reine Logik: Lückenerkennung aus bereits
 * geladenen Knoten/Verbindungen und die deterministische Impulsentscheidung.
 * Keine Datenbank, keine KI, kein Netzwerk.
 */

import { describe, expect, it } from "vitest";

import { detectGaps, GAP_MIN_CONFIDENCE, type GapNode } from "@/orb-core/gaps";
import {
  GAP_PRIORITY,
  IMPULSE_MIN_SCORE,
  IMPULSE_SCOPE,
  IMPULSE_SOCIAL_ACTIONS_ENABLED,
  decideImpulse,
  impulseScore,
  isProactivePriority,
  readUserControl,
} from "@/orb-core/impulse";
import { PROACTIVE_COOLDOWN_MS } from "@/orb-core/presence";

const NOW = 1_800_000_000_000;

function node(partial: Partial<GapNode> & { id: string; content: string }): GapNode {
  return {
    topic: "allgemein",
    importance: 0.7,
    confidence: 0.8,
    activationCount: 1,
    lastAccessedAt: NOW - 60_000,
    ...partial,
  };
}

describe("Lückenerkennung", () => {
  it("erkennt ein Vorhaben ohne Ziel", () => {
    const gaps = detectGaps({
      nodes: [
        node({ id: "n1", content: "Ich baue ein Projekt für Bewerbungen", topic: "projekt" }),
      ],
      connections: [],
      now: NOW,
    });
    expect(gaps.some((g) => g.type === "incomplete_project")).toBe(true);
  });

  it("erkennt eine offene Entscheidung", () => {
    const gaps = detectGaps({
      nodes: [node({ id: "n1", content: "Ich überlege, ob ich die 5070 oder 5080 nehme" })],
      connections: [],
      now: NOW,
    });
    expect(gaps.some((g) => g.type === "pending_decision")).toBe(true);
  });

  it("erkennt eine unklare Vorliebe", () => {
    const gaps = detectGaps({
      nodes: [node({ id: "n1", content: "Ich mag Pizza, vielleicht auch Pasta" })],
      connections: [],
      now: NOW,
    });
    expect(gaps.some((g) => g.type === "ambiguous_preference")).toBe(true);
  });

  it("erkennt einen Widerspruch im gleichen Thema", () => {
    const gaps = detectGaps({
      nodes: [
        node({ id: "a", content: "Ich mag Pizza", topic: "essen" }),
        node({ id: "b", content: "Ich mag keine Pizza", topic: "essen" }),
      ],
      connections: [],
      now: NOW,
    });
    const found = gaps.find((g) => g.type === "contradiction");
    expect(found?.relatedNodes).toEqual(["a", "b"]);
  });

  it("erkennt eine mögliche Verbindung als Beobachtung", () => {
    const gaps = detectGaps({
      nodes: [
        node({ id: "a", content: "Rennspiele Grafik Einstellungen Monitor", topic: "spiele" }),
        node({
          id: "b",
          content: "Rennspiele Grafik Einstellungen Monitor Kabel",
          topic: "technik",
        }),
      ],
      connections: [],
      now: NOW,
    });
    const rel = gaps.find((g) => g.type === "potential_relationship");
    expect(rel?.form).toBe("observation");
  });

  it("erkennt veraltete kurzlebige Informationen", () => {
    const gaps = detectGaps({
      nodes: [
        node({
          id: "n1",
          content: "Diese Woche teste ich eine neue Tastatur",
          temporalScope: "temporary",
          lastAccessedAt: NOW - 90 * 24 * 60 * 60_000,
        }),
      ],
      connections: [],
      now: NOW,
    });
    expect(gaps.some((g) => g.type === "outdated_information")).toBe(true);
  });

  it("erkennt ein wiederkehrendes Thema", () => {
    const nodes = ["a", "b", "c"].map((id) =>
      node({ id, content: `Hardware Notiz ${id} zum Rechner`, topic: "hardware" }),
    );
    const gaps = detectGaps({ nodes, connections: [], now: NOW });
    expect(gaps.some((g) => g.type === "repeated_topic")).toBe(true);
  });

  it("ignoriert Knoten mit zu geringer Sicherheit", () => {
    const gaps = detectGaps({
      nodes: [
        node({ id: "n1", content: "Ich überlege etwas", confidence: GAP_MIN_CONFIDENCE - 0.1 }),
      ],
      connections: [],
      now: NOW,
    });
    expect(gaps).toHaveLength(0);
  });

  it("erzeugt keine Lücke für bereits verknüpfte wichtige Knoten", () => {
    const gaps = detectGaps({
      nodes: [
        node({ id: "a", content: "Ich arbeite als Mechaniker", importance: 0.8 }),
        node({ id: "b", content: "Meine Werkstatt liegt in der Nähe", importance: 0.7 }),
      ],
      connections: [{ sourceNodeId: "a", targetNodeId: "b", weight: 0.8 }],
      now: NOW,
    });
    expect(gaps.some((g) => g.type === "missing_information")).toBe(false);
  });

  it("nennt zu jeder Lücke Grund und auslösende Knoten", () => {
    const gaps = detectGaps({
      nodes: [node({ id: "n1", content: "Ich überlege, welchen Kurs ich starte" })],
      connections: [],
      now: NOW,
    });
    for (const gap of gaps) {
      expect(gap.reason.length).toBeGreaterThan(5);
      expect(gap.relatedNodes.length).toBeGreaterThan(0);
      expect(gap.expiresAt).toBeGreaterThan(NOW);
    }
  });

  it("gewichtet Lücken im laufenden Gesprächsthema höher", () => {
    const nodes = [node({ id: "n1", content: "Ich überlege, ob ich umziehe", topic: "wohnen" })];
    const inTopic = detectGaps({
      nodes,
      connections: [],
      conversationTopics: ["wohnen"],
      now: NOW,
    });
    const offTopic = detectGaps({
      nodes,
      connections: [],
      conversationTopics: ["essen"],
      now: NOW,
    });
    expect(inTopic[0]!.futureRelevance).toBeGreaterThan(offTopic[0]!.futureRelevance);
  });
});

describe("Impuls-Bewertung", () => {
  const gap = {
    id: "g1",
    type: "pending_decision" as const,
    importance: 0.9,
    confidence: 0.9,
    relatedNodes: ["n1"],
    reason: "Entscheidung offen.",
    suggestedQuestion: "Welche Angabe fehlt dir noch für die Entscheidung?",
    form: "question" as const,
    topic: "hardware",
    expiresAt: NOW + 60_000,
    futureRelevance: 0.9,
  };

  const base = {
    gaps: [gap],
    curiosity: 0.6,
    conversationTopics: ["hardware"],
    lastImpulseAt: null,
    now: NOW,
  };

  it("multipliziert alle fünf Faktoren", () => {
    expect(
      impulseScore({
        gapImportance: 0.5,
        confidence: 0.5,
        futureRelevance: 1,
        conversationalFit: 1,
        userBenefit: 1,
      }),
    ).toBeCloseTo(0.25);
  });

  it("spricht bei klarem Mehrwert", () => {
    const d = decideImpulse(base);
    expect(d.action).toBe("SPEAK");
    expect(d.impulse?.gap.id).toBe("g1");
  });

  it("bleibt unter der Mindestbewertung still", () => {
    const d = decideImpulse({
      ...base,
      gaps: [{ ...gap, importance: 0.2, confidence: 0.3, futureRelevance: 0.3 }],
    });
    expect(d.action).toBe("STAY_SILENT");
    expect(d.reason).toContain("gering");
    expect(IMPULSE_MIN_SCORE).toBe(0.2);
  });

  it("fragt nie bei Priorität P4", () => {
    expect(isProactivePriority("P4")).toBe(false);
    expect(Object.values(GAP_PRIORITY)).not.toContain("P4");
  });

  it("bevorzugt die höhere Priorität vor dem höheren Wert", () => {
    const low = { ...gap, id: "g2", type: "repeated_topic" as const };
    const d = decideImpulse({ ...base, gaps: [low, gap] });
    expect(d.impulse?.priority).toBe("P1");
  });

  it("achtet die Abkühlphase nach dem letzten Impuls", () => {
    const d = decideImpulse({ ...base, lastImpulseAt: NOW - 10_000 });
    expect(d.action).toBe("STAY_SILENT");
    expect(d.reason).toContain("Abkühlphase");
  });

  it("spricht nach abgelaufener Abkühlphase wieder", () => {
    const d = decideImpulse({
      ...base,
      lastImpulseAt: NOW - (Math.max(...Object.values(PROACTIVE_COOLDOWN_MS)) + 1_000),
    });
    expect(d.action).toBe("SPEAK");
  });

  it("bleibt bei offener eigener Frage still", () => {
    const d = decideImpulse({ ...base, openQuestion: true });
    expect(d.action).toBe("STAY_SILENT");
  });

  it("stellt keine bereits gestellte Frage erneut", () => {
    const d = decideImpulse({ ...base, previousImpulses: [gap.suggestedQuestion] });
    expect(d.action).toBe("STAY_SILENT");
    expect(d.candidates).toHaveLength(0);
  });

  it("fragt nicht nach bereits bekannten Informationen", () => {
    const d = decideImpulse({ ...base, knownAnswers: [gap.suggestedQuestion] });
    expect(d.candidates).toHaveLength(0);
  });

  it("überspringt abgelaufene Lücken", () => {
    const d = decideImpulse({ ...base, gaps: [{ ...gap, expiresAt: NOW - 1 }] });
    expect(d.candidates).toHaveLength(0);
  });

  it("schweigt, wenn der Nutzer abwinkt", () => {
    const d = decideImpulse({ ...base, recentUserTexts: ["Nicht jetzt, bitte später"] });
    expect(d.action).toBe("STAY_SILENT");
    expect(d.suppressed).toBe(true);
  });

  it("merkt eine dauerhafte Ablehnung", () => {
    const d = decideImpulse({ ...base, recentUserTexts: ["Frag mich das nie wieder"] });
    expect(d.rememberPreference).toBe("suppress");
  });

  it("achtet eine gespeicherte Ablehnung", () => {
    const d = decideImpulse({ ...base, storedPreference: "suppress" });
    expect(d.action).toBe("STAY_SILENT");
  });

  it("erkennt eine ausdrückliche Einladung", () => {
    expect(readUserControl(["Frag ruhig nach"]).preference).toBe("allow");
  });

  it("gibt bei fehlenden Lücken keinen Impuls", () => {
    const d = decideImpulse({ ...base, gaps: [] });
    expect(d.action).toBe("STAY_SILENT");
    expect(d.impulse).toBeNull();
  });

  it("wählt höchstens einen Impuls gleichzeitig", () => {
    const d = decideImpulse({
      ...base,
      gaps: [gap, { ...gap, id: "g3" }, { ...gap, id: "g4" }],
    });
    expect(d.impulse).not.toBeNull();
    expect(d.candidates.length).toBeGreaterThan(1);
  });

  it("entscheidet bei gleicher Eingabe immer gleich", () => {
    expect(decideImpulse(base)).toEqual(decideImpulse(base));
  });

  it("nennt für jeden Impuls einen nachvollziehbaren Grund", () => {
    const d = decideImpulse(base);
    expect(d.impulse?.reason).toContain("Priorität");
  });

  it("bleibt auf den ORB-Core-Chat begrenzt", () => {
    expect(IMPULSE_SCOPE).toBe("orb_core_chat_only");
    expect(IMPULSE_SOCIAL_ACTIONS_ENABLED).toBe(false);
  });
});
