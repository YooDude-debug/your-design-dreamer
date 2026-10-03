/**
 * ORB CORE – P0 Chat Input Repair.
 * Text: gemeinsame 20.000-Zeichen-Grenze, keine stille Kürzung.
 * Bilder: geprüfte Bilder erreichen den aktiven Gateway-Aufruf; Status ehrlich.
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  ORB_MESSAGE_MAX_CHARS,
  ORB_MESSAGE_TOO_LONG,
  validateImageAttachment,
  validateImageAttachments,
} from "@/lib/orb-attachments";
import { generateReply } from "@/orb-core/llm/select.server";

const read = (p: string) => readFileSync(p, "utf8");
const chat = read("src/components/orb/OrbChat.tsx");
const adapter = read("src/integrations/y-dude-orb/orb.functions.ts");
const bridge = read("src/lib/orb-chat-bridge.functions.ts");
const engine = read("src/orb-core/engine.server.ts");
const provider = read("src/orb-core/llm/provider.server.ts");

const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const JPEG = btoa(
  String.fromCharCode(0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1),
);
const GIF = btoa("GIF89a\x01\x00\x01\x00\x00\x00\x00;xxxxxx");
const WEBP = btoa("RIFF\x1a\x00\x00\x00WEBPVP8 xxxxxxxx");

function sse(text: string): Response {
  const body = [
    `data: ${JSON.stringify({ type: "response.output_text.delta", delta: text })}`,
    "data: [DONE]",
    "",
  ].join("\n");
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

/** Gleiches Schema wie sendOrbInput.text. */
const textSchema = z.string().max(ORB_MESSAGE_MAX_CHARS, ORB_MESSAGE_TOO_LONG);

describe("P0 Text – eine gemeinsame Grenze", () => {
  it("Grenze ist 20.000 Zeichen", () => expect(ORB_MESSAGE_MAX_CHARS).toBe(20_000));

  it.each([999, 1000, 1001, 5000, 20_000])("%i Zeichen werden unverändert angenommen", (n) => {
    const t = "a".repeat(n);
    expect(textSchema.parse(t)).toBe(t);
  });

  it("20.001 Zeichen werden mit verständlicher Meldung abgelehnt (keine Kürzung)", () => {
    const r = textSchema.safeParse("a".repeat(20_001));
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe(ORB_MESSAGE_TOO_LONG);
  });

  it("Emojis und mehrsprachiger Text zählen in UTF-16 und bleiben byte-gleich", () => {
    const t = "Grüße 👋🏽 مرحبا 你好 ".repeat(500);
    expect(textSchema.parse(t)).toBe(t);
    expect("👋".length).toBe(2);
    expect(textSchema.safeParse("👋".repeat(10_001)).success).toBe(false);
  });

  it("alle Stellen nutzen dieselbe Konstante, keine 1000er-Grenze mehr", () => {
    expect(chat).not.toContain("maxLength={1000}");
    expect(chat).not.toContain("slice(0, 1000)");
    expect(chat).toContain("value.length > ORB_MESSAGE_MAX_CHARS");
    expect(chat).toContain('data-testid="orb-char-count"');
    expect(adapter).toContain("z.string().max(ORB_MESSAGE_MAX_CHARS, ORB_MESSAGE_TOO_LONG)");
    expect(bridge).toContain("z.string().min(1).max(ORB_MESSAGE_MAX_CHARS)");
    expect(engine).toContain(
      "if (text.length > ORB_MESSAGE_MAX_CHARS) throw new Error(ORB_MESSAGE_TOO_LONG)",
    );
    expect(engine).not.toContain("rawText.trim().slice(0, MAX_INPUT_CHARS)");
  });

  it("Verlauf früherer Nachrichten bleibt getrennt bei 160 Zeichen", () => {
    expect(read("src/orb-core/context.ts")).toContain("m.body.slice(0, 160)");
  });
});

describe("P0 Bilder – Validierung bleibt", () => {
  it.each([
    ["image/png", PNG],
    ["image/jpeg", JPEG],
    ["image/gif", GIF],
    ["image/webp", WEBP],
  ])("%s mit echter Signatur ist gültig", (mimeType, dataBase64) => {
    expect(validateImageAttachment({ mimeType, dataBase64 }).ok).toBe(true);
  });
  it("ungültiger MIME-Typ wird abgelehnt", () => {
    expect(validateImageAttachment({ mimeType: "application/pdf", dataBase64: PNG }).ok).toBe(
      false,
    );
  });
  it("manipulierte Endung (JPEG-Typ, PNG-Inhalt) wird abgelehnt", () => {
    expect(validateImageAttachment({ mimeType: "image/jpeg", dataBase64: PNG }).ok).toBe(false);
  });
  it("über 5 MB wird abgelehnt", () => {
    const big = PNG + "A".repeat(Math.ceil((5 * 1024 * 1024 * 4) / 3) + 8);
    expect(validateImageAttachment({ mimeType: "image/png", dataBase64: big }).ok).toBe(false);
  });
  it("mehr als 3 Bilder werden abgelehnt", () => {
    const item = { mimeType: "image/png", dataBase64: PNG };
    expect(validateImageAttachments([item, item, item, item]).ok).toBe(false);
  });
});

describe("P0 Bilder – Übergabe an den aktiven Modellaufruf", () => {
  beforeEach(() => vi.stubEnv("LOVABLE_API_KEY", "test-key"));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("Bilddaten stehen als input_image im Gateway-Request; Status = verarbeitet", async () => {
    const f = vi.fn(async (_u: string, _i: RequestInit) => sse("Ein Pixel."));
    vi.stubGlobal("fetch", f);
    const r = await generateReply({
      system: "S",
      text: "Was siehst du?",
      images: [
        { mimeType: "image/png", dataBase64: PNG },
        { mimeType: "image/jpeg", dataBase64: JPEG },
      ],
    });
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe("https://ai.gateway.lovable.dev/v1/responses");
    const body = JSON.parse(String(init.body));
    expect(body).not.toHaveProperty("max_tokens");
    const content = body.input[0].content;
    expect(content[0]).toEqual({ type: "input_text", text: "Was siehst du?" });
    expect(content[1]).toEqual({ type: "input_image", image_url: `data:image/png;base64,${PNG}` });
    expect(content[2]).toEqual({
      type: "input_image",
      image_url: `data:image/jpeg;base64,${JPEG}`,
    });
    expect(r.meta.imagesSent).toBe(2);
    expect(r.meta.imageContextProcessed).toBe(true);
  });

  it("langer Text kommt unverändert im Request an", async () => {
    const f = vi.fn(async (_u: string, _i: RequestInit) => sse("ok"));
    vi.stubGlobal("fetch", f);
    const long = "Wort 🌍 ".repeat(2_500).trim();
    await generateReply({ system: "S", text: long });
    const body = JSON.parse(String(f.mock.calls[0]![1].body));
    expect(body.input[0].content[0].text).toBe(long);
    expect(body.input[0].content).toHaveLength(1);
  });

  it.each([
    ["HTTP 500", () => new Response("x", { status: 500 })],
    ["Quota 402", () => new Response("x", { status: 402 })],
    ["leere Antwort", () => sse("")],
  ])("%s → Bild gilt als nicht verarbeitet", async (_n, make) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => make()),
    );
    const r = await generateReply({
      system: "S",
      text: "t",
      images: [{ mimeType: "image/png", dataBase64: PNG }],
    });
    expect(r.meta.imagesSent).toBe(0);
    expect(r.meta.imageContextProcessed).toBe(false);
  });

  it("Base64 wird nicht geloggt und nicht gespeichert", () => {
    expect(provider).not.toMatch(/console\.[a-z]+\([^)]*(image|dataBase64)/);
    expect(engine).not.toMatch(/orb_messages[\s\S]{0,400}dataBase64/);
    expect(engine).not.toMatch(/orb_nodes[\s\S]{0,400}dataBase64/);
  });
});
