import { describe, expect, it } from "vitest";
import { decideConversationMode, type ConversationStrand } from "@/orb-core/conversation";
import { filterDirectAnswerMemories } from "@/orb-core/prompt-memory-filter";
import { traceMemoryUsage } from "@/orb-core/memory-usage";

/** Nachbildung der Engine-Verdrahtung (engine.server.ts, P5-A). */
function pipeline(
  text: string,
  strands: ConversationStrand[],
  opts: Partial<{ curiosity: number; energy: number; context: number }> = {},
) {
  const plan = decideConversationMode({
    text,
    conversationTopics: [],
    strands,
    curiosity: opts.curiosity ?? 0.8,
    energy: opts.energy ?? 0.5,
    contextMessages: opts.context ?? 0,
    resumeThread: null,
    impulseAllowed: false,
    explicitLearning: false,
  });
  const directItems = filterDirectAnswerMemories(
    text,
    strands.map((s) => ({ id: s.id!, content: s.content, topic: s.topic })),
  );
  const promptMemories =
    plan.mode === "DIRECT_ANSWER" ? directItems.map((m) => m.content) : plan.relevantStrands;
  const refs = plan.mode === "DIRECT_ANSWER" ? directItems : plan.relevantStrandRefs;
  const usage = traceMemoryUsage(
    strands.map((s) => s.id!),
    refs,
    true,
  );
  return { plan, promptMemories, refs, usage };
}

const gpu: ConversationStrand = {
  id: "n-gpu",
  content: "Ich habe eine RTX 5070 Grafikkarte",
  topic: "gaming",
  relevance: 0.5,
  confidence: 0.9,
};
const food: ConversationStrand = {
  id: "n-food",
  content: "Ich esse gerne Brokkoli",
  topic: null,
  relevance: 0.3,
  confidence: 0.9,
};

describe("P5-A Memory-ID-Tracking", () => {
  it("1. recalled und model-visible → ID in beiden Mengen", () => {
    const r = pipeline("Welche Grafikkarte habe ich?", [gpu]);
    expect(r.plan.mode).toBe("DIRECT_ANSWER");
    expect(r.usage.modelVisibleMemoryIds).toEqual(["n-gpu"]);
    expect(r.usage.recalledButNotVisibleMemoryIds).toEqual([]);
  });

  it("2. recalled, von P2 V2 entfernt → ID nur in recalled", () => {
    const r = pipeline("Welche Grafikkarte habe ich?", [gpu, food]);
    expect(r.promptMemories).toEqual([gpu.content]);
    expect(r.usage.recalledMemoryCount).toBe(2);
    expect(r.usage.modelVisibleMemoryIds).toEqual(["n-gpu"]);
    expect(r.usage.recalledButNotVisibleMemoryIds).toEqual(["n-food"]);
  });

  it("3. mehrere Memories → jede ID bleibt ihrem Inhalt zugeordnet", () => {
    const a = { ...gpu, id: "a" };
    const b = { ...gpu, id: "b", content: "Meine Grafikkarte ist neu" };
    const r = pipeline("Welche Grafikkarte habe ich?", [a, b]);
    for (const ref of r.refs) {
      expect(ref.content).toBe(ref.id === "a" ? a.content : b.content);
    }
    expect(r.refs.map((x) => x.content)).toEqual(r.promptMemories);
  });

  it("4. identischer Text → IDs bleiben unterscheidbar", () => {
    const x = { ...gpu, id: "x" };
    const y = { ...gpu, id: "y" };
    const r = pipeline("Welche Grafikkarte habe ich?", [x, y]);
    expect(r.usage.modelVisibleMemoryIds).toEqual(["x", "y"]);
  });

  it("5. FOLLOW_UP → IDs der tatsächlich verwendeten Stränge", () => {
    const r = pipeline("Ich habe heute an meiner Grafikkarte geschraubt", [gpu, food]);
    expect(r.plan.mode).toBe("FOLLOW_UP");
    expect(r.refs.map((x) => x.content)).toEqual(r.plan.relevantStrands);
    expect(r.usage.modelVisibleMemoryIds).toEqual(r.plan.relevantStrandRefs.map((x) => x.id));
    expect(
      new Set([...r.usage.modelVisibleMemoryIds, ...r.usage.recalledButNotVisibleMemoryIds]),
    ).toEqual(new Set(["n-gpu", "n-food"]));
  });

  it("6. LISTEN / keine Memory → keine falschen IDs", () => {
    const listen = pipeline("ok", [gpu], { curiosity: 0, energy: 0 });
    expect(listen.plan.mode).toBe("LISTEN");
    expect(listen.plan.relevantStrandRefs).toEqual([]);
    expect(listen.usage.modelVisibleMemoryIds).toEqual([]);
    expect(listen.usage.recalledButNotVisibleMemoryIds).toEqual(["n-gpu"]);
    const empty = pipeline("Wie spät ist es?", []);
    expect(empty.usage).toEqual({
      recalledMemoryCount: 0,
      modelVisibleMemoryCount: 0,
      modelVisibleMemoryIds: [],
      recalledButNotVisibleMemoryIds: [],
    });
  });

  it("6b. ohne Modellaufruf → nichts gilt als model-visible", () => {
    const u = traceMemoryUsage(["a"], [{ id: "a" }], false);
    expect(u.modelVisibleMemoryIds).toEqual([]);
    expect(u.recalledButNotVisibleMemoryIds).toEqual(["a"]);
  });

  it("7. direkte Antwort → P2-V2-Auswahl identisch mit und ohne ID", () => {
    const text = "Welche Grafikkarte habe ich?";
    const without = filterDirectAnswerMemories(
      text,
      [gpu, food].map((s) => ({ content: s.content, topic: s.topic })),
    );
    const withId = filterDirectAnswerMemories(
      text,
      [gpu, food].map((s) => ({ id: s.id, content: s.content, topic: s.topic })),
    );
    expect(withId.map((m) => m.content)).toEqual(without.map((m) => m.content));
  });

  it("Regression: Antwortart und Prompt-Liste unverändert, ob ID vorhanden oder nicht", () => {
    for (const text of [
      "Welche Grafikkarte habe ich?",
      "Ich habe heute an meiner Grafikkarte geschraubt",
      "ok",
    ]) {
      const base = {
        text,
        conversationTopics: [],
        curiosity: 0.8,
        energy: 0.5,
        contextMessages: 3,
        resumeThread: null,
        impulseAllowed: false,
        explicitLearning: false,
      };
      const a = decideConversationMode({ ...base, strands: [gpu, food] });
      const b = decideConversationMode({
        ...base,
        strands: [gpu, food].map(({ id: _id, ...s }) => s),
      });
      expect(a.mode).toBe(b.mode);
      expect(a.reason).toBe(b.reason);
      expect(a.relevantStrands).toEqual(b.relevantStrands);
      expect(a.focusTopic).toBe(b.focusTopic);
      expect(b.relevantStrandRefs.every((r) => r.id === null)).toBe(true);
    }
  });
});
