import { describe, expect, it } from "vitest";
import { driftCheck, questionContextFor } from "@/orb-core/context-poc";
import type { ThoughtThread } from "@/orb-core/continuity";

const thread = (over: Partial<ThoughtThread> = {}): ThoughtThread => ({
  id: "t1",
  title: "ORB Kontext-Drift",
  topic: "programmierung",
  status: "ACTIVE",
  known: [],
  unknown: ["welcher Code gemeint ist"],
  curiosity: 0.5,
  importance: 0.5,
  lastActivationAt: 0,
  activationCount: 1,
  resolvedAt: null,
  nodeIds: ["n1"],
  ...over,
});

describe("PoC 1 – Kontext für autonome Fragen", () => {
  it("1: Gesprächsfenster chronologisch, max. 8", () => {
    const msgs = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 ? "orb" : "user",
      body: `Nachricht ${9 - i}`,
    }));
    const c = questionContextFor({
      recentMessages: msgs,
      threads: [],
      gap: { nodeId: null, topic: null },
    });
    expect(c.messages).toBe(8);
    expect(c.context!.startsWith("")).toBe(true);
    expect(c.context!.indexOf("Nachricht 2")).toBeLessThan(c.context!.indexOf("Nachricht 9"));
    expect(c.openThreads).toEqual([]);
  });
  it("2: passender offener Thread über nodeId oder Thema", () => {
    const byNode = questionContextFor({
      recentMessages: [],
      threads: [thread()],
      gap: { nodeId: "n1", topic: null },
    });
    expect(byNode.threadId).toBe("t1");
    expect(byNode.openThreads[0]!.unknown).toEqual(["welcher Code gemeint ist"]);
    const byTopic = questionContextFor({
      recentMessages: [],
      threads: [thread()],
      gap: { nodeId: "x", topic: "Programmierung" },
    });
    expect(byTopic.threadId).toBe("t1");
    const resolved = questionContextFor({
      recentMessages: [],
      threads: [thread({ status: "RESOLVED" })],
      gap: { nodeId: "n1", topic: null },
    });
    expect(resolved.threadId).toBeNull();
    expect(resolved.context).toBeNull();
  });
});

describe("PoC 2 – Drift-Check (nur Flags)", () => {
  it("3: normale Antwort ohne Drift", () => {
    const f = driftCheck({
      userText: "Was ist mein Lieblingsessen?",
      mode: "DIRECT_ANSWER",
      context: null,
      memories: ["Mein Lieblingsessen ist Pizza."],
      thread: null,
      contradictions: 0,
      reply: "Dein Lieblingsessen ist Pizza.",
    });
    expect(f.drift_detected).toBe(false);
    expect(f.relevant_context_referenced).toBe(true);
    expect(f.intent_preserved).toBe(true);
    expect(f.active_thread_preserved).toBeNull();
  });
  it("4: offensichtlicher Themenwechsel wird markiert", () => {
    const f = driftCheck({
      userText: "Welchen Code zur Kontext-Drift meinst du?",
      mode: "DIRECT_ANSWER",
      context: "Benutzer: ich arbeite an ORB",
      memories: ["Der Benutzer arbeitet als Koch."],
      thread: { title: "ORB Kontext-Drift", unknown: ["welcher Code"] },
      contradictions: 1,
      reply: "Heute scheint draussen wunderbar sonniges Wetter zum Wandern.",
    });
    expect(f.possible_topic_shift).toBe(true);
    expect(f.drift_detected).toBe(true);
    expect(f.relevant_context_referenced).toBe(false);
    expect(f.active_thread_preserved).toBe(false);
    expect(f.contradiction_detected).toBe(true);
    expect(f.drift_reason.length).toBeGreaterThan(0);
  });
  it("5: reine Funktion – Eingaben bleiben unverändert", () => {
    const memories = ["Mein Hund heisst Bello."];
    const t = thread();
    const snap = JSON.stringify({ memories, t });
    driftCheck({
      userText: "x",
      mode: "SMALLTALK",
      context: null,
      memories,
      thread: t,
      contradictions: 0,
      reply: "Bello",
    });
    questionContextFor({ recentMessages: [], threads: [t], gap: { nodeId: "n1", topic: null } });
    expect(JSON.stringify({ memories, t })).toBe(snap);
  });
});
