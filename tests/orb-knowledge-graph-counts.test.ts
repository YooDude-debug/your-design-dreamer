import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { countLabel, TOTAL_NA } from "@/lib/orb-knowledge-graph/counts";
import { MAX_PATH_NODES } from "@/lib/orb-knowledge-graph/search";

const fn = readFileSync("src/lib/orb-knowledge-graph.functions.ts", "utf8");
const stage = readFileSync("src/components/orb-knowledge-graph/KnowledgeGraphStage.tsx", "utf8");

describe("Knowledge Graph – echter Memory-Count", () => {
  it("1–3. Gesamt und sichtbar getrennt, Gesamt ≠ Grenze", () => {
    expect(countLabel(336, 40)).toBe("336 gesamt · 40 sichtbar");
    expect(countLabel(337, 337)).toBe("337 gesamt · 337 sichtbar");
    expect(countLabel(336, MAX_PATH_NODES)).not.toContain(`${MAX_PATH_NODES} gesamt`);
  });
  it("4. Gesamtzahl kommt aus dem DB-Count derselben Abfrage", () => {
    expect(fn.match(/\{ count: "exact" \}/g)).toHaveLength(2);
    expect(fn).toContain('nodesTotal: typeof nodesRes.count === "number" ? nodesRes.count : null');
    expect(stage).toContain("countLabel(graph.nodesTotal, graph.nodes.length)");
    expect(stage).not.toMatch(/nodesTotal\s*=|nodesTotal \?\? graph\.nodes\.length/);
  });
  it("5. keine zusätzliche Polling-Schleife", () => {
    expect(stage.match(/refetchInterval:/g)).toHaveLength(1);
    expect(stage.match(/useQuery\(/g)).toHaveLength(1);
    expect(stage).not.toContain("setInterval");
  });
  it("6. keine Schreiboperation", () => {
    expect(fn).not.toMatch(/\.(insert|update|upsert|delete|rpc)\(/);
  });
  it("7. fehlender Count → nichts erfunden", () => {
    expect(countLabel(null, 40)).toBe(`${TOTAL_NA} · 40 sichtbar`);
    expect(countLabel(undefined, 0)).toContain(TOTAL_NA);
  });
});
