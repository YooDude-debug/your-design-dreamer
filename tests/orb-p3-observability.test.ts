/**
 * P3 OBSERVABILITY – Tests der Korrelation Ereignis → Modellaufruf.
 *
 * Diese Tests erzeugen KEINEN echten Modellaufruf: der Netzwerkzugriff wird
 * durch eine Attrappe ersetzt und die Datenbank ist der bestehende
 * protokollierende Ersatz. Keine Kosten, keine Produktionsdaten.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  logEventSummary,
  newEventContext,
  nextModelRequest,
  unattributedContext,
} from "@/orb-core/observability.server";
import { speakViaLovableGateway } from "@/orb-core/llm/provider.server";
import { processInput } from "@/orb-core/engine.server";
import { createFakeDb, type FakeCall, type FakeResponse } from "./helpers/fake-supabase";

type Line = { tag: string; data: Record<string, unknown> };

let lines: Line[] = [];
let info: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  lines = [];
  info = vi.spyOn(console, "info").mockImplementation((tag: unknown, payload?: unknown) => {
    if (typeof tag === "string" && tag.startsWith("[orb.obs") && typeof payload === "string") {
      lines.push({ tag, data: JSON.parse(payload) as Record<string, unknown> });
    }
  });
});

afterEach(() => {
  info.mockRestore();
  vi.unstubAllGlobals();
  delete process.env["LOVABLE_API_KEY"];
});

const calls = () => lines.filter((l) => l.tag === "[orb.obs.model_call]").map((l) => l.data);
const events = () => lines.filter((l) => l.tag === "[orb.obs.event]").map((l) => l.data);

/** Antwort-Attrappe des Gateways (SSE), ohne echten Netzwerkzugriff. */
function stubGateway(options: { status?: number; text?: string; runId?: string | null } = {}) {
  const status = options.status ?? 200;
  const body =
    options.text === undefined
      ? null
      : `data: ${JSON.stringify({ type: "response.output_text.delta", delta: options.text })}\n\n`;
  vi.stubGlobal("fetch", async () => {
    const headers = new Headers();
    if (options.runId) headers.set("X-Lovable-AIG-Run-ID", options.runId);
    return new Response(body, { status, headers });
  });
  process.env["LOVABLE_API_KEY"] = "test-key-not-a-secret";
}

describe("P3 Observability – Kennungen", () => {
  it("A – Ereignis-Kennung ist eindeutig, stabil und nicht aus dem Text erzeugt", () => {
    const a = newEventContext({ path: "turn_reply", callType: "user_visible" });
    const b = newEventContext({ path: "turn_reply", callType: "user_visible" });
    expect(a.eventId).toMatch(/^evt_[0-9a-f-]{36}$/);
    expect(a.eventId).not.toBe(b.eventId);
    expect(a.source).toBe("orb_event");
    expect(a.calls).toBe(0);
  });

  it("G – parallele Vorgänge kollidieren nicht", () => {
    const ids = new Set(
      Array.from({ length: 500 }, () =>
        newEventContext({ path: "turn_reply", callType: "user_visible" }).eventId,
      ),
    );
    expect(ids.size).toBe(500);
  });

  it("Modellaufruf-Kennungen zählen innerhalb des Ereignisses hoch", () => {
    const ctx = newEventContext({ path: "turn_reply", callType: "user_visible" });
    const first = nextModelRequest(ctx);
    const second = nextModelRequest(ctx);
    expect(first.index).toBe(1);
    expect(second.index).toBe(2);
    expect(first.modelRequestId).not.toBe(second.modelRequestId);
    expect(ctx.calls).toBe(2);
  });

  it("H – Aufruf ohne ORB-Ereignis gilt als Entwicklungs-/Testlauf", () => {
    const ctx = unattributedContext();
    expect(ctx.source).toBe("development_test");
    expect(ctx.path).toBe("unattributed");
  });
});

describe("P3 Observability – Modellaufruf-Protokoll", () => {
  it("C – erfolgreicher Aufruf wird mit Ereignis, Modell und Dauer protokolliert", async () => {
    stubGateway({ text: "Alles klar.", runId: "run-123" });
    const ctx = newEventContext({ path: "turn_reply", callType: "user_visible" });
    const res = await speakViaLovableGateway("system", "hallo", ctx);
    expect(res.status).toBe("ok");
    const [record] = calls();
    expect(record).toBeDefined();
    expect(record!["event_id"]).toBe(ctx.eventId);
    expect(record!["model_request_id"]).toMatch(/^mrq_/);
    expect(record!["call_index"]).toBe(1);
    expect(record!["source"]).toBe("orb_event");
    expect(record!["path"]).toBe("turn_reply");
    expect(record!["call_type"]).toBe("user_visible");
    expect(record!["provider"]).toBe("lovable_gateway");
    expect(record!["model"]).toBe("openai/gpt-6-astra");
    expect(record!["success"]).toBe(true);
    expect(record!["http_status"]).toBe(200);
    expect(record!["gateway_run_id"]).toBe("run-123");
    expect(typeof record!["duration_ms"]).toBe("number");
  });

  it("E – Fehlerfall wird als nicht erfolgreich protokolliert", async () => {
    stubGateway({ status: 500, text: "" });
    const ctx = newEventContext({ path: "turn_reply", callType: "user_visible" });
    await speakViaLovableGateway("system", "hallo", ctx);
    const [record] = calls();
    expect(record!["success"]).toBe(false);
    expect(record!["http_status"]).toBe(500);
    expect(record!["failure_kind"]).toBe("http_error");
  });

  it("Guthaben-/Richtliniensperre wird eigens benannt", async () => {
    stubGateway({ status: 402, text: "" });
    const ctx = newEventContext({ path: "proactive_question", callType: "user_visible" });
    await speakViaLovableGateway("system", "hallo", ctx);
    expect(calls()[0]!["failure_kind"]).toBe("quota_or_policy");
    expect(calls()[0]!["path"]).toBe("proactive_question");
  });

  it("Datenschutz – kein Nachrichtentext und keine Antwort im Protokoll", async () => {
    stubGateway({ text: "Geheime Antwort über Rex.", runId: null });
    const ctx = newEventContext({ path: "turn_reply", callType: "user_visible" });
    await speakViaLovableGateway("System mit Erinnerungen", "Mein Hund heisst Rex.", ctx);
    const raw = JSON.stringify(calls()[0]);
    expect(raw).not.toContain("Rex");
    expect(raw).not.toContain("Geheime");
    expect(raw).not.toContain("test-key-not-a-secret");
    expect(calls()[0]!["reply_chars"]).toBe("Geheime Antwort über Rex.".length);
  });

  it("H – ohne Ereigniskontext wird kein künstliches ORB-Ereignis erfunden", async () => {
    stubGateway({ text: "ok" });
    await speakViaLovableGateway("system", "hallo");
    expect(calls()[0]!["source"]).toBe("development_test");
    expect(calls()[0]!["path"]).toBe("unattributed");
  });
});

describe("P3 Observability – Ereignis im Verarbeitungsvorgang", () => {
  const USER = "11111111-1111-4111-8111-111111111111";
  const NOW = new Date().toISOString();
  const state = {
    id: "s",
    user_id: USER,
    curiosity: 0.7,
    joy: 0.5,
    fear: 0.05,
    trust: 0.5,
    uncertainty: 0.3,
    energy: 0.95,
    cracks: 0,
    reactivation_count: 0,
    goals: ["help_user"],
    created_at: NOW,
    updated_at: NOW,
  };

  const db = () =>
    createFakeDb((c: FakeCall): FakeResponse => {
      if (c.table === "orb_state") return { data: state };
      if (c.table === "orb_nodes") {
        if (c.action === "insert") return { data: { id: "n-new" } };
        if (c.action === "select") return { data: c.single ? null : [] };
        return { data: null };
      }
      if (c.action === "select") return { data: c.single ? null : [] };
      return { data: c.single ? { id: `${c.table}-x` } : null };
    });

  it("A/B/F – jede Nachricht erzeugt genau eine, unterscheidbare Ereigniszeile", async () => {
    await processInput(db(), USER, "Erste Nachricht.");
    await processInput(db(), USER, "Zweite Nachricht.");
    const evts = events();
    expect(evts).toHaveLength(2);
    expect(evts[0]!["event_id"]).not.toBe(evts[1]!["event_id"]);
    for (const e of evts) {
      expect(e["path"]).toBe("turn_reply");
      expect(e["source"]).toBe("orb_event");
      expect(typeof e["model_calls"]).toBe("number");
      expect(typeof e["db_queries"]).toBe("number");
      expect(JSON.stringify(e)).not.toContain("Nachricht");
    }
  });

  it("Die Frage „wie viele Modellaufrufe hat Ereignis X erzeugt?" ist beantwortbar", () => {
    const ctx = newEventContext({ path: "turn_reply", callType: "user_visible" });
    nextModelRequest(ctx);
    logEventSummary({ ctx, outcome: "answer", dbQueries: 24, totalMs: 1200 });
    const [summary] = events();
    expect(summary!["event_id"]).toBe(ctx.eventId);
    expect(summary!["model_calls"]).toBe(1);
    expect(summary!["outcome"]).toBe("answer");
  });
});
