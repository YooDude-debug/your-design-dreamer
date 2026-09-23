/**
 * ORB Core – Provider-Auswahl der Sprachschicht (experimenteller Bereich).
 *
 * Regeln (v1, ohne Ausnahmen):
 *  - `OPENAI_API_KEY` gesetzt → genau ein OpenAI-Versuch.
 *  - OpenAI fehlerhaft (Fehler, Timeout, leer) → bestehende Sprachschicht.
 *  - Kein OpenAI-Schlüssel → bestehende Sprachschicht, wie bisher.
 *  - Keine automatischen Wiederholungen, kein Modellwechsel, keine UI-Auswahl.
 *
 * Bildanhänge sind flüchtiger Anfragekontext: sie gehen ausschliesslich an den
 * multimodalen OpenAI-Pfad. Die bestehende Fallback-Sprachschicht bleibt
 * unverändert textbasiert; dann wird der Bildkontext ausdrücklich als nicht
 * verarbeitet gemeldet (keine erfundene Bildanalyse).
 */

import type { OrbImageAttachment } from "@/lib/orb-attachments";
import { hasOpenAiCredentials, speakViaOpenAI } from "@/orb-core/llm/openai.server";
import type { OrbEventContext } from "@/orb-core/observability.server";
import {
  speakViaLovableGateway,
  type OrbLlmMeta,
  type OrbLlmStatus,
} from "@/orb-core/llm/provider.server";

export type OrbLlmResult = { reply: string; status: OrbLlmStatus; meta: OrbLlmMeta };

export async function generateReply(input: {
  system: string;
  text: string;
  images?: OrbImageAttachment[];
  /** P3 Observability: Ereigniskontext, nur zur Korrelation der Aufrufe. */
  obs?: OrbEventContext;
}): Promise<OrbLlmResult> {
  const images = input.images ?? [];

  if (hasOpenAiCredentials()) {
    const openai = await speakViaOpenAI(input.system, input.text, images, input.obs);
    if (openai) {
      return {
        reply: openai.reply,
        status: "ok",
        meta: {
          provider: "openai",
          fallbackUsed: false,
          reason: null,
          imagesSent: images.length,
          imageContextProcessed: images.length > 0,
        },
      };
    }
    // Fallback: die bestehende Sprachschicht übernimmt vollständig (nur Text).
    const local = await speakViaLovableGateway(input.system, input.text, input.obs);
    return {
      reply: local.reply,
      status: local.status,
      meta: {
        provider: "local",
        fallbackUsed: true,
        reason: "OpenAI nicht erreichbar – bestehende Sprachschicht verwendet.",
        imagesSent: 0,
        imageContextProcessed: false,
      },
    };
  }

  const local = await speakViaLovableGateway(input.system, input.text, input.obs);
  return {
    reply: local.reply,
    status: local.status,
    meta: {
      provider: "local",
      fallbackUsed: false,
      reason: null,
      imagesSent: 0,
      imageContextProcessed: false,
    },
  };
}
