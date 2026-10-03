/**
 * ORB Core – Causal Trace & Determinismus (isoliert, keine echte DB, kein Modell).
 */
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  NOT_AVAILABLE,
  buildAutonomyTrace,
  compareIds,
  gateFlags,
  orbBuildId,
  scopeCheckOf,
  topCandidates,
} from "@/orb-core/decision-trace";
import { detectGaps, type GapNode } from "@/orb-core/gaps";
import { askProactively } from "@/orb-core/engine.server";
import { scopedDb } from "@/orb-core/scope";

const engineSrc = readFileSync("src/orb-core/engine.server.ts", "utf8");
const initiativeSrc = readFileSync("src/orb-core/initiative.server.ts", "utf8");
const NOW = 1_800_000_000_000;

function node(id: string, over: Partial<GapNode> = {}): GapNode {
  return {
    id,
    content: "Mario schaut gerne Star-Wars-Filme mit Freunden.",
    topic: "film",
    importance: 0.7,
    confidence: 0.9,
    longTermValue: null,
    temporalScope: null,
    category: null,
    activationCount: 1,
    lastAccessedAt: NOW,
    ...over,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("P1 Build-Kennung", () => {
  it("ohne Build-Wert: not_available statt erfundener Version", () => {
    expect(orbBuildId()).toBe(NOT_AVAILABLE);
  });
  it("mit Build-Wert: genau dieser Wert", () => {
    vi.stubGlobal("__ORB_BUILD_ID__", "src-0123456789abcdef");
    expect(orbBuildId()).toBe("src-0123456789abcdef");
  });
  it("Build-Wert wird zur Buildzeit gesetzt, nicht manuell", () => {
    const cfg = readFileSync("vite.config.ts", "utf8");
    expect(cfg).toContain("buildOrbCodeSnapshot(process.cwd()).meta.sha256");
    expect(cfg).toContain("__ORB_BUILD_ID__");
  });
  it("neue Snapshots (Frage, Antwort, Initiative) enthalten build_id", () => {
    expect(engineSrc.match(/build_id: orbBuildId\(\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(initiativeSrc).toContain("build_id: orbBuildId()");
  });
  it("bisherige Snapshot-Felder bleiben erhalten (historisch kompatibel)", () => {
    for (const key of ["proactive: true", "question_id:", "impulse: impulse", "gap_kind:"]) {
      expect(engineSrc).toContain(key);
    }
  });
});

describe("P3 Bereichsprüfung", () => {
  it("enthält den tatsächlichen Laufzeit-Bereich", () => {
    const allowedScopes = ["normal", "orb_core", "y_dude"] as const;
    for (const s of ["unassigned", "fremd", null]) {
      const c = scopeCheckOf({ allowedScopes, runtimeScope: s, explicit: false });
      expect(c).toEqual({
        declared_allowed: "normal|orb_core|y_dude",
        requested: s,
        checked: s,
        result: "blocked",
      });
    }
    for (const s of allowedScopes) {
      expect(scopeCheckOf({ allowedScopes, runtimeScope: s, explicit: false }).result).toBe("pass");
    }
    expect(scopeCheckOf({ allowedScopes, runtimeScope: "unassigned", explicit: true }).result).toBe(
      "explicit_request",
    );
  });

  it("feste Beschriftungen erscheinen nicht mehr als Prüfergebnis", () => {
    for (const src of [engineSrc, initiativeSrc]) {
      expect(src).not.toContain("impulse_scope: IMPULSE_SCOPE");
      expect(src).not.toContain("curiosity_scope: CURIOSITY_SCOPE");
      expect(src).toContain("scope_check");
    }
  });

  it.each(["unassigned"] as const)(
    "%s: keine autonome Frage, kein Datenbankzugriff",
    async (scope) => {
      const from = vi.fn(() => {
        throw new Error("DB darf nicht berührt werden");
      });
      const db = scopedDb({ from } as never, scope);
      const res = await askProactively(db, "user-1");
      expect(res.asked).toBe(false);
      expect(from).not.toHaveBeenCalled();
    },
  );
});

describe("P2 Entscheidungsdaten", () => {
  it("fehlende Werte werden nicht als erfolgreiche Prüfung ausgegeben", () => {
    expect(gateFlags(null)).toEqual({
      suppressed: null,
      candidate_present: null,
      energy_ok: null,
    });
    expect(gateFlags("no_candidate").energy_ok).toBeNull();
    expect(gateFlags("energy")).toEqual({
      suppressed: false,
      candidate_present: true,
      energy_ok: false,
    });
  });

  it("Trace enthält nur IDs und Werte, keine Inhalte", () => {
    const trace = buildAutonomyTrace({
      buildId: "src-x",
      scopeCheck: scopeCheckOf({
        allowedScopes: ["orb_core"],
        runtimeScope: "orb_core",
        explicit: false,
      }),
      gate: "pass",
      openQuestion: false,
      thresholds: { min_energy: 0.15, impulse_min_score: 0.2, question_memory_lock_ms: 1 },
      energy: 0.3,
      curiosityAction: "ASK",
      impulseAction: "SPEAK",
      curiosityCandidates: [
        { memoryId: "b", score: 0.4 },
        { memoryId: "a", score: 0.4 },
        { memoryId: "c", score: 0.9 },
        { memoryId: "d", score: 0.1 },
      ],
      impulseCandidates: [],
      selected: { source: "curiosity", memory_id: "c", score: 0.9 },
      impulse: null,
      blockedReason: null,
      linkLookup: "ok",
    });
    expect(trace.curiosity_top.map((c) => c.memory_id)).toEqual(["c", "a", "b"]);
    expect(JSON.stringify(trace)).not.toContain("Star-Wars");
    expect(trace.gates.energy_ok).toBe(true);
  });
});

describe("P4 Tie-Breaker", () => {
  it("gleiche Werte: gleiche Reihenfolge unabhängig von der Eingangsreihenfolge", () => {
    const base = [
      { memoryId: "n3", score: 0.5 },
      { memoryId: "n1", score: 0.5 },
      { memoryId: "n2", score: 0.5 },
    ];
    const runs = [base, [...base].reverse(), [base[1]!, base[2]!, base[0]!]].map((l) =>
      topCandidates(l).map((c) => c.memory_id),
    );
    for (const r of runs) expect(r).toEqual(["n1", "n2", "n3"]);
    expect(compareIds("a", "b")).toBeLessThan(0);
    expect(compareIds(null, null)).toBe(0);
  });

  it("detectGaps liefert bei permutierter Eingabe dieselben Lücken", () => {
    const nodes = [node("z"), node("a"), node("m")];
    const ids = (list: GapNode[]) =>
      detectGaps({ nodes: list, connections: [], now: NOW })
        .map((g) => g.id)
        .sort(compareIds);
    expect(ids([...nodes].reverse())).toEqual(ids(nodes));
  });

  it("id-Tie-Breaker steht in jeder Abfrage der Lückenerkennung vor dem Limit", () => {
    const start = engineSrc.indexOf("async function loadCuriosityContext(");
    const end = engineSrc.indexOf("const retrievalMs = Date.now() - retrievalStart;", start);
    const block = engineSrc.slice(start, end);
    const limits = [...block.matchAll(/\.limit\(([^)]+)\)/g)].map((m) => m[1]);
    for (const l of limits) {
      if (l === "PROACTIVE_CONTEXT_MESSAGES") continue;
      const idx = block.indexOf(`.limit(${l})`);
      const before = block.slice(Math.max(0, idx - 120), idx);
      expect(before, `limit(${l})`).toContain('.order("id", { ascending: true })');
    }
  });
});

describe("P5 Verknüpfung ausserhalb der Top-12", () => {
  const imp = node("mem-1");
  const kinds = (linked?: Set<string> | null) =>
    detectGaps({ nodes: [imp], connections: [], linkedNodeIds: linked, now: NOW }).map(
      (g) => g.type,
    );

  it("ohne Nachladung: bisheriges Verhalten (unverknüpft)", () => {
    expect(kinds(undefined)).toContain("missing_information");
  });
  it("Verbindung zu Knoten ausserhalb des Fensters: keine Lücke mehr", () => {
    expect(kinds(new Set(["mem-1"]))).not.toContain("missing_information");
  });
  it("Nachladung fehlgeschlagen: unbekannt, nicht automatisch unverknüpft", () => {
    expect(kinds(null)).not.toContain("missing_information");
  });
  it("Verbindung eines anderen Knotens zählt nicht", () => {
    expect(kinds(new Set(["other"]))).toContain("missing_information");
  });
  it("Nachladung ist nutzer- und bereichsgebunden und begrenzt", () => {
    const i = engineSrc.indexOf("// P5: Verbindungen der geladenen Knoten");
    const block = engineSrc.slice(i, i + 1600);
    expect(block).toContain('.eq("user_id", userId)');
    expect(block).toContain(".limit(LINK_LOOKUP_LIMIT)");
    expect(block).toContain('linkLookup = "failed"');
    // `db` ist im Kern immer der bereichsgebundene Zugang (scopedDb).
    expect(block).toContain('.from("orb_connections")');
  });
  it("scopedDb setzt den Bereichsfilter auch für die Nachladung", () => {
    const eq = vi.fn().mockReturnThis();
    const select = vi.fn(() => ({ eq }));
    const db = scopedDb({ from: () => ({ select }) } as never, "orb_core");
    db.from("orb_connections").select("source_node_id, target_node_id");
    expect(eq).toHaveBeenCalledWith("scope", "orb_core");
  });
});
