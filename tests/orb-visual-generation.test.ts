/**
 * ORB P2 – autonome Bildgenerierung: Intent, Limits, Provider, Darstellung, Scope.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  VISUAL_AUTONOMOUS_DAILY_LIMIT,
  VISUAL_DAILY_LIMIT,
  VISUAL_MODEL,
  VISUAL_PROMPT_HINT,
  checkVisualLimit,
  estimateVisualCost,
  extractVisualMarker,
  isExplicitVisualRequest,
  validateGeneratedImage,
  validateVisualIntent,
} from "@/orb-core/visual/intent";
import {
  generateVisual,
  promptHash,
  signVisualIntent,
  verifyVisualIntent,
} from "@/orb-core/visual/generate.server";
import { buildSpeakSystemPrompt } from "@/orb-core/llm/prompt.server";
import { OrbVisualMessage } from "@/components/orb/OrbVisualMessage";

const PNG = "iVBORw0KGgo" + "A".repeat(400);
const marker = (o: object) => `[[ORB_VISUAL ${JSON.stringify(o)}]]`;
const good = { category: "diagram", prompt: "A clean diagram of the water cycle, no text" };
const engine = readFileSync("src/orb-core/engine.server.ts", "utf8");
const fns =
  readFileSync("src/integrations/y-dude-orb/orb.functions.ts", "utf8") +
  readFileSync("src/orb-sdk/orb-core.server.ts", "utf8");
const page = readFileSync("src/routes/_authenticated/channels.orb.$scope.tsx", "utf8");

/** Minimaler Datenbank-Doppelgänger für orb_visual_generations. */
function fakeDb(rows: Record<string, unknown>[] = [], opts: { failSelect?: boolean } = {}) {
  const inserts: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const db = {
    from: (table: string) => {
      expect(table).toBe("orb_visual_generations");
      const q: Record<string, unknown> = {};
      const chain = () => q;
      Object.assign(q, {
        select: chain,
        eq: chain,
        gte: chain,
        order: chain,
        limit: () =>
          Promise.resolve(
            opts.failSelect ? { data: null, error: { message: "x" } } : { data: rows, error: null },
          ),
        insert: (row: Record<string, unknown>) => {
          inserts.push(row);
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { id: "gen-1" }, error: null }),
            }),
          };
        },
        update: (row: Record<string, unknown>) => {
          updates.push(row);
          const u = { eq: () => u, then: (r: (v: unknown) => void) => r({ error: null }) };
          return u;
        },
      });
      return q;
    },
  };
  return { db: db as never, inserts, updates };
}

const sse = (ev: object) =>
  new Response(`event: x\ndata: ${JSON.stringify(ev)}\n\n`, { status: 200 });
const completed = (b64 = PNG) =>
  sse({
    type: "image_generation.completed",
    b64_json: b64,
    output_format: "png",
    usage: {
      input_tokens: 17,
      input_tokens_details: { text_tokens: 17, image_tokens: 0 },
      output_tokens: 196,
      output_tokens_details: { image_tokens: 196, text_tokens: 0 },
    },
  });

beforeEach(() => {
  vi.stubEnv("LOVABLE_API_KEY", "test-key");
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const token = (
  kind: "explicit" | "autonomous" = "explicit",
  scope: "normal" | "orb_core" | "y_dude" = "normal",
) => signVisualIntent({ kind, category: "diagram", prompt: good.prompt }, "u1", scope)!;

describe("Markierung und Intent", () => {
  it("entfernt die Markierung vollständig aus der Antwort", () => {
    const r = extractVisualMarker(`Hier ist der Ablauf.\n${marker(good)}`);
    expect(r.text).toBe("Hier ist der Ablauf.");
    expect(r.raw).not.toBeNull();
  });
  it("unvollständige Markierung wird nie angezeigt", () => {
    expect(extractVisualMarker('Text [[ORB_VISUAL {"categ').text).toBe("Text");
  });
  it("Antwort ohne Markierung bleibt unverändert", () => {
    expect(extractVisualMarker("Hallo Mario.")).toEqual({ text: "Hallo Mario.", raw: null });
  });
  it("expliziter Nutzerwunsch → explicit", () => {
    const r = validateVisualIntent(JSON.stringify(good), {
      userText: "Zeichne mir den Wasserkreislauf",
      scope: "normal",
    });
    expect(r).toMatchObject({ ok: true, intent: { kind: "explicit" } });
  });
  it("autonom bei inhaltlicher Frage mit Mehrwert-Kategorie", () => {
    const r = validateVisualIntent(JSON.stringify(good), {
      userText: "Wie funktioniert eigentlich der Wasserkreislauf genau?",
      scope: "orb_core",
    });
    expect(r).toMatchObject({ ok: true, intent: { kind: "autonomous" } });
  });
  it("Alltagsantwort (kurze Eingabe) → kein Bild", () => {
    expect(
      validateVisualIntent(JSON.stringify(good), { userText: "Hallo wie gehts", scope: "normal" }),
    ).toEqual({ ok: false, reason: "no_visual_value" });
  });
  it("ungültige Kategorie, JSON, Prompt-Länge und Bereich werden abgelehnt", () => {
    const ctx = { userText: "Zeichne mir bitte etwas", scope: "normal" };
    expect(
      validateVisualIntent('{"category":"meme","prompt":"xxxxxxxxxxxxxxxx"}', ctx),
    ).toMatchObject({ reason: "invalid_category" });
    expect(validateVisualIntent("{kaputt", ctx)).toMatchObject({ reason: "invalid_json" });
    expect(validateVisualIntent('{"category":"diagram","prompt":"kurz"}', ctx)).toMatchObject({
      reason: "prompt_too_short",
    });
    expect(
      validateVisualIntent(JSON.stringify({ ...good, prompt: "x".repeat(900) }), ctx),
    ).toMatchObject({ reason: "prompt_too_long" });
    expect(
      validateVisualIntent(JSON.stringify(good), { ...ctx, scope: "unassigned" }),
    ).toMatchObject({ reason: "scope_not_allowed" });
  });
  it("Modell kann 'explicit' nicht selbst behaupten", () => {
    const r = validateVisualIntent(JSON.stringify({ ...good, kind: "explicit" }), {
      userText: "Erklär mir bitte den Aufbau einer Zelle",
      scope: "normal",
    });
    expect(r).toMatchObject({ ok: true, intent: { kind: "autonomous" } });
  });
  it("Erkennung expliziter Wünsche", () => {
    expect(isExplicitVisualRequest("Kannst du ein Bild von einem Leuchtturm erstellen?")).toBe(
      true,
    );
    expect(isExplicitVisualRequest("Ich habe gestern ein Bild gesehen")).toBe(false);
  });
});

describe("Prompt", () => {
  const base = {
    state: {
      curiosity: 0.5,
      joy: 0.5,
      fear: 0,
      trust: 0.5,
      uncertainty: 0.2,
      energy: 0.6,
    } as never,
    goals: [],
    decision: "answer",
    recalled: [],
    interests: [],
  };
  it("ohne visualHint byte-identisch (keine Wirkung auf andere Pfade)", () => {
    expect(buildSpeakSystemPrompt(base)).not.toContain("ORB_VISUAL");
    expect(buildSpeakSystemPrompt({ ...base, visualHint: false })).toBe(
      buildSpeakSystemPrompt(base),
    );
  });
  it("mit visualHint enthält er die Anweisung", () => {
    expect(buildSpeakSystemPrompt({ ...base, visualHint: true })).toContain(VISUAL_PROMPT_HINT);
  });
});

describe("Limits und Kosten", () => {
  const row = (kind = "explicit", hash = "h", status = "ok") => ({
    intent_kind: kind,
    prompt_hash: hash,
    status,
  });
  it("Tageslimit blockiert", () => {
    const rows = Array.from({ length: VISUAL_DAILY_LIMIT }, (_, i) => row("explicit", `h${i}`));
    expect(checkVisualLimit(rows, { kind: "explicit", promptHash: "neu" })).toEqual({
      allowed: false,
      reason: "daily_limit",
    });
  });
  it("autonomes Limit blockiert nur autonome Bilder", () => {
    const rows = Array.from({ length: VISUAL_AUTONOMOUS_DAILY_LIMIT }, (_, i) =>
      row("autonomous", `h${i}`),
    );
    expect(checkVisualLimit(rows, { kind: "autonomous", promptHash: "n" })).toMatchObject({
      reason: "autonomous_limit",
    });
    expect(checkVisualLimit(rows, { kind: "explicit", promptHash: "n" })).toEqual({
      allowed: true,
    });
  });
  it("bereits gezeigtes Bild wird nicht wiederholt; Fehlschläge zählen trotzdem", () => {
    expect(
      checkVisualLimit([row("explicit", "h")], { kind: "explicit", promptHash: "h" }),
    ).toMatchObject({ reason: "already_shown" });
    expect(
      checkVisualLimit([row("explicit", "h", "provider_error")], {
        kind: "explicit",
        promptHash: "h",
      }),
    ).toEqual({ allowed: true });
  });
  it("Kosten nur aus echter Nutzung, sonst null", () => {
    expect(
      estimateVisualCost({
        input_tokens: 17,
        input_tokens_details: { text_tokens: 17 },
        output_tokens: 196,
        output_tokens_details: { image_tokens: 196 },
      }).catalogCost,
    ).toBeCloseTo(0.005965, 6);
    expect(estimateVisualCost(undefined).catalogCost).toBeNull();
  });
  it("Bildprüfung", () => {
    expect(validateGeneratedImage(PNG, "png")).toMatchObject({ ok: true, mimeType: "image/png" });
    expect(validateGeneratedImage("", "png")).toMatchObject({ ok: false, reason: "empty_image" });
    expect(validateGeneratedImage("Z".repeat(400), "png")).toMatchObject({
      ok: false,
      reason: "unknown_signature",
    });
  });
});

describe("Signatur und Scope", () => {
  it("Token gilt nur für Benutzer und Bereich", () => {
    const t = token("explicit", "orb_core");
    expect(verifyVisualIntent(t, "u1", "orb_core")).not.toBeNull();
    expect(verifyVisualIntent(t, "u1", "normal")).toBeNull();
    expect(verifyVisualIntent(t, "u2", "orb_core")).toBeNull();
  });
  it("manipuliertes oder abgelaufenes Token wird abgelehnt", () => {
    const t = token();
    expect(verifyVisualIntent(t.slice(0, -2) + "xx", "u1", "normal")).toBeNull();
    expect(verifyVisualIntent(t, "u1", "normal", Date.now() + 11 * 60_000)).toBeNull();
  });
  it("alle drei Chat-Bereiche sind eingebunden; Seite trennt Bilder je Bereich", () => {
    for (const s of ["normal", "orb_core", "y_dude"] as const)
      expect(verifyVisualIntent(token("explicit", s), "u1", s)).not.toBeNull();
    expect(page).toContain("v.key.startsWith(`visual-${scope}-`)");
  });
});

describe("generateVisual", () => {
  it("Erfolg: genau ein Bildaufruf, Bild zurück, Spur ohne Prompt/Bild", async () => {
    const { db, inserts, updates } = fakeDb();
    const f = vi.fn().mockResolvedValue(completed());
    const r = await generateVisual(
      db,
      { userId: "u1", scope: "normal", token: token() },
      { fetch: f as never },
    );
    expect(r).toMatchObject({ status: "ok", mimeType: "image/png" });
    expect(f).toHaveBeenCalledTimes(1);
    const body = JSON.parse(f.mock.calls[0]![1].body);
    expect(body).toMatchObject({ model: VISUAL_MODEL, stream: true });
    expect(body).not.toHaveProperty("max_tokens");
    expect(inserts[0]).toMatchObject({
      scope: "normal",
      intent_kind: "explicit",
      model: VISUAL_MODEL,
      status: "started",
      prompt_hash: promptHash(good.prompt),
    });
    expect(typeof inserts[0]!["build_id"]).toBe("string");
    expect(updates[0]).toMatchObject({ status: "ok", output_tokens: 196 });
    const logged = JSON.stringify([inserts, updates]);
    expect(logged).not.toContain("water cycle");
    expect(logged).not.toContain(PNG.slice(0, 30));
  });
  it("Tageslimit: kein Provider-Aufruf", async () => {
    const rows = Array.from({ length: VISUAL_DAILY_LIMIT }, (_, i) => ({
      intent_kind: "explicit",
      prompt_hash: `h${i}`,
      status: "ok",
    }));
    const f = vi.fn();
    const r = await generateVisual(
      fakeDb(rows).db,
      { userId: "u1", scope: "normal", token: token() },
      { fetch: f as never },
    );
    expect(r).toMatchObject({ status: "blocked", reason: "daily_limit" });
    expect(f).not.toHaveBeenCalled();
  });
  it("unbekannter Zählerstand → keine Generierung", async () => {
    const f = vi.fn();
    const r = await generateVisual(
      fakeDb([], { failSelect: true }).db,
      { userId: "u1", scope: "normal", token: token() },
      { fetch: f as never },
    );
    expect(r.status).toBe("error");
    expect(f).not.toHaveBeenCalled();
  });
  it("Provider-Fehler → Fehlermeldung, keine Erfolgsmeldung", async () => {
    const { db, updates } = fakeDb();
    const r = await generateVisual(
      db,
      { userId: "u1", scope: "normal", token: token() },
      { fetch: vi.fn().mockResolvedValue(new Response("x", { status: 500 })) as never },
    );
    expect(r).toMatchObject({ status: "error", reason: "provider_error" });
    expect(updates[0]).toMatchObject({ status: "provider_error", http_status: 500 });
  });
  it("Guthaben/Limit 402 → quota", async () => {
    const r = await generateVisual(
      fakeDb().db,
      { userId: "u1", scope: "normal", token: token() },
      { fetch: vi.fn().mockResolvedValue(new Response("x", { status: 402 })) as never },
    );
    expect(r).toMatchObject({ status: "error", reason: "quota" });
  });
  it("leere oder ungültige Bildantwort → invalid_image", async () => {
    const { db, updates } = fakeDb();
    const r = await generateVisual(
      db,
      { userId: "u1", scope: "normal", token: token() },
      { fetch: vi.fn().mockResolvedValue(completed("")) as never },
    );
    expect(r).toMatchObject({ status: "error", reason: "invalid_image" });
    expect(updates[0]).toMatchObject({ status: "invalid_image", failure_reason: "empty_image" });
  });
  it("Stream ohne Abschlussereignis → Fehler", async () => {
    const r = await generateVisual(
      fakeDb().db,
      { userId: "u1", scope: "normal", token: token() },
      { fetch: vi.fn().mockResolvedValue(new Response("", { status: 200 })) as never },
    );
    expect(r).toMatchObject({ status: "error", reason: "provider_error" });
  });
  it("ungültiges Token → kein Aufruf, keine Zeile", async () => {
    const { db, inserts } = fakeDb();
    const f = vi.fn();
    const r = await generateVisual(
      db,
      { userId: "u1", scope: "normal", token: "abc.def" },
      { fetch: f as never },
    );
    expect(r).toMatchObject({ status: "blocked", reason: "invalid_token" });
    expect(f).not.toHaveBeenCalled();
    expect(inserts).toHaveLength(0);
  });
});

describe("Integration und Darstellung", () => {
  it("Markierung wird vor Speicherung entfernt; Memory erhält nie das Bild", () => {
    const i = engine.indexOf("extractVisualMarker(spoken.status");
    expect(i).toBeGreaterThan(0);
    expect(
      engine.indexOf('db.from("orb_messages")', i) === -1 ||
        engine.indexOf("stripFakePauseClaim(visualSplit.text)") > 0,
    ).toBe(true);
    expect(engine).not.toMatch(/orb_nodes[\s\S]{0,200}b64_json/);
    expect(engine).not.toContain("generateVisual");
  });
  it("Bildaufruf nur nach gültigem Intent; kein Zusatzaufruf bei normalen Antworten", () => {
    expect(fns).toMatch(
      /if \(visualMarker\)[\s\S]*validateVisualIntent[\s\S]*if \(check\.ok\)[\s\S]*signVisualIntent/,
    );
    const sendBody = fns.slice(
      fns.indexOf("export const sendOrbInput"),
      fns.indexOf("export const generateOrbVisual"),
    );
    expect(sendBody).not.toContain("generateVisual(");
    expect(page).toMatch(/if \(turn\.visual\)[\s\S]{0,800}generateVisual\(/);
  });
  it("Ladezustand, Bild und Fehlermeldung als eigene ORB-Nachricht", () => {
    const base = { key: "k", afterMessageId: "m", kind: "explicit" as const };
    expect(
      renderToStaticMarkup(
        createElement(OrbVisualMessage, { item: { ...base, status: "loading" } }),
      ),
    ).toContain("ORB erstellt ein Bild");
    expect(
      renderToStaticMarkup(
        createElement(OrbVisualMessage, {
          item: { ...base, status: "ok", src: "data:image/png;base64,AAA" },
        }),
      ),
    ).toContain('src="data:image/png;base64,AAA"');
    expect(
      renderToStaticMarkup(
        createElement(OrbVisualMessage, {
          item: { ...base, status: "error", message: "Für heute ist das Bildlimit erreicht." },
        }),
      ),
    ).toContain("Bildlimit");
  });
});
