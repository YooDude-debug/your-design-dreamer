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
import {
  OPENAI_LLM_MODEL,
  hasOpenAiCredentials,
  speakViaOpenAI,
} from "@/orb-core/llm/openai.server";
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

  it("mit OPENAI_API_KEY wird OpenAI mit dem festen Modell aufgerufen", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const bodies: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo, init?: RequestInit) => {
        // init.body ist hier der serialisierte JSON-String des Aufrufs.
        bodies.push(JSON.parse(String(init?.body ?? "{}")));
        return openAiResponse("Schönen Gruss!");
      }),
    );

    const result = await generateReply({ system: SYSTEM, text: "hallo" });

    expect(result.meta.provider).toBe("openai");
    expect(result.meta.fallbackUsed).toBe(false);
    expect(result.reply).toBe("Schönen Gruss!");
    const body = bodies[0] as { model: string; messages: { role: string }[] };
    expect(body.model).toBe(OPENAI_LLM_MODEL);
    expect(body.messages).toEqual([
      { role: "system", content: SYSTEM },
      { role: "user", content: "hallo" },
    ]);
  });

  it("bei OpenAI-Fehler fällt ORB auf die bestehende Sprachschicht zurück", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const calls: Request[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo, init?: RequestInit) => {
        const req = new Request(input, init);
        calls.push(req);
        if (req.url.includes("api.openai.com")) return new Response("boom", { status: 500 });
        return sseResponse("Fallback-Antwort");
      }),
    );

    const result = await generateReply({ system: SYSTEM, text: "hallo" });

    expect(result.meta.provider).toBe("local");
    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.reason).toBeTruthy();
    expect(result.reply).toBe("Fallback-Antwort");
    expect(result.status).toBe("ok");
    expect(calls).toHaveLength(2);
    expect(calls.filter((c) => c.url.includes("api.openai.com"))).toHaveLength(1);
  });

  it("bei leerer OpenAI-Antwort wird ebenfalls gefallen", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo, init?: RequestInit) => {
        const req = new Request(input, init);
        if (req.url.includes("api.openai.com")) return openAiResponse("   ");
        return sseResponse("Noch da.");
      }),
    );

    const result = await generateReply({ system: SYSTEM, text: "hallo" });

    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.reply).toBe("Noch da.");
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
