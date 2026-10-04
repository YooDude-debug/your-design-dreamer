// P1–P4 der Vier-Incident-Freigabe (03.10.2026).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { getSnapshot } from "@/orb-core/engine.server";
import { isAuthReadError, ORB_REAUTH_REQUIRED } from "@/orb-core/internal-error";
import { createFakeDb, type FakeCall, type FakeResponse } from "./helpers/fake-supabase";

const USER = "11111111-1111-4111-8111-111111111111";
const NOW = new Date().toISOString();
const stateRow = {
  id: "s1",
  user_id: USER,
  curiosity: 0.5,
  joy: 0.5,
  fear: 0.1,
  trust: 0.4,
  uncertainty: 0.3,
  energy: 0.9,
  cracks: 0,
  reactivation_count: 0,
  decay_computations: 0,
  goals: ["help_user"],
  created_at: NOW,
  updated_at: NOW,
};

function snapDb(fail: Record<string, { code: string; message: string }>) {
  return createFakeDb((call: FakeCall): FakeResponse => {
    if (call.table === "orb_state") return { data: stateRow };
    const err = fail[call.table];
    if (err && call.action === "select") return { data: null, error: err } as FakeResponse;
    if (call.action === "select")
      return { data: call.single ? null : [], count: 0 } as FakeResponse;
    return { data: null };
  }, 30000);
}

describe("P2 – Fehlerisolierung der ORB-Übersicht", () => {
  it("optionaler Teil fällt aus → Übersicht bleibt, Teil als unavailable markiert", async () => {
    const snap = await getSnapshot(
      snapDb({ orb_interests: { code: "XX000", message: "boom" } }),
      USER,
    );
    expect(snap.unavailable).toContain("orb_interests");
    expect(snap.interests).toEqual([]);
    expect(snap.nodes).toEqual([]);
  });
  it("Erinnerungen bleiben erforderlich (anderer DB-Fehler → kein Auth-Fehler)", async () => {
    const p = getSnapshot(snapDb({ orb_nodes: { code: "XX000", message: "boom" } }), USER);
    await expect(p).rejects.toThrow();
    await expect(p).rejects.not.toThrow(ORB_REAUTH_REQUIRED);
  });
  it("Faden-Lesefehler blockiert die Übersicht nicht (Block 2)", async () => {
    const snap = await getSnapshot(
      snapDb({ orb_threads: { code: "XX000", message: "boom" } }),
      USER,
    );
    expect(snap.unavailable).toContain("orb_threads");
    expect(snap.threads).toEqual([]);
  });
  it("Faden-Anmeldefehler → weiterhin klare Neuanmeldung, keine stille Leere", async () => {
    await expect(
      getSnapshot(
        snapDb({
          orb_threads: { code: "42501", message: "permission denied for table orb_threads" },
        }),
        USER,
      ),
    ).rejects.toThrow(ORB_REAUTH_REQUIRED);
  });
  it("Verbindungen bleiben erforderlich", async () => {
    await expect(
      getSnapshot(snapDb({ orb_connections: { code: "XX000", message: "boom" } }), USER),
    ).rejects.toThrow();
  });
  it("fehlende Anmeldung (anon, 42501 Tabellenrecht) → klare Neuanmeldung", async () => {
    await expect(
      getSnapshot(
        snapDb({ orb_nodes: { code: "42501", message: "permission denied for table orb_nodes" } }),
        USER,
      ),
    ).rejects.toThrow(ORB_REAUTH_REQUIRED);
  });
  it("Klassifizierung: nur echte Anmeldefehler", () => {
    expect(isAuthReadError({ code: "PGRST301", message: "JWT expired" })).toBe(true);
    expect(
      isAuthReadError({ code: "42501", message: "permission denied for table orb_threads" }),
    ).toBe(true);
    expect(
      isAuthReadError({ code: "42501", message: "new row violates row-level security policy" }),
    ).toBe(false);
    expect(isAuthReadError({ code: "57014", message: "timeout" })).toBe(false);
    expect(isAuthReadError(null)).toBe(false);
  });
});

describe("P1 – Altdaten-Ansicht ist nur lesend und bereichsgetrennt", () => {
  const src = readFileSync("src/lib/orb-unassigned.functions.ts", "utf8");
  it("keine Schreiboperation", () => {
    expect(src).not.toMatch(/\.(insert|update|upsert|delete|rpc)\(/);
  });
  it("filtert fest auf unassigned + eigenen Benutzer, nur Admins", () => {
    expect(src).toMatch(/UNASSIGNED_SCOPE = "unassigned"/);
    expect(src).toMatch(/\.eq\("scope", UNASSIGNED_SCOPE\)/);
    expect(src).toMatch(/\.eq\("user_id", context\.userId\)/);
    expect(src).toMatch(/assertAdmin\(context\)/);
  });
});

describe("P4 – Such-Highlight setzt manuellen Zoom nicht zurück", () => {
  const engine = readFileSync("src/lib/orb-knowledge-graph/graph-engine.ts", "utf8");
  const stage = readFileSync("src/components/orb-knowledge-graph/KnowledgeGraphStage.tsx", "utf8");
  const body = engine.slice(engine.indexOf("setFocus("), engine.indexOf("playPath("));
  it("setFocus setzt userZoomed nur bei ausdrücklicher Neuausrichtung mit Treffern zurück", () => {
    const guard = body.indexOf("if (!opts.reframe || !nodeIds || nodeIds.length === 0) return;");
    expect(guard).toBeGreaterThan(0);
    expect(body.indexOf("this.userZoomed = false")).toBeGreaterThan(guard);
  });
  it("Neuausrichtung nur bei neuer Suche oder Moduswechsel", () => {
    expect(stage).toMatch(/lastSearchKeyRef\.current !== key/);
    expect(stage).toMatch(/setFocus\(r\.nodeIds, r\.edgeIds, \{ reframe \}\)/);
  });
});
