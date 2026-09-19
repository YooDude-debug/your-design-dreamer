/**
 * ORB Core – bestehende Sprachschicht (Lovable AI Gateway) als Provider.
 *
 * Diese Logik ist unverändert aus `engine.server.ts` übernommen und bleibt
 * der verpflichtende Fallback: ohne OPENAI_API_KEY läuft ORB genau wie bisher
 * über diesen Weg. Das Modell wird gestreamt, der Datenstrom serverseitig
 * gesammelt (gleiche Semantik wie zuvor).
 */

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const TEXT_MODEL = "openai/gpt-6-astra";

export type OrbLlmStatus = "ok" | "quota" | "unavailable";

/** Diagnose ohne Inhalt: welche Schicht hat formuliert, ob gefallen wurde. */
export type OrbLlmMeta = {
  provider: "openai" | "local";
  fallbackUsed: boolean;
  reason: string | null;
  /** Anzahl der mitgesendeten Bilder (nur Diagnose, kein Inhalt). */
  imagesSent?: number;
  /** Wurde ein vorhandener Bildkontext tatsächlich ausgewertet? */
  imageContextProcessed?: boolean;
};

export async function speakViaLovableGateway(
  system: string,
  text: string,
): Promise<{ reply: string; status: OrbLlmStatus }> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return { reply: "", status: "unavailable" };

  try {
    // Reasoning-Modell: der Aufruf muss streamen, sonst reisst die Verbindung
    // bei langen Denkphasen ab. Der Datenstrom wird serverseitig gesammelt.
    const res = await fetch(`${GATEWAY}/responses`, {
      method: "POST",
      headers: {
        "Lovable-API-Key": key,
        "Content-Type": "application/json",
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        instructions: system,
        input: [{ role: "user", content: [{ type: "input_text", text }] }],
        stream: true,
        store: false,
        reasoning: { effort: "low", summary: "auto" },
      }),
    });
    if (res.status === 402 || res.status === 403) return { reply: "", status: "quota" };
    if (!res.ok || !res.body) return { reply: "", status: "unavailable" };

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let reply = "";
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const event = JSON.parse(payload) as {
            type?: string;
            delta?: string;
            response?: { output_text?: string };
          };
          if (event.type === "response.output_text.delta" && event.delta) reply += event.delta;
          else if (event.type === "response.completed" && event.response?.output_text) {
            reply = event.response.output_text;
          }
        } catch {
          // Unvollständige oder unbekannte Ereignisse werden übergangen.
        }
      }
    }

    const clean = reply.trim();
    return clean ? { reply: clean, status: "ok" } : { reply: "", status: "unavailable" };
  } catch {
    return { reply: "", status: "unavailable" };
  }
}
