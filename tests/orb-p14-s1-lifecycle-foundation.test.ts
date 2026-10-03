/**
 * P14 S1 – Lifecycle Foundation: Vorher/Nachher-Nachweis.
 * Die Referenzfunktionen unten sind wörtliche Kopien des Stands vor S1
 * (analysis/validate.ts lifecycleFor, analysis/apply.server.ts weaken +
 * Fortschreibungsschleife). Der neue Baustein muss für jede Eingabe exakt
 * dasselbe liefern.
 */
import { describe, expect, it } from "vitest";
import {
  LIFECYCLE_ORDER,
  analysisLifecycleUpdate,
  lifecycleFor,
  weaken,
  type Lifecycle,
} from "@/orb-core/memory-lifecycle";
import { lifecycleFor as reExported } from "@/orb-core/analysis/validate";
import type { OrbTemporalScope } from "@/orb-core/analysis/schema";
import { ORB_DATA_SCOPES } from "@/orb-core/scope-values";

const DAY = 86_400_000;

// ---- Referenz: Stand vor S1 (unverändert kopiert) ----
function legacyLifecycleFor(input: {
  temporalScope: OrbTemporalScope;
  ageMs: number;
  lastAccessedAgeMs: number;
  forgotten?: boolean;
}): Lifecycle {
  if (input.forgotten) return "forgotten";
  if (input.temporalScope === "persistent") return "active";
  const idleDays = input.lastAccessedAgeMs / DAY;
  if (input.temporalScope === "one_time") {
    if (idleDays >= 7) return "archived";
    if (idleDays >= 1) return "stale";
    return "active";
  }
  if (input.temporalScope === "temporary") {
    if (idleDays >= 30) return "archived";
    if (idleDays >= 7) return "stale";
    if (idleDays >= 2) return "weak";
    return "active";
  }
  if (idleDays >= 180) return "stale";
  if (idleDays >= 60) return "weak";
  return "active";
}
const LEGACY_ORDER: Lifecycle[] = ["active", "weak", "stale", "archived", "forgotten"];
function legacyWeaken(current: Lifecycle): Lifecycle {
  const index = LEGACY_ORDER.indexOf(current);
  return LEGACY_ORDER[Math.min(LEGACY_ORDER.length - 1, index + 1)]!;
}
function legacyLoopStep(
  row: { temporal_scope: string; created_at: string; last_accessed_at: string; lifecycle: string },
  now: number,
): Lifecycle | null {
  const next = legacyLifecycleFor({
    temporalScope: row.temporal_scope as OrbTemporalScope,
    ageMs: now - new Date(row.created_at).getTime(),
    lastAccessedAgeMs: now - new Date(row.last_accessed_at).getTime(),
    forgotten: row.lifecycle === "forgotten",
  });
  if (next === row.lifecycle) return null;
  return next;
}

const SCOPES_T: OrbTemporalScope[] = ["persistent", "long_term", "temporary", "one_time"];
// Grenzwerte jeder Schwelle (±1 ms) plus Streuwerte und Randfälle.
const THRESH = [1, 2, 7, 30, 60, 180];
const IDLE_MS = [
  -DAY,
  0,
  1,
  ...THRESH.flatMap((d) => [d * DAY - 1, d * DAY, d * DAY + 1]),
  0.5 * DAY,
  45 * DAY,
  365 * DAY,
  10_000 * DAY,
  Number.NaN,
  Number.POSITIVE_INFINITY,
];
const ALL: Lifecycle[] = ["active", "weak", "stale", "archived", "forgotten"];

describe("P14 S1 – lifecycleFor identisch zum Stand vor S1", () => {
  it("vollständiges Raster: Zeitbezug × Ruhezeit × Alter × forgotten", () => {
    let n = 0;
    for (const t of SCOPES_T)
      for (const idle of IDLE_MS)
        for (const age of [0, idle, 900 * DAY])
          for (const forgotten of [undefined, false, true]) {
            const input = { temporalScope: t, ageMs: age, lastAccessedAgeMs: idle, forgotten };
            expect(lifecycleFor(input)).toBe(legacyLifecycleFor(input));
            expect(reExported(input)).toBe(legacyLifecycleFor(input));
            n++;
          }
    expect(n).toBe(SCOPES_T.length * IDLE_MS.length * 9);
  });

  it("Re-Export aus analysis/validate ist dieselbe Funktion", () => {
    expect(reExported).toBe(lifecycleFor);
  });
});

describe("P14 S1 – weaken und Reihenfolge identisch", () => {
  it("jede Stufe", () => {
    for (const s of ALL) expect(weaken(s)).toBe(legacyWeaken(s));
    expect([...LIFECYCLE_ORDER]).toEqual(LEGACY_ORDER);
  });
  it("unbekannter Zustand verhält sich wie vorher (index -1 → active)", () => {
    expect(weaken("x" as Lifecycle)).toBe(legacyWeaken("x" as Lifecycle));
  });
});

describe("P14 S1 – Fortschreibung je Knoten identisch zur alten Schleife", () => {
  const now = Date.parse("2026-10-03T19:00:00.000Z");
  it("alle Zustände × Zeitbezüge × Ruhezeiten", () => {
    for (const lifecycle of ALL)
      for (const t of SCOPES_T)
        for (const idle of IDLE_MS.filter(Number.isFinite)) {
          const row = {
            temporal_scope: t,
            created_at: new Date(now - 900 * DAY).toISOString(),
            last_accessed_at: new Date(now - idle).toISOString(),
            lifecycle,
          };
          expect(analysisLifecycleUpdate(row, now)).toBe(legacyLoopStep(row, now));
        }
  });

  it("Regression: heutiger DB-Zustand (alle active, Daten von heute) ändert sich nicht", () => {
    for (const t of SCOPES_T) {
      const iso = new Date(now - 3_600_000).toISOString();
      const row = {
        temporal_scope: t,
        created_at: iso,
        last_accessed_at: iso,
        lifecycle: "active",
      };
      expect(analysisLifecycleUpdate(row, now)).toBeNull();
    }
  });

  it("forgotten bleibt immer forgotten (nie automatische Wiederherstellung)", () => {
    for (const t of SCOPES_T) {
      const row = {
        temporal_scope: t,
        created_at: new Date(now).toISOString(),
        last_accessed_at: new Date(now).toISOString(),
        lifecycle: "forgotten",
      };
      expect(analysisLifecycleUpdate(row, now)).toBeNull();
    }
  });
});

describe("P14 S1 – Scope-Grenzen", () => {
  it("Baustein ist scope-frei: Ergebnis hängt in keinem Scope vom Scope ab", () => {
    const now = Date.parse("2026-10-03T19:00:00.000Z");
    expect([...ORB_DATA_SCOPES].sort()).toEqual(["normal", "orb_core", "unassigned", "y_dude"]);
    for (const t of SCOPES_T)
      for (const idle of [0, 3 * DAY, 70 * DAY, 200 * DAY]) {
        const base = {
          temporal_scope: t,
          created_at: new Date(now - idle).toISOString(),
          last_accessed_at: new Date(now - idle).toISOString(),
          lifecycle: "active",
        };
        const results = ORB_DATA_SCOPES.map((scope) =>
          analysisLifecycleUpdate({ ...base, scope } as typeof base, now),
        );
        expect(new Set(results).size).toBe(1);
      }
  });

  it("Baustein hat keinen DB-, Scope- oder Netz-Import", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/orb-core/memory-lifecycle.ts", "utf8");
    const imports = [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    expect(imports).toEqual(["@/orb-core/analysis/schema"]);
    expect(src).not.toMatch(/supabase|fetch\(|\.from\(|scopedDb/);
  });

  it("Schreibpfad nutzt weiter den gescopten Client (unverändert)", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/orb-core/analysis/apply.server.ts", "utf8");
    expect(src).toMatch(/analysisLifecycleUpdate\(row, now\)/);
    expect(src).toMatch(
      /db\.from\("orb_nodes"\)\.update\(\{ lifecycle: next \}\)\.eq\("id", row\.id\)\.eq\("user_id", userId\)/,
    );
  });
});
