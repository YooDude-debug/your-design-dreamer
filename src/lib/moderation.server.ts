/**
 * Server-seitige Audio-Moderation für SlangTags.
 *
 * Ablauf: Audio aus dem Medienspeicher laden → Speech-to-Text (OpenAI)
 * → Inhaltsprüfung des Transkripts (OpenAI) → Musik-/Gesangserkennung
 * direkt auf dem Audio → automatische Entscheidung. Unsichere Fälle gehen
 * in die manuelle Moderation. Jede Entscheidung wird protokolliert.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  MODERATION_CATEGORIES,
  statusMessage,
  type ModerationDecision,
  type ModerationQueueFilter,
  type ModerationQueueRow,
  type ModerationResult,
  type ModerationStatus,
} from "@/lib/moderation.shared";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const STT_MODEL = "openai/gpt-4o-mini-transcribe";
const TEXT_MODEL = "openai/gpt-5.4-mini";
/** Audio-fähiges Modell für die Musik-/Gesangserkennung. */
const AUDIO_MODEL = "google/gemini-3.6-flash";

/**
 * Automatische Sperre nur bei eindeutigem Verstoß (offene Beta). Grenzwertige
 * Aufnahmen – Slang, Dialekt, Flüche, derbe Sprüche – gehen in die manuelle
 * Prüfung statt sofort gesperrt zu werden.
 */
const BLOCK_THRESHOLD = 0.85;
/** Ab hier manuelle Prüfung (Beitrag/SlangTag bleibt erhalten). */
const REVIEW_THRESHOLD = 0.5;
/**
 * Musik-/Gesangssperre nur bei sehr klarer Erkennung. Sprachaufnahmen mit
 * hohen oder kindlichen Stimmen wurden zuvor zu oft als Gesang gewertet.
 */
const MUSIC_BLOCK_THRESHOLD = 0.8;

type Row = Record<string, unknown>;

function apiKey(): string {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  return key;
}

function audioFormat(path: string): { ext: string; mime: string } {
  const ext = (path.split(".").pop() ?? "webm").toLowerCase();
  const mime: Record<string, string> = {
    webm: "audio/webm",
    m4a: "audio/mp4",
    mp4: "audio/mp4",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
  };
  return { ext, mime: mime[ext] ?? "audio/webm" };
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

function parseJson(text: string): Record<string, unknown> {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return {};
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/* --------------------------------------------------------------- KI-Aufrufe */

/** Speech-to-Text über die OpenAI-Transkription. */
async function transcribe(blob: Blob, path: string): Promise<string> {
  const { ext } = audioFormat(path);
  const form = new FormData();
  form.append("model", STT_MODEL);
  form.append("file", blob, `slangtag.${ext}`);

  const res = await fetch(`${GATEWAY}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`transcription ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const json = (await res.json()) as { text?: string };
  return (json.text ?? "").trim();
}

type TextVerdict = {
  violation: boolean;
  categories: string[];
  confidence: number;
  reason: string;
  uncertain: boolean;
  spam: boolean;
};

/** Inhaltsprüfung des Transkripts gegen die Community-Richtlinien. */
async function classifyText(transcript: string): Promise<TextVerdict> {
  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TEXT_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Du bist ein strenger Content-Moderator für eine Social-Audio-Plattform. " +
            "Du bewertest kurze Sprachaufnahmen (1-5 Sekunden) anhand ihres Transkripts. " +
            "Melde nur echte Verstöße, keine harmlose Umgangssprache, Dialekte oder Slang. " +
            "Stimme, Tonhöhe, Alter oder Akzent der sprechenden Person sind kein " +
            "Bewertungskriterium: Kinderstimmen und harmlose Kindersprache sind erlaubt. " +
            "Setze uncertain=true, wenn das Transkript zu kurz, unverständlich oder nicht eindeutig bewertbar ist.",
        },
        {
          role: "user",
          content: `Transkript: """${transcript}"""\n\nErlaubte Kategorien: ${MODERATION_CATEGORIES.join(", ")}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "moderation_verdict",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              violation: { type: "boolean" },
              spam: { type: "boolean" },
              uncertain: { type: "boolean" },
              confidence: { type: "number" },
              categories: { type: "array", items: { type: "string" } },
              reason: { type: "string" },
            },
            required: ["violation", "spam", "uncertain", "confidence", "categories", "reason"],
          },
        },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`moderation ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const parsed = parseJson(json.choices?.[0]?.message?.content ?? "");
  const allowed = new Set<string>(MODERATION_CATEGORIES);
  return {
    violation: Boolean(parsed.violation),
    spam: Boolean(parsed.spam),
    uncertain: Boolean(parsed.uncertain),
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
    categories: Array.isArray(parsed.categories)
      ? (parsed.categories as string[]).filter((c) => allowed.has(c))
      : [],
    reason: typeof parsed.reason === "string" ? parsed.reason : "",
  };
}

type MusicVerdict = {
  isMusic: boolean;
  confidence: number;
  labels: string[];
  reason: string;
};

/** Musik-, Gesangs- und Tonaufnahmen-Erkennung direkt auf dem Audio. */
async function detectMusic(bytes: Uint8Array, path: string): Promise<MusicVerdict> {
  const { ext } = audioFormat(path);
  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: AUDIO_MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Analysiere diese kurze Audioaufnahme. Bestimme, ob sie überwiegend aus Musik, " +
                "Gesang, einem urheberrechtlich geschützten Lied oder einer bekannten Tonaufnahme " +
                "besteht (im Gegensatz zu gesprochener Sprache). " +
                "Gesprochene Sprache ist KEINE Musik – auch nicht bei hohen oder kindlichen " +
                "Stimmen, singender Betonung, Reimen, Rufen, Lachen oder Hintergrundgeräuschen. " +
                "Setze is_music nur true, wenn eindeutig Musik oder Gesang dominiert. " +
                "Antworte ausschließlich als JSON: " +
                '{"is_music": boolean, "confidence": number (0-1), "labels": string[] (music, singing, copyrighted_music, known_recording), "reason": string}',
            },
            {
              type: "input_audio",
              input_audio: { data: toBase64(bytes), format: ext === "mp4" ? "m4a" : ext },
            },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`music-detection ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const parsed = parseJson(json.choices?.[0]?.message?.content ?? "");
  const allowed = new Set(["music", "singing", "copyrighted_music", "known_recording"]);
  return {
    isMusic: Boolean(parsed.is_music),
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
    labels: Array.isArray(parsed.labels)
      ? (parsed.labels as string[]).filter((l) => allowed.has(l))
      : [],
    reason: typeof parsed.reason === "string" ? parsed.reason : "",
  };
}

/* ------------------------------------------------------------- Protokollierung */

async function usernameOf(userId: string | null): Promise<string> {
  if (!userId) return "";
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .maybeSingle();
  return data?.username ?? "";
}

async function logEvent(opts: {
  tagId: string;
  actorType: "ai" | "system" | "moderator";
  actorId?: string | null;
  actorUsername?: string;
  action: string;
  fromStatus: ModerationStatus | null;
  toStatus: ModerationStatus | null;
  reason: string;
  details?: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin.from("slang_tag_moderation_events").insert({
    tag_id: opts.tagId,
    actor_type: opts.actorType,
    actor_id: opts.actorId ?? null,
    actor_username: opts.actorUsername ?? "",
    action: opts.action,
    from_status: opts.fromStatus,
    to_status: opts.toStatus,
    reason: opts.reason,
    details: opts.details ?? {},
  } as never);
  if (error) console.error("[moderation] log failed", error.message);
}

/* ----------------------------------------------------------------- Pipeline */

/** Führt die vollständige Moderationskette für einen SlangTag aus. */
export async function runModeration(tagId: string): Promise<ModerationResult> {
  const { data: tag, error } = await supabaseAdmin
    .from("slang_tags")
    .select("id,name,audio_url,kind,owner_type,moderation_status")
    .eq("id", tagId)
    .maybeSingle();
  if (error || !tag) throw new Error("SlangTag not found");

  const row = tag as Row;
  const from = (row.moderation_status as ModerationStatus) ?? "pending";
  const path = (row.audio_url as string | null) ?? null;
  /** Unternehmer-/Creator-SlangTags ($$) sind von der Musiksperre ausgenommen. */
  const musicExempt = row.kind === "creator";

  const finish = async (
    status: ModerationStatus,
    reason: string,
    labels: string[],
    isMusic: boolean,
    confidence: number,
    transcript: string,
    ai: Record<string, unknown>,
  ): Promise<ModerationResult> => {
    await supabaseAdmin
      .from("slang_tags")
      .update({
        moderation_status: status,
        moderation_reason: reason,
        moderation_labels: labels,
        moderation_is_music: isMusic,
        moderation_confidence: confidence,
        moderation_ai: ai,
        transcript,
        moderated_at: new Date().toISOString(),
      } as never)
      .eq("id", tagId);

    await logEvent({
      tagId,
      actorType: "ai",
      action: `ai_${status}`,
      fromStatus: from,
      toStatus: status,
      reason,
      details: ai,
    });

    return {
      status,
      reason,
      labels,
      isMusic,
      confidence,
      transcript,
      message: statusMessage({ status, isMusic, labels }),
    };
  };

  if (!path) {
    return finish(
      "review",
      "Kein Audio gefunden – manuelle Prüfung erforderlich.",
      ["analysis_failed"],
      false,
      0,
      "",
      {},
    );
  }

  const dl = await supabaseAdmin.storage.from("media").download(path);
  if (dl.error || !dl.data) {
    return finish(
      "review",
      "Audio konnte nicht geladen werden – manuelle Prüfung erforderlich.",
      ["analysis_failed"],
      false,
      0,
      "",
      {},
    );
  }
  const bytes = new Uint8Array(await dl.data.arrayBuffer());
  const { mime } = audioFormat(path);
  const blob = new Blob([bytes], { type: mime });

  let transcript = "";
  let text: TextVerdict | null = null;
  let music: MusicVerdict | null = null;
  const errors: string[] = [];

  try {
    transcript = await transcribe(blob, path);
  } catch (e) {
    errors.push(`stt: ${String(e)}`);
  }

  if (transcript) {
    try {
      text = await classifyText(transcript);
    } catch (e) {
      errors.push(`text: ${String(e)}`);
    }
  }

  try {
    music = await detectMusic(bytes, path);
  } catch (e) {
    errors.push(`audio: ${String(e)}`);
  }

  // Zusätzliche Richtlinienprüfung nach der zentralen Policy: das Audio wird
  // direkt vom Modell gehört (Parolen, Schreie, Hintergrund) und Name plus
  // Transkript werden als Text geprüft. Ein Treffer sperrt sofort.
  const { moderateAudioBytes, moderateText, mergeAnalyses } =
    await import("@/lib/content-moderation.server");
  const policy = mergeAnalyses({
    audio: await moderateAudioBytes(bytes, audioFormat(path).ext),
    text: await moderateText({
      "SlangTag-Name": String(row.name ?? ""),
      Transkript: transcript,
    }),
  });

  const ai: Record<string, unknown> = {
    transcript,
    text: text ?? null,
    music: music ?? null,
    policy,
    errors,
    models: { stt: STT_MODEL, text: TEXT_MODEL, audio: AUDIO_MODEL },
    checkedAt: new Date().toISOString(),
  };

  // 0) Richtlinien-Treffer der zentralen Policy (Extremismus, Hass, Gewalt …).
  if (policy.decision === "block") {
    return finish(
      "blocked",
      policy.reason || "Verstoß gegen die Community-Richtlinien erkannt.",
      policy.labels.length ? policy.labels : ["other_guideline_violation"],
      false,
      policy.confidence,
      transcript,
      ai,
    );
  }

  // 1) Verbotene Inhalte – klare Verstöße werden gesperrt.

  if (text?.violation && text.confidence >= BLOCK_THRESHOLD && !text.uncertain) {
    const labels = text.categories.length ? text.categories : ["other_guideline_violation"];
    return finish(
      "blocked",
      text.reason || "Verstoß gegen die Community-Richtlinien erkannt.",
      labels,
      false,
      text.confidence,
      transcript,
      ai,
    );
  }

  // 2) Musik / Gesang / geschützte Tonaufnahmen – außer bei $$-SlangTags.
  if (music?.isMusic && music.confidence >= MUSIC_BLOCK_THRESHOLD) {
    const labels = music.labels.length ? music.labels : ["music"];
    if (!musicExempt) {
      return finish(
        "blocked",
        music.reason || "Überwiegend Musik oder Gesang erkannt.",
        labels,
        true,
        music.confidence,
        transcript,
        ai,
      );
    }
    return finish(
      "approved",
      "Unternehmer-SlangTag ($$): Musik-/Gesangssperre nicht angewendet – Rechte liegen beim Uploader.",
      labels,
      true,
      music.confidence,
      transcript,
      ai,
    );
  }

  // 3) Unsichere Fälle gehen in die manuelle Moderation.
  const uncertain =
    policy.decision === "review" ||
    errors.length > 0 ||
    !transcript ||
    !text ||
    text.uncertain ||
    (text.violation && text.confidence >= REVIEW_THRESHOLD) ||
    // Musikverdacht nur bei belastbarer Konfidenz – hohe/kindliche Stimmen
    // wurden zuvor faelschlich als Gesang gewertet.
    (music?.isMusic === true && music.confidence >= 0.5);

  if (uncertain) {
    const labels = [
      ...policy.labels,
      ...(text?.categories ?? []),
      ...(music?.labels ?? []),
      ...(errors.length ? ["analysis_failed"] : []),
      ...(!transcript ? ["transcription_failed"] : []),
    ];
    return finish(
      "review",
      "Keine eindeutige KI-Entscheidung – zur manuellen Prüfung weitergeleitet.",
      Array.from(new Set(labels)),
      Boolean(music?.isMusic),
      Math.max(text?.confidence ?? 0, music?.confidence ?? 0),
      transcript,
      ai,
    );
  }

  // 4) Sauber – Freigabe.
  return finish(
    "approved",
    text?.spam ? "Keine Verstöße erkannt." : "Keine Verstöße erkannt.",
    [],
    false,
    text?.confidence ?? 0,
    transcript,
    ai,
  );
}

/* ---------------------------------------------------------------- Dashboard */

async function signAudio(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabaseAdmin.storage.from("media").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

/** Lädt die Moderations-Warteschlange (gesperrte, zu prüfende und gemeldete SlangTags). */
export async function loadModerationQueue(
  filter: ModerationQueueFilter,
  query: string,
): Promise<ModerationQueueRow[]> {
  const reportsRes = await supabaseAdmin
    .from("reports")
    .select("id,target_id,reporter_id,reason,details,status,created_at")
    .eq("target_type", "slang_tag")
    .order("created_at", { ascending: false });
  const reportRows = (reportsRes.data ?? []) as Row[];
  const reportedIds = Array.from(new Set(reportRows.map((r) => r.target_id as string)));

  let builder = supabaseAdmin
    .from("slang_tags")
    .select(
      "id,name,kind,owner_type,owner_id,creator_id,audio_url,duration,transcript,moderation_status,moderation_reason,moderation_labels,moderation_is_music,moderation_confidence,moderation_ai,created_at,moderated_at,deleted_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (filter === "blocked") builder = builder.eq("moderation_status", "blocked");
  else if (filter === "open") builder = builder.in("moderation_status", ["review", "pending"]);
  else if (filter === "reported") {
    if (reportedIds.length === 0) return [];
    builder = builder.in("id", reportedIds);
  }
  if (query.trim()) builder = builder.ilike("name", `%${query.trim()}%`);

  const { data, error } = await builder;
  if (error) throw new Error(error.message);
  const tagRows = (data ?? []) as Row[];

  const userIds = Array.from(
    new Set([
      ...tagRows.map((t) => (t.owner_id as string) ?? (t.creator_id as string)),
      ...reportRows.map((r) => r.reporter_id as string),
    ]),
  ).filter(Boolean);
  const nameMap = new Map<string, string>();
  if (userIds.length) {
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id,username")
      .in("id", userIds);
    ((profs ?? []) as Row[]).forEach((p) => nameMap.set(p.id as string, p.username as string));
  }

  const tagIds = tagRows.map((t) => t.id as string);
  const eventMap = new Map<string, ModerationQueueRow["events"]>();
  if (tagIds.length) {
    const { data: events } = await supabaseAdmin
      .from("slang_tag_moderation_events")
      .select("id,tag_id,actor_type,actor_username,action,from_status,to_status,reason,created_at")
      .in("tag_id", tagIds)
      .order("created_at", { ascending: false });
    ((events ?? []) as Row[]).forEach((e) => {
      const list = eventMap.get(e.tag_id as string) ?? [];
      list.push({
        id: e.id as string,
        actorType: (e.actor_type as string) ?? "ai",
        actorUsername: (e.actor_username as string) ?? "",
        action: (e.action as string) ?? "",
        fromStatus: (e.from_status as ModerationStatus | null) ?? null,
        toStatus: (e.to_status as ModerationStatus | null) ?? null,
        reason: (e.reason as string) ?? "",
        createdAt: e.created_at as string,
      });
      eventMap.set(e.tag_id as string, list);
    });
  }

  const rows: ModerationQueueRow[] = [];
  for (const t of tagRows) {
    const id = t.id as string;
    const ownerId = (t.owner_id as string) ?? (t.creator_id as string) ?? null;
    rows.push({
      id,
      name: t.name as string,
      kind: ((t.kind as string) ?? "community") as "community" | "creator",
      ownerType: (t.owner_type as string) ?? "user",
      ownerUserId: ownerId,
      ownerUsername: nameMap.get(ownerId ?? "") ?? "",
      audioUrl: await signAudio((t.audio_url as string | null) ?? null),
      duration: (t.duration as string) ?? "",
      transcript: (t.transcript as string) ?? "",
      status: ((t.moderation_status as string) ?? "pending") as ModerationStatus,
      reason: (t.moderation_reason as string) ?? "",
      labels: Array.isArray(t.moderation_labels) ? (t.moderation_labels as string[]) : [],
      isMusic: Boolean(t.moderation_is_music),
      confidence: Number(t.moderation_confidence) || 0,
      ai: JSON.stringify(t.moderation_ai ?? {}, null, 2),
      createdAt: t.created_at as string,
      moderatedAt: (t.moderated_at as string | null) ?? null,
      deletedAt: (t.deleted_at as string | null) ?? null,
      reports: reportRows
        .filter((r) => r.target_id === id)
        .map((r) => ({
          id: r.id as string,
          reporterUsername: nameMap.get(r.reporter_id as string) ?? "",
          reason: (r.reason as string) ?? "",
          details: (r.details as string) ?? "",
          status: (r.status as string) ?? "open",
          createdAt: r.created_at as string,
        })),
      events: eventMap.get(id) ?? [],
    });
  }
  return rows;
}

/** Moderator-Entscheidung anwenden und protokollieren. */
export async function applyModerationDecision(
  adminId: string,
  tagId: string,
  decision: ModerationDecision,
  note: string,
): Promise<ModerationResult | { ok: true }> {
  const { data: tag } = await supabaseAdmin
    .from("slang_tags")
    .select("id,name,moderation_status")
    .eq("id", tagId)
    .maybeSingle();
  if (!tag) throw new Error("SlangTag not found");
  const from = ((tag as Row).moderation_status as ModerationStatus) ?? "pending";
  const actorUsername = await usernameOf(adminId);

  if (decision === "recheck") {
    await logEvent({
      tagId,
      actorType: "moderator",
      actorId: adminId,
      actorUsername,
      action: "recheck",
      fromStatus: from,
      toStatus: null,
      reason: note,
    });
    return runModeration(tagId);
  }

  const target: ModerationStatus = decision === "approve" ? "approved" : "blocked";
  const patch: Record<string, unknown> = {
    moderation_status: target,
    moderation_reason:
      note || (decision === "approve" ? "Von Moderation freigegeben." : "Von Moderation gesperrt."),
    moderated_at: new Date().toISOString(),
    moderated_by: adminId,
  };
  if (decision === "delete") patch.deleted_at = new Date().toISOString();
  if (decision === "approve") patch.deleted_at = null;

  const { error } = await supabaseAdmin
    .from("slang_tags")
    .update(patch as never)
    .eq("id", tagId);
  if (error) throw new Error(error.message);

  await logEvent({
    tagId,
    actorType: "moderator",
    actorId: adminId,
    actorUsername,
    action: decision,
    fromStatus: from,
    toStatus: target,
    reason: patch.moderation_reason as string,
  });

  // Offene Meldungen zu diesem SlangTag mit abschließen.
  await supabaseAdmin
    .from("reports")
    .update({
      status: decision === "approve" ? "dismissed" : "resolved",
      review_note: note,
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminId,
    } as never)
    .eq("target_type", "slang_tag")
    .eq("target_id", tagId)
    .in("status", ["open", "reviewing"]);

  return { ok: true };
}
