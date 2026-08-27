/**
 * Übersetzung – Verhalten bei erschöpftem KI-Kontingent.
 *
 * Ein `402`/`403` des AI-Gateways ist kein Codefehler: die Nachricht bleibt
 * unverändert nutzbar, die Oberfläche erhält den eindeutigen Zustand `quota`
 * und es wird kein weiterer Aufruf abgesetzt. Vorübergehende Fehler (`429`,
 * `5xx`) bleiben `unavailable`.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { AiGatewayError, detectAndTranslate, isQuotaError } from "@/lib/translate.server";
import { translateMessageForViewer } from "@/lib/translate-message.server";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

function gateway(status: number, body = "") {
  globalThis.fetch = vi.fn(async () =>
    status === 200
      ? new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({ source_language: "de", translated_text: "Hi there" }),
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        )
      : new Response(body, { status }),
  ) as unknown as typeof fetch;
}

/** Minimaler Supabase-Ersatz: liefert eine Textnachricht ohne Cache-Treffer. */
function client() {
  const message = {
    id: "11111111-1111-4111-8111-111111111111",
    conversation_id: "22222222-2222-4222-8222-222222222222",
    kind: "text",
    body: "Moin, alles fit?",
    media_url: null,
    chat_slang_tag_id: null,
    source_language: null,
    transcript: null,
  };
  const table = (name: string) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({ data: name === "messages" ? message : null, error: null }),
      update: () => ({ eq: async () => ({ error: null }) }),
      upsert: async () => ({ error: null }),
      insert: async () => ({ error: null }),
    };
    return chain;
  };
  return { from: table } as never;
}

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({
      update: () => ({ eq: async () => ({ error: null }) }),
      upsert: async () => ({ error: null }),
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
    }),
    storage: { from: () => ({ download: async () => ({ data: null, error: "n/a" }) }) },
  },
}));

describe("Gateway-Fehlerklassen", () => {
  it("erkennt endgültige Kontingent-Fehler", () => {
    expect(isQuotaError(new AiGatewayError(402, "Not enough credits"))).toBe(true);
    expect(isQuotaError(new AiGatewayError(403, "blocked"))).toBe(true);
  });

  it("behandelt vorübergehende Fehler nicht als Kontingent-Fehler", () => {
    expect(isQuotaError(new AiGatewayError(429, "slow down"))).toBe(false);
    expect(isQuotaError(new AiGatewayError(500, "upstream"))).toBe(false);
    expect(isQuotaError(new Error("boom"))).toBe(false);
  });

  it("gibt den Status des Gateways weiter", async () => {
    process.env["LOVABLE_API_KEY"] = "test-key";
    gateway(402, JSON.stringify({ message: "Not enough credits" }));
    await expect(detectAndTranslate("Moin", "en")).rejects.toMatchObject({ status: 402 });
  });
});

describe("Nachrichtenübersetzung", () => {
  it("meldet erschöpftes Kontingent als eigenen Zustand", async () => {
    process.env["LOVABLE_API_KEY"] = "test-key";
    gateway(402, JSON.stringify({ message: "Not enough credits" }));
    const res = await translateMessageForViewer(
      client(),
      "11111111-1111-4111-8111-111111111111",
      "en",
    );
    expect(res.status).toBe("quota");
    expect(res.text).toBe("");
  });

  it("bleibt bei vorübergehenden Fehlern auf `unavailable`", async () => {
    process.env["LOVABLE_API_KEY"] = "test-key";
    gateway(503, "upstream down");
    const res = await translateMessageForViewer(
      client(),
      "11111111-1111-4111-8111-111111111111",
      "en",
    );
    expect(res.status).toBe("unavailable");
  });

  it("übersetzt bei verfügbarem Kontingent normal", async () => {
    process.env["LOVABLE_API_KEY"] = "test-key";
    gateway(200);
    const res = await translateMessageForViewer(
      client(),
      "11111111-1111-4111-8111-111111111111",
      "en",
    );
    expect(res.status).toBe("ready");
    expect(res.text).toBe("Hi there");
    expect(res.sourceLanguage).toBe("de");
  });

  it("löst genau einen Gateway-Aufruf je Versuch aus", async () => {
    process.env["LOVABLE_API_KEY"] = "test-key";
    gateway(402, "Not enough credits");
    await translateMessageForViewer(client(), "11111111-1111-4111-8111-111111111111", "en");
    expect((globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(
      1,
    );
  });
});
