// Präventive Ownership-Prüfung in closeOpenQuestion (kein Fix für 42501).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const src = readFileSync("src/orb-core/engine.server.ts", "utf8");
const start = src.indexOf("async function closeOpenQuestion(");
const body = src.slice(start, src.indexOf("export async function requestQuestion", start));

describe("closeOpenQuestion – Quell-Node-Ownership", () => {
  it("prüft Existenz + user_id der Quelle vor touchConnection", () => {
    const check = body.indexOf('.eq("id", candidateSourceId)');
    const touch = body.indexOf("touchConnection(");
    expect(check).toBeGreaterThan(0);
    expect(body).toMatch(/\.from\("orb_nodes"\)[\s\S]*\.eq\("user_id", userId\)/);
    expect(check).toBeLessThan(touch);
  });
  it("verbindet nur mit bestätigter Quelle", () => {
    expect(body).toMatch(/sourceId = \(owned\.data[^\n]*\?\? null/);
    expect(body).toMatch(/if \(sourceId && input\.answerNodeId\) \{\s*await touchConnection/);
  });
});
