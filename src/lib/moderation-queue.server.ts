/**
 * Asynchrone Moderations-Warteschlange fuer Beitraege (Server-only).
 *
 * Beitraege werden sofort gespeichert und veroeffentlicht. Die vollstaendige
 * KI-Pruefung laeuft danach entkoppelt ueber Auftraege in
 * `post_moderation_jobs`. Die Pruefregeln selbst bleiben unveraendert
 * (`runPostModeration`) – es aendert sich nur der Zeitpunkt der Ausfuehrung.
 *
 * Fehlertoleranz: Ist der KI-Dienst nicht erreichbar, bleibt der Beitrag
 * gespeichert und der Auftrag wird mit wachsendem Abstand erneut versucht.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logModeration, runPostModeration } from "@/lib/post-moderation.server";

/** Maximale Anzahl Versuche, danach bleibt der Beitrag in Pruefung. */
const MAX_ATTEMPTS = 5;
/** Wartezeiten (Minuten) je Versuch. */
const BACKOFF_MINUTES = [1, 2, 10, 60, 180];

type JobRow = {
  id: string;
  post_id: string;
  user_id: string;
  kind: string;
  attempts: number;
  skip_image: boolean;
};

/** Legt einen Moderationsauftrag an (nicht blockierend fuer den Nutzer). */
export async function enqueuePostModeration(opts: {
  postId: string;
  userId: string;
  kind: "post_create" | "post_update";
  skipImage?: boolean;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("post_moderation_jobs").insert({
    post_id: opts.postId,
    user_id: opts.userId,
    kind: opts.kind,
    skip_image: opts.skipImage ?? false,
  } as never);
  if (error) console.error("[moderation-queue] enqueue failed", error.message);
}

/** Faellige Auftraege holen (aelteste zuerst). */
async function dueJobs(limit: number): Promise<JobRow[]> {
  const { data, error } = await supabaseAdmin
    .from("post_moderation_jobs")
    .select("id,post_id,user_id,kind,attempts,skip_image")
    .in("status", ["queued", "failed"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at", { ascending: true })
    .limit(limit);
  if (error) {
    console.error("[moderation-queue] fetch failed", error.message);
    return [];
  }
  return (data ?? []) as JobRow[];
}

/** Auftrag exklusiv uebernehmen (verhindert doppelte Verarbeitung). */
async function claim(job: JobRow, startedAt: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("post_moderation_jobs")
    .update({
      status: "running",
      started_at: startedAt,
      attempts: job.attempts + 1,
    } as never)
    .eq("id", job.id)
    .in("status", ["queued", "failed"])
    .select("id")
    .maybeSingle();
  return !error && Boolean(data);
}

export type JobOutcome = {
  jobId: string;
  postId: string;
  result: string;
  durationMs: number;
  error?: string;
};

async function finish(
  jobId: string,
  patch: {
    status: string;
    result: string;
    startedAt: string;
    durationMs: number;
    error?: string;
    nextAttemptAt?: string;
  },
): Promise<void> {
  await supabaseAdmin
    .from("post_moderation_jobs")
    .update({
      status: patch.status,
      result: patch.result,
      finished_at: new Date().toISOString(),
      duration_ms: patch.durationMs,
      last_error: patch.error ?? "",
      ...(patch.nextAttemptAt ? { next_attempt_at: patch.nextAttemptAt } : {}),
    } as never)
    .eq("id", jobId);
}

/** Fuehrt einen einzelnen Auftrag aus. */
async function runJob(job: JobRow): Promise<JobOutcome> {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  console.log("[moderation-queue] start", { job: job.id, post: job.post_id, at: startedAt });

  if (!(await claim(job, startedAt))) {
    return { jobId: job.id, postId: job.post_id, result: "skipped", durationMs: 0 };
  }

  const { data: post } = await supabaseAdmin
    .from("posts")
    .select("id,user_id,title,description,hashtags,region,image_url,slang_tag_ids")
    .eq("id", job.post_id)
    .maybeSingle();

  if (!post) {
    const durationMs = Date.now() - t0;
    await finish(job.id, { status: "done", result: "post_missing", startedAt, durationMs });
    return { jobId: job.id, postId: job.post_id, result: "post_missing", durationMs };
  }

  const row = post as Record<string, unknown>;

  // Geprueft wird immer das unveraenderte Original – SlangTags duerfen keine
  // Verstoesse verdecken. Ohne Original ist die veroeffentlichte Version identisch.
  const { data: original } = await supabaseAdmin
    .from("post_originals")
    .select("storage_path")
    .eq("post_id", job.post_id)
    .maybeSingle();
  const originalPath = (original as { storage_path?: string } | null)?.storage_path ?? null;

  try {
    const verdict = await runPostModeration({
      userId: job.user_id,
      title: String(row.title ?? ""),
      description: String(row.description ?? ""),
      hashtags: (row.hashtags as string[] | null) ?? [],
      region: String(row.region ?? ""),
      imagePath: originalPath ?? (row.image_url as string | null) ?? null,
      slangTagIds: (row.slang_tag_ids as string[] | null) ?? [],
      skipImage: job.skip_image,
    });

    // Technischer Fehlschlag der Bildanalyse => erneut versuchen, nicht bestrafen.
    const analysisFailed = verdict.labels.includes("analysis_failed");
    // Noch laufende SlangTag-Pruefung ist kein Verstoss => spaeter erneut pruefen.
    const tagsPending = verdict.labels.includes("slangtag_pending");
    if ((analysisFailed || tagsPending) && job.attempts + 1 < MAX_ATTEMPTS) {
      throw new Error(analysisFailed ? "analysis_failed" : "slangtag_pending");
    }

    const now = new Date().toISOString();
    // Der Beitrag bleibt in jedem Fall gespeichert. Regelwidrige Beitraege
    // werden sofort unveroeffentlicht ("hidden_at") und ausschliesslich dem
    // Eigentuemer bzw. der Administration angezeigt – so kann der Nutzer den
    // Grund sehen und den Beitrag korrigieren oder loeschen, statt dass der
    // Beitrag ohne Erklaerung verschwindet.
    await supabaseAdmin
      .from("posts")
      .update({
        moderation_status:
          verdict.decision === "allow"
            ? "approved"
            : verdict.decision === "block"
              ? "blocked"
              : "review",
        moderation_reason: verdict.reason ?? "",
        moderated_at: now,
        // Unklare und regelwidrige Faelle bleiben unveroeffentlicht.
        hidden_at: verdict.decision === "allow" ? null : now,
      } as never)
      .eq("id", job.post_id);

    await logModeration({
      userId: job.user_id,
      contentType: job.kind,
      contentId: job.post_id,
      verdict,
    });

    const durationMs = Date.now() - t0;
    await finish(job.id, { status: "done", result: verdict.decision, startedAt, durationMs });
    console.log("[moderation-queue] done", {
      job: job.id,
      post: job.post_id,
      result: verdict.decision,
      durationMs,
    });
    return { jobId: job.id, postId: job.post_id, result: verdict.decision, durationMs };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const durationMs = Date.now() - t0;
    const attempts = job.attempts + 1;
    const exhausted = attempts >= MAX_ATTEMPTS;
    const waitMin = BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)] ?? 60;
    const nextAttemptAt = new Date(Date.now() + waitMin * 60_000).toISOString();

    // Der Beitrag bleibt in jedem Fall gespeichert.
    if (exhausted) {
      const now = new Date().toISOString();
      await supabaseAdmin
        .from("posts")
        .update({
          moderation_status: "review",
          moderation_reason: "Automatische Pruefung nicht moeglich – manuelle Pruefung.",
          moderated_at: now,
          hidden_at: now,
        } as never)
        .eq("id", job.post_id);
    }

    await finish(job.id, {
      status: exhausted ? "failed_final" : "failed",
      result: exhausted ? "error_final" : "error",
      startedAt,
      durationMs,
      error: message,
      nextAttemptAt,
    });
    console.error("[moderation-queue] error", {
      job: job.id,
      post: job.post_id,
      attempts,
      durationMs,
      error: message,
    });
    return { jobId: job.id, postId: job.post_id, result: "error", durationMs, error: message };
  }
}

/** Verarbeitet faellige Auftraege (Hintergrundprozess / Cron). */
export async function processModerationQueue(limit = 5): Promise<JobOutcome[]> {
  const jobs = await dueJobs(limit);
  const results: JobOutcome[] = [];
  for (const job of jobs) results.push(await runJob(job));
  return results;
}
