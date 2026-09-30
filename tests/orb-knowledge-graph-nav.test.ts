import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const orb = readFileSync("src/routes/_authenticated/channels.orb.$scope.tsx", "utf8");
const kg = readFileSync("src/routes/_authenticated/orb.knowledge-graph.tsx", "utf8");

describe("ORB ↔ Wissensgraph Navigation", () => {
  it("Wissensgraph-Button nur für Admins, über Router-Link", () => {
    const i = orb.indexOf('to="/orb/knowledge-graph"');
    expect(i).toBeGreaterThan(0);
    expect(orb.slice(i - 80, i)).toMatch(/\{isAdmin && \(\s*<Link/);
    expect(orb).toContain("Wissensgraph");
  });
  it("Zurück zu ORB: Browser-Back, sonst /channels/orb; Admin-Sperre bleibt", () => {
    expect(kg).toContain('goBackOr(router, "/channels/orb")');
    expect(kg).toContain('label="Zurück zu ORB"');
    expect(kg).toContain("access.data?.isAdmin ?");
  });
});
