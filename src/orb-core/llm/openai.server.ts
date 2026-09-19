/**
 * ORB Core – OpenAI-Provider (Experiment, serverseitig).
 *
 * Ruft die OpenAI API direkt auf. Gilt nur, wenn `OPENAI_API_KEY` als
 * serverseitiges Secret gesetzt ist. Der Schlüssel wird ausschliesslich hier
 * und nur zur Laufzeit gelesen – niemals im Browser, nie in Logs oder Antworten.
 *
 * v1: festes Modell, gebündelte Antwort (kein Streaming), genau ein Versuch.
 * Bei Fehler, Timeout oder leerer Antwort wird `null` geliefert; die Auswahl
 * (`select.server`) fällt dann auf die bestehende Sprachschicht zurück.
 */

import {
  ORB_IMAGE_MAX_COUNT,
  toImageDataUrl,
  type OrbImageAttachment,
} from "@/lib/orb-attachments";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

/** Fest definiertes Modell für v1 – keine Modellwahl, keine Auswahloberfläche. */
export const OPENAI_LLM_MODEL = "gpt-4o-mini";

/** Hartes Zeitlimit eines einzigen Versuchs; danach Fallback. */
const OPENAI_TIMEOUT_MS = 20_000;

/** Kostenschutz: ORB antwortet kurz (max. drei Sätze). */
const OPENAI_MAX_TOKENS = 300;

/** Nur Existenzprüfung – der Wert selbst verlässt den Server nie. */
export function hasOpenAiCredentials(): boolean {
  return Boolean(process.env["OPENAI_API_KEY"]);
}

/**
 * Ein einziger, gebündelter OpenAI-Aufruf. Liefert `null` bei fehlendem
 * Schlüssel, HTTP-Fehler, Timeout oder leerer Antwort – niemals eine Ausnahme
 * und niemals eine Wiederholung.
 */
export async function speakViaOpenAI(
  system: string,
  text: string,
  images: OrbImageAttachment[] = [],
): Promise<{ reply: string } | null> {
  const key = process.env["OPENAI_API_KEY"];
  if (!key) return null;

  // Bilder sind flüchtiger Anfragekontext: sie werden als Bildblöcke neben dem
  // Text übergeben, nicht gespeichert und nie an das Gedächtnis weitergereicht.
  const userContent: unknown =
    images.length > 0
      ? [
          { type: "text", text },
          ...images.slice(0, ORB_IMAGE_MAX_COUNT).map((image) => ({
            type: "image_url",
            image_url: { url: toImageDataUrl(image) },
          })),
        ]
      : text;

  try {
    const res = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_LLM_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
        max_tokens: OPENAI_MAX_TOKENS,
      }),
      signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const reply = data.choices?.[0]?.message?.content?.trim() ?? "";
    return reply ? { reply } : null;
  } catch {
    // Fehler, Timeout, leere Antwort: Fallback entscheidet weiter.
    return null;
  }
}
