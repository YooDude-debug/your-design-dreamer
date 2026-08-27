import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isOwnedPath, MAX_VARIANT_ATTEMPTS } from "./media-variants.shared";

/**
 * Server-Backstop für Bildvarianten (`__t.webp` / `__m.webp`).
 *
 * Die clientseitige Erzeugung bleibt der schnelle Normalweg. Schlägt sie fehl
 * (oder wurde sie nie ausgeführt), stellt dieser Pfad die Varianten nachträglich
 * her. Ohne diesen Backstop bleiben Datensätze dauerhaft variantenlos und der
 * Feed lädt mehrere MB große Originale.
 */

type EnsureInput = { path: string; clientError?: string | null };

export const ensureImageVariants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: EnsureInput) => {
    if (!input?.path || typeof input.path !== "string" || input.path.length > 400) {
      throw new Error("Invalid path");
    }
    return {
      path: input.path,
      clientError: typeof input.clientError === "string" ? input.clientError.slice(0, 200) : null,
    };
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // Fremde Pfade (z. B. Medien anderer Nutzer im Feed) werden still übergangen.
    // Kein Fehler: der Aufruf läuft im Hintergrund und darf die UI nie stören.
    if (!isOwnedPath(data.path, userId)) {
      return { status: "skipped" as const, thumb: "skipped", medium: "skipped", attempts: 0 };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ensureVariantsForPath, outcomeStatus } = await import("@/lib/media-variants.server");

    const { data: job } = await supabaseAdmin
      .from("media_variant_jobs")
      .select("attempts, status")
      .eq("path", data.path)
      .maybeSingle();

    const attempts = job?.attempts ?? 0;
    if (job?.status === "done") {
      return { status: "done" as const, thumb: "ok", medium: "ok", attempts };
    }
    if (attempts >= MAX_VARIANT_ATTEMPTS) {
      // Kein Endlos-Retry: nach drei Versuchen bleibt der Job endgültig fehlerhaft.
      return { status: "failed" as const, thumb: "failed", medium: "failed", attempts };
    }

    const result = await ensureVariantsForPath(supabaseAdmin, data.path);
    const status = outcomeStatus(result);
    const nextAttempts = attempts + 1;

    await supabaseAdmin.from("media_variant_jobs").upsert(
      {
        path: data.path,
        owner_id: userId,
        needs_thumb: result.thumb === "failed",
        needs_medium: result.medium === "failed",
        attempts: nextAttempts,
        last_error: status === "failed" ? (result.reason ?? data.clientError ?? "unknown") : null,
        status: status === "failed" && nextAttempts >= MAX_VARIANT_ATTEMPTS ? "failed" : status,
      },
      { onConflict: "path" },
    );

    if (status === "failed") {
      console.warn("[media-variants] backstop failed", data.path, result.reason, data.clientError);
    }

    return { status, thumb: result.thumb, medium: result.medium, attempts: nextAttempts };
  });

/** Inventur: wie viele Bilder haben keine Varianten (nur lesend, Admin). */
export const mediaVariantInventory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { collectVariantInventory } = await import("@/lib/media-variants-inventory.server");
    return collectVariantInventory(supabaseAdmin);
  });

/** Bestandsreparatur in Stapeln (Admin, idempotent, wiederholbar). */
export const repairMissingVariants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { limit?: number } | undefined) => ({
    limit: Math.min(Math.max(input?.limit ?? 20, 1), 50),
  }))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { collectVariantInventory } = await import("@/lib/media-variants-inventory.server");
    const { ensureVariantsForPath, outcomeStatus } = await import("@/lib/media-variants.server");

    const inventory = await collectVariantInventory(supabaseAdmin);
    const targets = inventory.missingPaths.slice(0, data.limit);

    let repaired = 0;
    let failed = 0;
    for (const entry of targets) {
      const result = await ensureVariantsForPath(supabaseAdmin, entry.path);
      const status = outcomeStatus(result);
      if (status === "done") repaired += 1;
      else failed += 1;
      await supabaseAdmin.from("media_variant_jobs").upsert(
        {
          path: entry.path,
          owner_id: entry.ownerId,
          needs_thumb: result.thumb === "failed",
          needs_medium: result.medium === "failed",
          attempts: 1,
          last_error: status === "failed" ? (result.reason ?? "unknown") : null,
          status,
        },
        { onConflict: "path" },
      );
    }

    return {
      processed: targets.length,
      repaired,
      failed,
      remaining: Math.max(inventory.missingPaths.length - targets.length, 0),
    };
  });
