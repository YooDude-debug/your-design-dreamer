/**
 * Y-Dude ORB Adapter – öffentliche Server-Funktionen (nur angemeldet).
 *
 * Diese Datei ist die einzige Verbindung zwischen Y-Dude und ORB. Sie prüft die
 * Anmeldung, prüft die Eingaben und ruft ausschliesslich die SDK-Fassade
 * (`@/orb-sdk/orb-core.server`) auf. Geschützte Kernlogik wird hier nicht
 * berührt und nicht dupliziert; der KI-Schlüssel bleibt serverseitig.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Zustand, Ziele, Erinnerungen, Interessen, Vorschläge und Kennzahlen. */
export const getOrbSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { createOrbCore } = await import("@/orb-sdk/orb-core.server");
    return createOrbCore({ data: context.supabase, userId: context.userId }).getSnapshot();
  });

/** Eine Erfahrung verarbeiten (Abruf → Entscheidung → Sprache → Lernen). */
export const sendOrbInput = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ text: z.string().min(1).max(1000), viaVoice: z.boolean().optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { createOrbCore } = await import("@/orb-sdk/orb-core.server");
    return createOrbCore({ data: context.supabase, userId: context.userId }).processInput(
      data.text,
      { source: "user_stated" },
    );
  });

/**
 * Curiosity Core: eine einzelne selbstgenerierte Frage aus eigener Neugier.
 * Wird nur ereignisbasiert aufgerufen (Leerlauf-Beobachter im Browser); der
 * Core prüft Wissenslücke, Neugier, Cooldown und Duplikate endgültig.
 */
export const requestOrbCuriosity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { createOrbCore } = await import("@/orb-sdk/orb-core.server");
    return createOrbCore({ data: context.supabase, userId: context.userId }).evaluateCuriosity();
  });

/** Testbereich: aktuelle Neugier, offene Wissenslücken und Entscheidung (nur lesend). */
export const inspectOrbCuriosity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { createOrbCore } = await import("@/orb-sdk/orb-core.server");
    return createOrbCore({ data: context.supabase, userId: context.userId }).inspectCuriosity();
  });

/** Ausdrückliches Lernereignis („Riss“) mit hoher Wichtigkeit. */
export const recordOrbLearning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ lesson: z.string().min(1).max(1000) }).parse(data))
  .handler(async ({ data, context }) => {
    const { createOrbCore } = await import("@/orb-sdk/orb-core.server");
    return createOrbCore({ data: context.supabase, userId: context.userId }).learn(data.lesson);
  });

/** Rückmeldung zu einer Erinnerung: positiv verstärkt, negativ schwächt ab. */
export const sendOrbFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ nodeId: z.string().uuid(), kind: z.enum(["positive", "negative"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { createOrbCore } = await import("@/orb-sdk/orb-core.server");
    return createOrbCore({ data: context.supabase, userId: context.userId }).recordFeedback(data);
  });

/** Level 1: zugängliche Feed-Beiträge beobachten (nur lesen) und bewerten. */
export const observeOrbFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { createOrbCore } = await import("@/orb-sdk/orb-core.server");
    return createOrbCore({ data: context.supabase, userId: context.userId }).observeFeed();
  });

/** Level 2: Entscheidung des Benutzers zu einem Vorschlag – wird gelernt. */
export const decideOrbSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ suggestionId: z.string().uuid(), accepted: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { createOrbCore } = await import("@/orb-sdk/orb-core.server");
    return createOrbCore({ data: context.supabase, userId: context.userId }).decideSuggestion(data);
  });

/** Spracheingabe: Aufnahme (WAV, base64) → deutscher Text. */
export const transcribeOrbAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ audioBase64: z.string().min(100).max(12_000_000) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { orbVoice } = await import("@/orb-sdk/orb-core.server");
    return orbVoice.transcribe(data.audioBase64);
  });

/** Sprachausgabe: deutscher Text → MP3 (base64). Nur auf Knopfdruck. */
export const speakOrbReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ text: z.string().min(1).max(600) }).parse(data))
  .handler(async ({ data }) => {
    const { orbVoice } = await import("@/orb-sdk/orb-core.server");
    return orbVoice.synthesize(data.text);
  });
