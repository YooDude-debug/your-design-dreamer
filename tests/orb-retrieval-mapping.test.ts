import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { retrievalPulseIndices } from "@/lib/orb-knowledge-graph/graph-engine";

const engineSrc = readFileSync("src/lib/orb-knowledge-graph/graph-engine.ts", "utf8");
const stageSrc = readFileSync("src/components/orb-knowledge-graph/KnowledgeGraphStage.tsx", "utf8");

const index = new Map([
  ["A", 0],
  ["B", 1],
  ["C", 2],
  ["D", 3],
]);

describe("Retrieval-Puls → einzelne Memory-Nodes", () => {
  it("A) Event [A,B,C] → genau A,B,C pulsieren, andere nicht", () => {
    const idx = retrievalPulseIndices(["A", "B", "C"], index);
    expect(idx.sort()).toEqual([0, 1, 2]);
    expect(idx).not.toContain(3); // D bleibt ohne Puls
  });

  it("B) model_visible_ids [A,C] reduziert die Recall-Zuordnung nicht", () => {
    // Der Puls richtet sich ausschliesslich nach memory_ids.
    expect(retrievalPulseIndices(["A", "B", "C"], index)).toHaveLength(3);
    // model_visible_ids wird nur vorgehalten, nicht zur Auswahl benutzt.
    expect(engineSrc).toContain("this.lastModelVisibleIds = modelVisibleIds;");
    expect(engineSrc).toContain("retrievalPulseIndices(memoryIds, this.index)");
    expect(engineSrc).not.toContain("retrievalPulseIndices(modelVisibleIds");
  });

  it("C) unbekannte ID → kein Fehler, kein künstlicher Node", () => {
    expect(retrievalPulseIndices(["A", "UNKNOWN"], index)).toEqual([0]);
    expect(retrievalPulseIndices(["UNKNOWN"], index)).toEqual([]);
  });

  it("D) leeres memory_ids → kein Retrieval-Puls", () => {
    expect(retrievalPulseIndices([], index)).toEqual([]);
  });

  it("E) Suche/gelber Pfad erzeugt keinen roten Retrieval-Puls", () => {
    // playPath/setFocus berühren retrievalPulse nicht.
    const playPath = engineSrc.slice(
      engineSrc.indexOf("playPath("),
      engineSrc.indexOf("select(id"),
    );
    expect(playPath).not.toContain("retrievalPulse");
    const setFocus = engineSrc.slice(
      engineSrc.indexOf("setFocus("),
      engineSrc.indexOf("playPath("),
    );
    expect(setFocus).not.toContain("retrievalPulse");
  });

  it("F) grüne gespeicherte Änderung bleibt unverändert (pulseNodes ohne Retrieval)", () => {
    const pulseNodes = engineSrc.slice(
      engineSrc.indexOf("pulseNodes(ids"),
      engineSrc.indexOf("pulseRetrieval("),
    );
    expect(pulseNodes).not.toContain("retrievalPulse");
    expect(engineSrc).toContain("PULSE_COLOR");
  });

  it("G) autonome Wissenslücke erzeugt weiterhin kein Retrieval-Event", () => {
    // pulseRetrieval wird nur hinter isRetrievalEvent aufgerufen; das Event
    // entsteht ausschliesslich in processInput (siehe orb-retrieval-event.test.ts).
    const i = stageSrc.indexOf("pulseRetrieval(");
    expect(stageSrc.slice(i - 400, i)).toContain("isRetrievalEvent(ev)");
  });

  it("H) Stage übergibt memory_ids und model_visible_ids des Events", () => {
    expect(stageSrc).toContain("pulseRetrieval(ev.memory_ids, ev.model_visible_ids)");
    // Kein globaler Puls mehr: Kanten bekommen keine Retrieval-Färbung.
    expect(engineSrc).not.toContain("this.retrievalPulse *= k;");
    const edgeLoop = engineSrc.slice(engineSrc.indexOf("const col = this.lines.geometry"));
    expect(edgeLoop).not.toContain("RETRIEVAL_COLOR");
  });
});
