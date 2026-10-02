import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  LONG_FORM_RULE,
  SHORT_REPLY_RULE,
  isLongFormRequest,
  mergeContinuation,
  readCompletion,
  buildContinuationInput,
  CONTINUATION_TAIL_CHARS,
} from "@/orb-core/long-form";

const generateReply = vi.fn();
vi.mock("@/orb-core/llm/select.server", () => ({ generateReply: (...a: unknown[]) => generateReply(...a) }));
vi.mock("@/orb-core/observability.server", () => ({
  logModelCall: () => undefined,
  nextModelRequest: () => ({ id: "x" }),
  unattributedContext: () => ({}),
}));

/* ------------------------------------------------------------- B1 */
describe("B1 isLongFormRequest", () => {
  it.each([
    "Schreib mir einen ausführlichen Text über Wasserkreisläufe",
    "Verfasse ein Konzept für meine App",
    "Erstelle eine Analyse meines Geschäftsmodells",
    "Bitte detailliert erklären, wie das funktioniert",
    "Schreibe 800 Wörter über Portal",
    "Fasse das Gespräch in einer Zusammenfassung zusammen",
  ])("lang: %s", (t) => expect(isLongFormRequest(t)).toBe(true));

  it.each([
    "Hallo ORB",
    "Was weißt du über mich?",
    "Ich mag Half-Life und Portal",
    "Wie geht es dir?",
    "Der Text war gut",
    "",
  ])("kurz: %s", (t) => expect(isLongFormRequest(t)).toBe(false));
});

describe("B1 Prompt-Regel", () => {
  it("kurz bleibt Standard, lang nur mit longForm", async () => {
    const { buildSpeakSystemPrompt } = await import("@/orb-core/llm/prompt.server");
    const base = {
      state: { curiosity: 0.5, joy: 0.5, fear: 0.1, trust: 0.5, uncertainty: 0.2, energy: 0.5 },
      goals: [],
      decision: "answer",
      recalled: [],
      interests: [],
      mode: "DIRECT_ANSWER",
    } as unknown as Parameters<typeof buildSpeakSystemPrompt>[0];
    const short = buildSpeakSystemPrompt(base);
    expect(short).toContain(SHORT_REPLY_RULE);
    expect(short).not.toContain(LONG_FORM_RULE);
    const long = buildSpeakSystemPrompt({ ...base, longForm: true });
    expect(long).toContain(LONG_FORM_RULE);
    expect(long).not.toContain("höchstens drei Sätze");
    expect(long).not.toContain("einzelner kurzer Satz");
  });
});

/* ------------------------------------------------- B2 Provider-Erkennung */
function sse(events: unknown[]): Response {
  const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
  return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

describe("B2 Provider erkennt Abbruch", () => {
  beforeEach(() => {
    process.env["LOVABLE_API_KEY"] = "test";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("vollständig ⇒ incomplete null", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      sse([
        { type: "response.output_text.delta", delta: "Hallo" },
        { type: "response.completed", response: { output_text: "Hallo" } },
      ]),
    ));
    const { speakViaLovableGateway } = await import("@/orb-core/llm/provider.server");
    const r = await speakViaLovableGateway("s", "t");
    expect(r).toMatchObject({ status: "ok", reply: "Hallo", incomplete: null });
  });

  it("response.incomplete ⇒ Text bleibt, Grund gesetzt", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      sse([
        { type: "response.output_text.delta", delta: "Teil eins " },
        { type: "response.output_text.delta", delta: "und zwei" },
        { type: "response.incomplete", response: { incomplete_details: { reason: "max_output_tokens" } } },
      ]),
    ));
    const { speakViaLovableGateway } = await import("@/orb-core/llm/provider.server");
    const r = await speakViaLovableGateway("s", "t");
    expect(r).toMatchObject({ status: "ok", reply: "Teil eins und zwei", incomplete: "max_output_tokens" });
  });

  it("Strom endet ohne Abschluss ⇒ stream_ended", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => sse([{ type: "response.output_text.delta", delta: "Abgebr" }])));
    const { speakViaLovableGateway } = await import("@/orb-core/llm/provider.server");
    const r = await speakViaLovableGateway("s", "t");
    expect(r).toMatchObject({ status: "ok", reply: "Abgebr", incomplete: "stream_ended" });
  });

  it("Fehler ohne Text ⇒ unavailable wie bisher", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => sse([{ type: "response.failed" }])));
    const { speakViaLovableGateway } = await import("@/orb-core/llm/provider.server");
    const r = await speakViaLovableGateway("s", "t");
    expect(r.status).toBe("unavailable");
  });
});

/* -------------------------------------------------------- B2 Zusammenführen */
describe("B2 mergeContinuation – nur der fehlende Teil", () => {
  it("hängt reinen Rest an", () => {
    const r = mergeContinuation("Der Wasserkreislauf beginnt mit der Verdun", "stung über dem Meer.");
    expect(r.merged).toBe("Der Wasserkreislauf beginnt mit der Verdunstung über dem Meer.");
    expect(r.overlapRemoved).toBe(0);
  });
  it("entfernt wiederholtes Ende", () => {
    const r = mergeContinuation(
      "Erster Absatz. Zweiter Absatz beginnt hier und",
      "Zweiter Absatz beginnt hier und endet jetzt.",
    );
    expect(r.merged).toBe("Erster Absatz. Zweiter Absatz beginnt hier und endet jetzt.");
    expect(r.added).toBe(" endet jetzt.");
  });
  it("setzt Leerzeichen nach Satzende", () => {
    expect(mergeContinuation("Satz eins.", "Satz zwei.").merged).toBe("Satz eins. Satz zwei.");
  });
  it("Fortsetzungs-Eingabe enthält nur das Ende langer Texte", () => {
    const long = "x".repeat(CONTINUATION_TAIL_CHARS + 500);
    expect(buildContinuationInput("Anfrage", long)).toContain("Anfang gekürzt");
  });
  it("readCompletion", () => {
    expect(readCompletion({ completion: { status: "incomplete", reason: "max_output_tokens", continuations: 1 } }))
      .toEqual({ status: "incomplete", reason: "max_output_tokens", continuations: 1 });
    expect(readCompletion({})).toBeNull();
    expect(readCompletion({ completion: { status: "x" } })).toBeNull();
  });
});

/* ----------------------------------------- B2 continueReply (In-Memory-DB) */
type Row = { id: string; user_id: string; role: string; body: string; created_at: string; state_snapshot: Record<string, unknown> };

function fakeDb(rows: Row[]) {
  const get = (r: Row, col: string) => {
    if (col === "state_snapshot->completion->>status") {
      return (r.state_snapshot["completion"] as { status?: string } | undefined)?.status;
    }
    return (r as unknown as Record<string, unknown>)[col];
  };
  return {
    from() {
      let mode: "select" | "update" = "select";
      let patch: Partial<Row> = {};
      let wantRows = false;
      const filters: ((r: Row) => boolean)[] = [];
      let lim = Infinity;
      let desc = false;
      const run = () => {
        let hit = rows.filter((r) => filters.every((f) => f(r)));
        if (mode === "update") {
          for (const r of hit) Object.assign(r, structuredClone(patch));
          return { data: wantRows ? hit.map((r) => ({ id: r.id })) : null, error: null };
        }
        hit = hit.sort((a, b) => (desc ? b.created_at.localeCompare(a.created_at) : 0)).slice(0, lim);
        return { data: hit.map((r) => structuredClone(r)), error: null };
      };
      const q: Record<string, unknown> = {
        select() { if (mode === "update") wantRows = true; return q; },
        update(v: Partial<Row>) { mode = "update"; patch = v; return q; },
        eq(c: string, v: unknown) { filters.push((r) => get(r, c) === v); return q; },
        lt(c: string, v: string) { filters.push((r) => String(get(r, c)) < v); return q; },
        order(c: string, o: { ascending: boolean }) { if (c === "created_at") desc = !o.ascending; return q; },
        limit(n: number) { lim = n; return q; },
        maybeSingle() { const r = run(); return Promise.resolve({ data: (r.data as Row[])[0] ?? null, error: null }); },
        then(res: (v: unknown) => unknown, rej: (e: unknown) => unknown) { return Promise.resolve(run()).then(res, rej); },
      };
      return q;
    },
  };
}

const U = "00000000-0000-0000-0000-000000000001";
const M = "00000000-0000-0000-0000-0000000000aa";
function seed(): Row[] {
  return [
    { id: "u1", user_id: U, role: "user", body: "Schreib einen ausführlichen Text", created_at: "2026-01-01T00:00:00.000Z", state_snapshot: {} },
    { id: M, user_id: U, role: "orb", body: "Der Anfang des Textes endet mitten im", created_at: "2026-01-01T00:00:00.001Z",
      state_snapshot: { build_id: "b", completion: { status: "incomplete", reason: "max_output_tokens", continuations: 0 } } },
  ];
}
const okReply = (reply: string, incomplete: string | null = null) => ({
  reply, status: "ok", meta: { provider: "local", fallbackUsed: false, reason: null, incomplete },
});

describe("B2 continueReply", () => {
  beforeEach(() => generateReply.mockReset());

  it("erzeugt genau einen Aufruf und hängt nur den Rest an", async () => {
    const rows = seed();
    generateReply.mockResolvedValueOnce(okReply(" Satz und ist jetzt fertig."));
    const { continueReply } = await import("@/orb-core/continuation.server");
    const r = await continueReply(fakeDb(rows) as never, U, M);
    expect(generateReply).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ status: "ok", completion: { status: "complete", continuations: 1 } });
    expect(rows[1]!.body).toBe("Der Anfang des Textes endet mitten im Satz und ist jetzt fertig.");
    expect(rows[1]!.state_snapshot["build_id"]).toBe("b");
    const input = generateReply.mock.calls[0]![0] as { text: string };
    expect(input.text).toContain("Schreib einen ausführlichen Text");
  });

  it("Doppelklick: zweiter Aufruf ohne Modellaufruf abgelehnt", async () => {
    const rows = seed();
    let release: (v: unknown) => void = () => undefined;
    generateReply.mockImplementationOnce(() => new Promise((res) => { release = res; }));
    const { continueReply } = await import("@/orb-core/continuation.server");
    const db = fakeDb(rows) as never;
    const first = continueReply(db, U, M);
    await new Promise((r) => setTimeout(r, 0));
    const second = await continueReply(db, U, M);
    expect(second).toEqual({ status: "rejected", reason: "busy" });
    release(okReply(" Rest."));
    await first;
    expect(generateReply).toHaveBeenCalledTimes(1);
    // Nach Abschluss keine weitere Fortsetzung möglich.
    expect(await continueReply(db, U, M)).toEqual({ status: "rejected", reason: "not_incomplete" });
    expect(generateReply).toHaveBeenCalledTimes(1);
  });

  it("erneut abgebrochen ⇒ bleibt incomplete, Zähler steigt", async () => {
    const rows = seed();
    generateReply.mockResolvedValueOnce(okReply(" weiter", "max_output_tokens"));
    const { continueReply } = await import("@/orb-core/continuation.server");
    const r = await continueReply(fakeDb(rows) as never, U, M);
    expect(r).toMatchObject({ status: "ok", completion: { status: "incomplete", continuations: 1 } });
  });

  it("Fehler ⇒ Text unverändert, Sperre gelöst, keine Wiederholung", async () => {
    const rows = seed();
    generateReply.mockResolvedValueOnce({ reply: "", status: "unavailable", meta: { provider: "local", fallbackUsed: false, reason: null } });
    const { continueReply } = await import("@/orb-core/continuation.server");
    const r = await continueReply(fakeDb(rows) as never, U, M);
    expect(r).toMatchObject({ status: "error", reason: "unavailable" });
    expect(rows[1]!.body).toBe("Der Anfang des Textes endet mitten im");
    expect(readCompletion(rows[1]!.state_snapshot)?.status).toBe("incomplete");
    expect(generateReply).toHaveBeenCalledTimes(1);
  });

  it("Limit erreicht ⇒ kein Aufruf", async () => {
    const rows = seed();
    (rows[1]!.state_snapshot["completion"] as { continuations: number }).continuations = 3;
    const { continueReply } = await import("@/orb-core/continuation.server");
    expect(await continueReply(fakeDb(rows) as never, U, M)).toEqual({ status: "rejected", reason: "limit_reached" });
    expect(generateReply).not.toHaveBeenCalled();
  });

  it("fremde Nachricht / Benutzernachricht ⇒ not_found", async () => {
    const rows = seed();
    const { continueReply } = await import("@/orb-core/continuation.server");
    expect(await continueReply(fakeDb(rows) as never, "other", M)).toEqual({ status: "rejected", reason: "not_found" });
    expect(await continueReply(fakeDb(rows) as never, U, "u1")).toEqual({ status: "rejected", reason: "not_found" });
    expect(generateReply).not.toHaveBeenCalled();
  });
});
