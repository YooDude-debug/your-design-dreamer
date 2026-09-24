/**
 * ORB OpenAI LLM-Provider Tests (Staging-Experiment).
 *
 * Geprüft wird ausschliesslich das Verhalten der Sprachschicht-Auswahl:
 * festes Modell, serverseitiger Schlüssel, genau ein Versuch, Fallback auf die
 * bestehende Sprachschicht, Memory-Schutz (LLM-Antworten werden nie als
 * Memory gespeichert) und unveränderte Kernkonstanten.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateReply } from "@/orb-core/llm/select.server";
import { hasOpenAiCredentials, speakViaOpenAI } from "@/orb-core/llm/openai.server";
import { buildSpeakSystemPrompt } from "@/orb-core/llm/prompt.server";

const ROOT = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

/** SSE-Strom wie er vom Lovable AI Gateway kommt. */
function sseResponse(text: string): Response {
  const payload = [
    `data: ${JSON.stringify({ type: "response.output_text.delta", delta: text })}`,
    "data: [DONE]",
    "",
  ].join("\n");
  return new Response(payload, { status: 200, headers: { "content-type": "text/event-stream" } });
}

function openAiResponse(text: string): Response {
  return Response.json({
    choices: [{ message: { content: text } }],
  });
}

const SYSTEM = "Du bist ORB Core. Antworte auf Deutsch.";

beforeEach(() => {
  vi.stubEnv("LOVABLE_API_KEY", "test-lovable-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("orb llm provider – Auswahl", () => {
  it("ohne OPENAI_API_KEY wird die bestehende Sprachschicht ohne Fallback verwendet", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const calls: Request[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo, init?: RequestInit) => {
        calls.push(new Request(input, init));
        return sseResponse("Hallo!");
      }),
    );

    const result = await generateReply({ system: SYSTEM, text: "hallo" });

    expect(result.meta.provider).toBe("local");
    expect(result.meta.fallbackUsed).toBe(false);
    expect(result.reply).toBe("Hallo!");
    expect(result.status).toBe("ok");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("ai.gateway.lovable.dev/v1/responses");
    expect(hasOpenAiCredentials()).toBe(false);
  });

  it("Option B: auch mit OPENAI_API_KEY genau ein Aufruf, nur Gateway, kein gpt-4o-mini", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const calls: Request[] = [];
    const bodies: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo, init?: RequestInit) => {
        calls.push(new Request(input, init));
        bodies.push(String(init?.body ?? ""));
        return sseResponse("Gateway-Antwort");
      }),
    );

    const result = await generateReply({ system: SYSTEM, text: "hallo" });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("ai.gateway.lovable.dev/v1/responses");
    expect(calls.some((c) => c.url.includes("api.openai.com"))).toBe(false);
    expect(bodies.join("")).not.toContain("gpt-4o-mini");
    expect(bodies[0]).toContain("openai/gpt-6-astra");
    expect(result.meta.provider).toBe("local");
    expect(result.meta.fallbackUsed).toBe(false);
    expect(result.reply).toBe("Gateway-Antwort");
    expect(result.status).toBe("ok");
  });

  it("Option B: Gateway-Fehler erzeugt keine zweite Modellanfrage", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const f = vi.fn(async () => new Response("boom", { status: 500 }));
    vi.stubGlobal("fetch", f);

    const result = await generateReply({ system: SYSTEM, text: "hallo" });

    expect(f).toHaveBeenCalledTimes(1);
    expect(result.status).not.toBe("ok");
    expect(result.meta.fallbackUsed).toBe(false);
  });

  it("Option B: Bilder – bestehendes Verhalten (nicht gesendet, als nicht verarbeitet gemeldet)", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const f = vi.fn(async () => sseResponse("ok"));
    vi.stubGlobal("fetch", f);

    const result = await generateReply({
      system: SYSTEM,
      text: "bild",
      images: [{ mimeType: "image/png", dataBase64: "iVBORw0KGgo=" }],
    });

    expect(f).toHaveBeenCalledTimes(1);
    expect(result.meta.imagesSent).toBe(0);
    expect(result.meta.imageContextProcessed).toBe(false);
  });

  it("select.server importiert den direkten OpenAI-Pfad nicht mehr", () => {
    const src = read("src/orb-core/llm/select.server.ts");
    expect(src).not.toContain("speakViaOpenAI");
    expect(src).not.toContain("openai.server");
    expect(src).not.toContain("gpt-4o-mini");
  });

  it("ohne jeden Schlüssel bleibt der Status unavailable (kein erfundener Text)", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("LOVABLE_API_KEY", "");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("should not be called");
      }),
    );

    const result = await generateReply({ system: SYSTEM, text: "hallo" });

    expect(result.reply).toBe("");
    expect(result.status).toBe("unavailable");
  });
});

describe("orb llm provider – openai.server", () => {
  it("liest den Schlüssel nur serverseitig zur Laufzeit", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(hasOpenAiCredentials()).toBe(false);
    vi.stubEnv("OPENAI_API_KEY", "sk-x");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => openAiResponse("Antwort")),
    );
    expect(hasOpenAiCredentials()).toBe(true);
    expect(await speakViaOpenAI(SYSTEM, "hallo")).toEqual({ reply: "Antwort" });
  });

  it("liefert null statt Ausnahme bei Netzwerkfehler (genau ein Versuch)", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-x");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    expect(await speakViaOpenAI(SYSTEM, "hallo")).toBeNull();
  });

  it("enthält ein Zeitlimit und keine Retry-Schleife", () => {
    const src = read("src/orb-core/llm/openai.server.ts");
    expect(src).toContain("AbortSignal.timeout");
    expect(src).not.toMatch(/for\s*\(\s*let\s+attempt/);
    expect(src).not.toContain("maxRetries");
  });
});

describe("orb llm provider – Prompt", () => {
  it("baut den System-Prompt aus Zustand, Erinnerung, Entscheidung und Kontext", () => {
    const prompt = buildSpeakSystemPrompt({
      state: {
        curiosity: 0.5,
        joy: 0.4,
        fear: 0.1,
        trust: 0.6,
        uncertainty: 0.2,
        energy: 0.7,
      },
      goals: ["help_user"],
      decision: "answer",
      recalled: ["Ich esse gern Schnitzel"],
      interests: [],
      context: "Du: hi || ORB: Hallo",
    });
    expect(prompt).toContain("Neugier 0.50");
    expect(prompt).toContain("Ich esse gern Schnitzel");
    expect(prompt).toContain("flüchtiger Kontext");
    expect(prompt).not.toContain("sk-");
    expect(prompt).not.toContain("api.openai.com");
  });
});

describe("orb llm provider – Memory-Schutz & Grenzen", () => {
  it("OPENAI_API_KEY wird nur in openai.server.ts referenziert", () => {
    // Kommentare/Dokumentation dürfen den Namen nennen; Code darf ihn nicht.
    const stripComments = (s: string) =>
      s
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
        .replace(/`[^`]*`/g, "");
    const hits: string[] = [];
    for (const file of [
      "src/orb-core/engine.server.ts",
      "src/orb-core/llm/select.server.ts",
      "src/orb-core/llm/provider.server.ts",
      "src/orb-core/llm/prompt.server.ts",
      "src/orb-sdk/orb-core.server.ts",
      "src/integrations/y-dude-orb/orb.functions.ts",
      "src/routes/_authenticated/channels.orb.tsx",
    ]) {
      if (stripComments(read(file)).includes("OPENAI_API_KEY")) hits.push(file);
    }
    expect(hits).toEqual([]);
  });

  it("kein VITE_-Zugriff auf den Schlüssel und keine Client-Importe", () => {
    const src = read("src/orb-core/llm/openai.server.ts");
    expect(src).not.toContain("VITE_");
    expect(src).not.toContain("@/integrations/supabase");
  });

  it("die LLM-Antwort wird nur als ORB-Nachricht gespeichert, nie als Memory-Knoten", () => {
    const src = read("src/orb-core/engine.server.ts");
    // Antwort landet in der Gesprächsablage als Rolle "orb".
    expect(src).toMatch(/role: "orb",\s*\n\s*body: reply,/);
    // Memory-Knoten entstehen weiterhin ausschliesslich aus dem Nutzer-Input
    // (bzw. der aufgelösten Merk-Aufforderung) – nie aus der LLM-Antwort.
    expect(src).toContain("content: memoryText,");
    expect(src).not.toMatch(/content: reply/);
    expect(src).not.toMatch(/content: spoken\.reply/);
  });

  it("die Persistenz-Schwelle der bestehenden Logik bleibt unverändert (0.35)", async () => {
    const { shouldPersist } = await import("@/orb-core/core");
    expect(shouldPersist(0.25)).toBe(false);
    expect(shouldPersist(0.5)).toBe(true);
  });
});
