import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { knowledgeGraphQueryKey, openTabSignal, wrapTabSignal } from "@/lib/orb-knowledge-graph/tab-signal";
import { orbDataScopeSchema } from "@/orb-core/scope-values";

const fn = readFileSync("src/lib/orb-knowledge-graph.functions.ts", "utf8");
const stage = readFileSync("src/components/orb-knowledge-graph/KnowledgeGraphStage.tsx", "utf8");
const chat = readFileSync("src/routes/_authenticated/channels.orb.$scope.tsx", "utf8");
const root = readFileSync("src/routes/__root.tsx", "utf8");

describe("P1 Scope-Filter", () => {
  it("Scope ist Pflicht und validiert, unassigned getrennt zulässig", () => {
    expect(() => orbDataScopeSchema.parse(undefined)).toThrow();
    expect(() => orbDataScopeSchema.parse("all")).toThrow();
    for (const s of ["normal", "orb_core", "y_dude", "unassigned"]) expect(orbDataScopeSchema.parse(s)).toBe(s);
    expect(fn).toContain("z.object({ scope: orbDataScopeSchema })");
  });
  it("vier bereichsfähige Abfragen filtern Nutzer UND Bereich; Admin bleibt Pflicht", () => {
    expect(fn.match(/\.eq\("user_id", uid\)/g)).toHaveLength(5);
    expect(fn.match(/\.eq\("scope", scope\)/g)).toHaveLength(4);
    expect(fn).toContain("await assertAdmin(context)");
    expect(fn).not.toMatch(/supabaseAdmin|client\.server/);
  });
});

describe("P2 Deterministische Auswahl", () => {
  it("jede begrenzte Liste endet mit id vor dem Limit; Limit unverändert", () => {
    for (const t of ["orb_nodes", "orb_connections", "orb_threads", "orb_messages"]) {
      const block = fn.slice(fn.indexOf(`.from("${t}")`), fn.indexOf(".limit(", fn.indexOf(`.from("${t}")`)));
      const orders = [...block.matchAll(/\.order\("([a-z_]+)"/g)].map((m) => m[1]);
      expect(orders.at(-1)).toBe("id");
    }
    expect(fn).toContain("KG_NODE_LIMIT = 400");
    expect(fn).toContain("KG_EDGE_LIMIT = 1500");
  });
  it("Kanten und Thread-Mitglieder nur zu geladenen Knoten", () => {
    expect(fn).toContain("loaded.has(c.source_node_id) && loaded.has(c.target_node_id)");
    expect(fn).toContain(".filter((id: string) => loaded.has(id))");
  });
});

describe("P3 Browser-Cache", () => {
  it("Query-Key trägt Nutzer und Bereich", () => {
    expect(knowledgeGraphQueryKey("u1", "normal")).toEqual(["orb-knowledge-graph", "u1", "normal"]);
    expect(knowledgeGraphQueryKey("u1", "normal")).not.toEqual(knowledgeGraphQueryKey("u2", "normal"));
    expect(knowledgeGraphQueryKey("u1", "normal")).not.toEqual(knowledgeGraphQueryKey("u1", "unassigned"));
    expect(stage).toContain("queryKey: graphKey");
    expect(stage).toContain("enabled: !!userId");
  });
  it("Logout/Kontowechsel leert den Cache; Darstellung wird verworfen", () => {
    expect(root).toContain("if (switched) queryClient.clear();");
    expect(root).toContain('event === "SIGNED_OUT" ||');
    expect(stage).toContain("engineRef.current?.setData([], [])");
  });
});

describe("P4 Tab-Signale", () => {
  const payload = { kind: "orb.retrieval" };
  it("nur passender Nutzer und Bereich", () => {
    const sig = wrapTabSignal("u1", "normal", payload);
    expect(openTabSignal(sig, "u1", "normal")).toBe(payload);
    expect(openTabSignal(sig, "u2", "normal")).toBeNull();
    expect(openTabSignal(sig, "u1", "orb_core")).toBeNull();
    expect(openTabSignal(sig, null, "normal")).toBeNull();
    expect(openTabSignal(payload, "u1", "normal")).toBeNull(); // unverpackte Altsignale
  });
  it("Hülle enthält nur Nutzer-ID, Bereich, Nutzlast", () => {
    expect(Object.keys(wrapTabSignal("u", "normal", 1)).sort()).toEqual(["kind", "payload", "scope", "userId"]);
    expect(chat.match(/postMessage\(wrapTabSignal\(/g)).toHaveLength(2);
    expect(chat).toContain("ch.postMessage(wrapTabSignal(userId, scope, view))");
    expect(chat).not.toMatch(/postMessage\((view|turn\.retrievalEvent)\)/);
  });
});
