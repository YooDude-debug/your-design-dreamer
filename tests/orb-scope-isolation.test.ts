/**
 * ORB Scope-Trennung – Vertrag: user_id = Sitzung UND scope = Route, der
 * Bereichsfilter steht in der Datenbankabfrage selbst (damit vor order/limit).
 *
 * Geprüft wird mit dem echten Supabase-Client gegen einen aufzeichnenden
 * fetch: jede tatsächlich erzeugte PostgREST-Anfrage wird untersucht.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  ORB_SCOPED_TABLES,
  OrbScopeViolation,
  orbChatScopeSchema,
  scopedDb,
  scopeOf,
  type OrbDataScope,
} from "@/orb-core/scope";
import { CONTEXT_WINDOW_MESSAGES, PROACTIVE_CONTEXT_MESSAGES, contextWindow } from "@/orb-core/context";
import type { DB } from "@/orb-core/engine.server";

type Req = { method: string; url: URL; body: unknown };

function recorder(rowsFor: (url: URL) => unknown[] = () => []) {
  const requests: Req[] = [];
  const client = createClient<Database>("http://orb.test", "sb_publishable_test", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(typeof input === "string" ? input : input.toString());
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        requests.push({ method: init?.method ?? "GET", url, body });
        const single = (init?.headers as Record<string, string> | undefined)?.["Accept"];
        const rows = rowsFor(url);
        const payload = single === "application/vnd.pgrst.object+json" ? (rows[0] ?? null) : rows;
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json", "Content-Range": "0-0/0" },
        });
      },
    },
  });
  return { db: client as unknown as DB, requests };
}

const table = (r: Req) => r.url.pathname.replace("/rest/v1/", "");
const scopeParam = (r: Req) => r.url.searchParams.get("scope");

describe("Scope-Validierung (Server-Eingang)", () => {
  it("1 fehlender Scope → abgelehnt", () => {
    expect(orbChatScopeSchema.safeParse(undefined).success).toBe(false);
  });
  it("2 ungültiger Scope → abgelehnt", () => {
    expect(orbChatScopeSchema.safeParse("foo").success).toBe(false);
    expect(() => scopedDb(recorder().db, "foo" as OrbDataScope)).toThrow(OrbScopeViolation);
  });
  it("3 unassigned als Chat-Scope → abgelehnt", () => {
    expect(orbChatScopeSchema.safeParse("unassigned").success).toBe(false);
  });
  it("alle ORB-Serverfunktionen verlangen den Scope ohne Standardwert", () => {
    const src = readFileSync("src/integrations/y-dude-orb/orb.functions.ts", "utf8");
    const calls = src.match(/createOrbCore\(\{[^}]*\}\)/g) ?? [];
    expect(calls.length).toBe(9);
    for (const c of calls) expect(c).toContain("scope: data.scope");
    expect(src).not.toMatch(/orbChatScopeSchema\.default|scope:[^\n]*\.optional\(\)/);
  });
  it("SDK weist Sitzung ohne gültigen Bereich ab", async () => {
    const { createOrbCore } = await import("@/orb-sdk/orb-core.server");
    expect(() =>
      createOrbCore({ data: recorder().db, userId: "u", scope: "unassigned" as never }),
    ).toThrow(OrbScopeViolation);
  });
});

describe("Bereichsfilter in jeder Abfrage", () => {
  it("8 Filter steht in derselben Datenbankabfrage wie order/limit", async () => {
    const { db, requests } = recorder();
    const s = scopedDb(db, "y_dude");
    await s
      .from("orb_nodes")
      .select("*")
      .eq("user_id", "u")
      .eq("topic", "t")
      .order("importance", { ascending: false })
      .limit(20);
    const r = requests[0]!;
    expect(scopeParam(r)).toBe("eq.y_dude");
    expect(r.url.searchParams.get("limit")).toBe("20");
    expect(r.url.searchParams.get("user_id")).toBe("eq.u");
  });

  it("4/5/6/7 jede Leseabfrage auf bereichsgebundenen Tabellen ist gefiltert", async () => {
    for (const scope of ["normal", "orb_core", "y_dude"] as const) {
      const { db, requests } = recorder();
      const s = scopedDb(db, scope);
      for (const t of ORB_SCOPED_TABLES) {
        await s.from(t as "orb_nodes").select("*").eq("user_id", "u").limit(5);
      }
      expect(requests).toHaveLength(ORB_SCOPED_TABLES.size);
      for (const r of requests) expect(scopeParam(r)).toBe(`eq.${scope}`);
      // unassigned und fremde Bereiche können nie im Ergebnis stehen.
      for (const r of requests) expect(scopeParam(r)).not.toBe("eq.unassigned");
    }
  });

  it("14 neue Zeile erhält den aktuellen Scope", async () => {
    const { db, requests } = recorder();
    await scopedDb(db, "orb_core").from("orb_nodes").insert({
      user_id: "u",
      type: "memory",
      content: "x",
    });
    expect((requests[0]!.body as { scope: string }).scope).toBe("orb_core");
  });

  it("Zeile mit fremdem Scope wird abgelehnt, Bereichswechsel per Update verboten", () => {
    const s = scopedDb(recorder().db, "orb_core");
    expect(() =>
      s.from("orb_nodes").insert({ user_id: "u", type: "memory", content: "x", scope: "y_dude" }),
    ).toThrow(OrbScopeViolation);
    expect(() => s.from("orb_nodes").update({ scope: "y_dude" })).toThrow(OrbScopeViolation);
  });

  it("15/16 fremder Node wird nicht verstärkt, last_accessed_at nicht verändert", async () => {
    const { db, requests } = recorder();
    const s = scopedDb(db, "y_dude");
    await s
      .from("orb_nodes")
      .update({ activation_count: 2, last_accessed_at: new Date().toISOString() })
      .eq("id", "n1")
      .eq("user_id", "u");
    expect(requests[0]!.method).toBe("PATCH");
    expect(scopeParam(requests[0]!)).toBe("eq.y_dude");
  });

  it("Löschen nur mit user_id + scope", async () => {
    const { db, requests } = recorder();
    await scopedDb(db, "normal").from("orb_questions").delete().eq("id", "q").eq("user_id", "u");
    expect(scopeParam(requests[0]!)).toBe("eq.normal");
  });

  it("orb_state / orb_style bleiben userweit (kein Scope)", async () => {
    const { db, requests } = recorder();
    const s = scopedDb(db, "normal");
    await s.from("orb_state").select("*").eq("user_id", "u");
    await s.from("orb_style").select("*").eq("user_id", "u");
    for (const r of requests) expect(scopeParam(r)).toBeNull();
  });

  it("scopeOf liefert den Bereich für Diagnose", () => {
    expect(scopeOf(scopedDb(recorder().db, "orb_core"))).toBe("orb_core");
  });
});

describe("Engine-Pfade über den bereichsgebundenen Zugang", () => {
  it("9/10/13 Snapshot: Nodes, Connections, Threads, Interests, Messages alle gefiltert", async () => {
    const { db, requests } = recorder();
    const engine = await import("@/orb-core/engine.server");
    await engine.getSnapshot(scopedDb(db, "orb_core"), "u").catch(() => undefined);
    const scoped = requests.filter((r) => ORB_SCOPED_TABLES.has(table(r)));
    expect(scoped.length).toBeGreaterThan(0);
    for (const r of scoped) expect(scopeParam(r)).toBe("eq.orb_core");
    for (const t of ["orb_nodes", "orb_connections", "orb_threads", "orb_messages"]) {
      expect(scoped.some((r) => table(r) === t)).toBe(true);
    }
  });

  it("11/12 Neugier/Lücken/Initiative lesen nur den eigenen Bereich", async () => {
    const { db, requests } = recorder();
    const engine = await import("@/orb-core/engine.server");
    await engine.inspectCuriosity(scopedDb(db, "y_dude"), "u").catch(() => undefined);
    const scoped = requests.filter((r) => ORB_SCOPED_TABLES.has(table(r)));
    expect(scoped.length).toBeGreaterThan(0);
    for (const r of scoped) expect(scopeParam(r)).toBe("eq.y_dude");
    expect(scoped.some((r) => table(r) === "orb_questions")).toBe(true);
    // Proaktiver Pfad: Verlauf bleibt bei 8.
    const msg = scoped.find((r) => table(r) === "orb_messages");
    expect(msg?.url.searchParams.get("limit")).toBe(String(PROACTIVE_CONTEXT_MESSAGES));
  });

  it("22 Feed schreibt und liest nur unassigned, Snapshot aus dem Chat-Bereich", async () => {
    const { db, requests } = recorder();
    const feed = await import("@/orb-core/feed.server");
    await feed
      .observeFeed(scopedDb(db, "unassigned"), "u", scopedDb(db, "normal"))
      .catch(() => undefined);
    const interest = requests.find((r) => table(r) === "orb_interests");
    expect(scopeParam(interest!)).toBe("eq.unassigned");
    const snap = requests.filter((r) => table(r) === "orb_nodes");
    for (const r of snap) expect(scopeParam(r)).toBe("eq.normal");
  });

  it("keine ORB-Core-Datei erzeugt eigene Datenbank-Clients (einziger Zugang = SDK)", () => {
    for (const f of [
      "src/orb-core/engine.server.ts",
      "src/orb-core/feed.server.ts",
      "src/orb-core/continuity-store.server.ts",
      "src/orb-core/initiative.server.ts",
      "src/orb-core/process.server.ts",
      "src/orb-core/turn-memory.server.ts",
      "src/orb-core/analysis/apply.server.ts",
    ]) {
      const src = readFileSync(f, "utf8");
      expect(src).not.toMatch(/createClient\(|integrations\/supabase\/client/);
    }
  });
});

describe("Kontext", () => {
  it("17 Chat lädt 16 Nachrichten, proaktiv bleibt 8", () => {
    expect(CONTEXT_WINDOW_MESSAGES).toBe(16);
    expect(PROACTIVE_CONTEXT_MESSAGES).toBe(8);
  });
  it("18/26 12 Nachrichten alte Information bleibt im direkten Kontext", () => {
    const msgs = Array.from({ length: 13 }, (_, i) => ({
      role: (i % 2 ? "orb" : "user") as "orb" | "user",
      body: i === 0 ? "Am 30.9.26 mache ich 500 Tests" : `m${i}`,
    }));
    const win = contextWindow(msgs);
    expect(win[0]!.body).toContain("500");
    expect(win.length).toBe(13);
  });
  it("27 proaktive Nachricht entsteht über denselben Bereichs-Zugang wie die Frage", async () => {
    const { db, requests } = recorder();
    const s = scopedDb(db, "orb_core");
    await s.from("orb_questions").select("*").eq("user_id", "u");
    await s.from("orb_messages").insert({ user_id: "u", role: "orb", body: "?" });
    expect(scopeParam(requests[0]!)).toBe("eq.orb_core");
    expect((requests[1]!.body as { scope: string }).scope).toBe("orb_core");
  });
});

describe("Schema, ORB-Dev und Routing", () => {
  const mig = readFileSync("drizzle/migrations/0053_orb_scope_isolation.sql", "utf8");
  it("19/20/25 Unique-Indizes je Scope (norm_key, Threadtitel, Interessen)", () => {
    expect(mig).toContain("(user_id, scope, norm_key) WHERE norm_key IS NOT NULL");
    expect(mig).toContain("(user_id, scope, lower(title))");
    expect(mig).toContain("UNIQUE (user_id, scope, topic)");
    expect(mig).toContain("DROP INDEX public.orb_nodes_user_norm_key_uidx");
  });
  it("Alte Daten: Default unassigned auf allen 7 Tabellen", () => {
    expect(mig.match(/NOT NULL DEFAULT 'unassigned'/g)).toHaveLength(7);
  });
  it("9 Connection-Trigger verhindert Verbindungen über Bereiche", () => {
    expect(mig).toContain("orb_connections_scope_guard");
  });
  it("21 ORB-Dev fest orb_core", () => {
    const src = readFileSync("src/orb-dev/chat-bridge.server.ts", "utf8");
    expect(src).toContain("orbScope: ORB_DEV_SCOPE");
  });
  it("24 /channels/orb → /channels/orb/normal", () => {
    const src = readFileSync("src/routes/_authenticated/channels.orb.index.tsx", "utf8");
    expect(src).toContain('params: { scope: "normal" }');
  });
});
