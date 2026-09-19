import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const graph = readFileSync("src/components/orb/OrbGraph.tsx", "utf8");
const route = readFileSync("src/routes/_authenticated/channels.orb.tsx", "utf8");

describe("ORB Spiderweb Memory Graph UI", () => {
  it("zeigt vorhandene Nodes und Connections als Spiderweb", () => {
    expect(graph).toContain('data-testid="orb-spiderweb-graph"');
    expect(graph).toContain('data-testid="orb-memory-node"');
    expect(graph).toContain('data-testid="orb-memory-connection"');
    expect(graph).toContain("RINGS.map");
    expect(graph).toContain("SPOKES");
  });

  it("bildet vorhandenes Connection Weight nur visuell ab", () => {
    expect(graph).toContain("3.8 * connection.weight");
    expect(graph).toContain("data-weight={connection.weight}");
    expect(graph).toContain("connection.strong ? undefined");
  });

  it("zeigt gespeicherte Richtung und vorhandene Decay-Werte", () => {
    expect(graph).toContain("connection.sourceNodeId");
    expect(graph).toContain("connection.targetNodeId");
    expect(graph).toContain("markerEnd");
    expect(graph).toContain("connection.storedWeight");
    expect(graph).toContain("connection.decayRate");
  });

  it("unterstützt Auswahl, Nachbarschaft und reale Detailfelder", () => {
    expect(graph).toContain("setSelectedId");
    expect(graph).toContain("connectedNodeIds");
    expect(graph).toContain('data-testid="orb-memory-detail"');
    for (const field of [
      "importance",
      "confidence",
      "source",
      "topic",
      "activationCount",
      "lastAccessedAt",
      "createdAt",
    ]) {
      expect(graph).toContain(`selected.${field}`);
    }
  });

  it("erfindet keine fehlenden ORB-Metriken", () => {
    expect(graph).not.toMatch(/fakeScore|visualScore|generatedRelevance|stability|reinforcement/i);
    expect(graph).not.toContain("Date.now(");
    expect(graph).not.toContain("Math.exp(");
  });

  it("wahrt die UI → SDK → Core-Grenze", () => {
    expect(graph).toContain('from "@/orb-sdk"');
    expect(graph).not.toMatch(/from\s+["']@\/orb-core\//);
    expect(route).not.toMatch(/from\s+["']@\/orb-core\//);
  });

  it("bleibt in der bestehenden Memory-Karte eingebunden", () => {
    expect(route).toContain(
      "<OrbGraph nodes={snapshot.nodes} connections={snapshot.connections} />",
    );
  });
});
