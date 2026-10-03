/** Live Memory Activation: nur echte Ereignisse, nacheinander, ohne Kanten. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildQuestionActivationEvent,
  buildRetrievalEvent,
  enqueueActivation,
  isRetrievalEvent,
  RETRIEVAL_QUEUE_MAX,
} from "@/orb-core/retrieval-event";
import { openTabSignal, wrapTabSignal } from "@/lib/orb-knowledge-graph/tab-signal";

const engineSrc = readFileSync("src/lib/orb-knowledge-graph/graph-engine.ts", "utf8");
const engine = readFileSync("src/orb-core/engine.server.ts", "utf8");
const route = readFileSync("src/routes/_authenticated/channels.orb.$scope.tsx", "utf8");

describe("Live Memory Activation", () => {
  it("Antwort-Recall → Event mit Typ reply und genau den abgerufenen IDs", () => {
    const e = buildRetrievalEvent({
      eventId: "e1",
      nowMs: 0,
      recalled: [{ id: "m1", level: "A", score: 0.7 }],
      modelVisibleIds: ["m1"],
      excludedFromActivation: [],
    })!;
    expect(e.activation).toBe("reply");
    expect(e.memory_ids).toEqual(["m1"]);
  });

  it("autonome Frage → nur die Quell-Memory, Typ autonomous_question", () => {
    const e = buildQuestionActivationEvent({ eventId: "e2", nowMs: 0, memoryId: "m9" })!;
    expect(isRetrievalEvent(e)).toBe(true);
    expect(e).toMatchObject({ activation: "autonomous_question", memory_ids: ["m9"] });
    expect(buildQuestionActivationEvent({ eventId: "e", nowMs: 0, memoryId: null })).toBeNull();
    expect(engine).toContain("memoryId: gap.nodeId");
  });

  it("keine Aktivierung ohne Runtime-Ereignis / ungültiger Typ", () => {
    expect(isRetrievalEvent(null)).toBe(false);
    const e = buildQuestionActivationEvent({ eventId: "e", nowMs: 0, memoryId: "m" })!;
    expect(isRetrievalEvent({ ...e, activation: "simulated" })).toBe(false);
  });

  it("mehrere Aktivierungen: nacheinander, zusammengefasst mit Herkunft, begrenzt", () => {
    let q = enqueueActivation([], ["a", "b"], "e1");
    q = enqueueActivation(q, ["b", "c"], "e2");
    expect(q).toEqual([
      { id: "a", events: ["e1"] },
      { id: "b", events: ["e1", "e2"] },
      { id: "c", events: ["e2"] },
    ]);
    const many = enqueueActivation(
      [],
      Array.from({ length: 40 }, (_, i) => `n${i}`),
      "e",
    );
    expect(many).toHaveLength(RETRIEVAL_QUEUE_MAX);
  });

  it("nur nachgewiesene Verbindungen: Laufzeitpfad meldet keine ⇒ keine Kantenanimation", () => {
    const edgeLoop = engineSrc.slice(engineSrc.indexOf("const col = this.lines.geometry"));
    expect(edgeLoop).not.toContain("RETRIEVAL_COLOR");
    expect(engineSrc).toMatch(/queueRetrieval[\s\S]*index\.has\(id\)/);
  });

  it("kein eigener Timer, kein Kamera-/Zoom-Eingriff", () => {
    const i = engineSrc.indexOf("queueRetrieval(memoryIds");
    const body = engineSrc.slice(i, engineSrc.indexOf("pulseEdges(ids"));
    expect(body).not.toMatch(/setTimeout|setInterval|distance|userZoomed|camera/);
  });

  it("Benutzer- und Bereichstrennung der Signale", () => {
    const e = buildQuestionActivationEvent({ eventId: "e", nowMs: 0, memoryId: "m" })!;
    const msg = wrapTabSignal("u1", "normal", e);
    expect(openTabSignal(msg, "u1", "normal")).toEqual(e);
    expect(openTabSignal(msg, "u2", "normal")).toBeNull();
    expect(openTabSignal(msg, "u1", "y_dude")).toBeNull();
    expect(route).toContain("wrapTabSignal(userId, scope, result.activationEvent)");
  });
});
