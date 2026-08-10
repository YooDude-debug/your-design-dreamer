import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  ModerationDecision,
  ModerationQueueFilter,
  ModerationQueueRow,
  ModerationResult,
} from "@/lib/moderation.shared";

/**
 * Prüft einen frisch erstellten SlangTag (Speech-to-Text + KI-Moderation +
 * Musikerkennung). Nur der Eigentümer oder ein Admin darf die Prüfung anstoßen.
 */
export const moderateNewSlangTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tagId: string }) => {
    if (!input?.tagId) throw new Error("tagId required");
    return { tagId: input.tagId };
  })
  .handler(async ({ context, data }): Promise<ModerationResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runModeration } = await import("@/lib/moderation.server");

    const { data: tag } = await supabaseAdmin
      .from("slang_tags")
      .select("id,name,owner_id,creator_id")
      .eq("id", data.tagId)
      .maybeSingle();
    if (!tag) throw new Error("SlangTag not found");

    const row = tag as Record<string, unknown>;
    const owns = row.owner_id === context.userId || row.creator_id === context.userId;
    if (!owns) {
      const { data: isAdmin } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      });
      if (isAdmin !== true) throw new Error("Forbidden");
    }

    // Serverseitige Namensvalidierung: darf nicht ueber das UI umgangen werden.
    const { checkSlangTagName } = await import("@/lib/slangtag-rules");
    const check = checkSlangTagName(String(row.name ?? ""));
    if (!check.ok) {
      await supabaseAdmin
        .from("slang_tags")
        .update({
          moderation_status: "blocked",
          moderation_reason: "invalid_name",
          moderated_at: new Date().toISOString(),
        } as never)
        .eq("id", data.tagId);
      return {
        status: "blocked",
        reason: "invalid_name",
        labels: ["invalid_name"],
        isMusic: false,
        confidence: 1,
        transcript: "",
        message: "Der Name enthaelt unerlaubte Zeichen. Erlaubt sind nur Buchstaben und Zahlen.",
      };
    }

    return runModeration(data.tagId);
  });

/* --------------------------------------------------------- Moderations-Cockpit */

export const adminGetModerationQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { filter?: string; query?: string }) => ({
    filter: (input?.filter ?? "open") as ModerationQueueFilter,
    query: input?.query ?? "",
  }))
  .handler(async ({ context, data }): Promise<ModerationQueueRow[]> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    const { loadModerationQueue } = await import("@/lib/moderation.server");
    await assertAdmin(context);
    return loadModerationQueue(data.filter, data.query);
  });

export const adminModerationDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tagId: string; decision: ModerationDecision; note?: string }) => {
    if (!input?.tagId) throw new Error("tagId required");
    return { tagId: input.tagId, decision: input.decision, note: input.note ?? "" };
  })
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { assertAdmin, logAdminAction } = await import("@/lib/admin.server");
    const { applyModerationDecision } = await import("@/lib/moderation.server");
    const adminId = await assertAdmin(context);
    await applyModerationDecision(adminId, data.tagId, data.decision, data.note);
    await logAdminAction(adminId, `moderation_${data.decision}`, {
      targetType: "slang_tag",
      targetId: data.tagId,
      details: { note: data.note },
    });
    return { ok: true };
  });

/* ------------------------------------------------- Worker-Start (Beitraege) */

/**
 * Startet den Moderations-Worker fuer angemeldete Nutzer.
 *
 * Die Autorisierung erfolgt serverseitig ueber die bestehende Anmeldung –
 * es gelangt kein Geheimnis in die Oberflaeche. Der Worker verarbeitet nur
 * bereits gespeicherte Auftraege und gibt keine Inhalte zurueck.
 */
export const runModerationQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ processed: number }> => {
    const { processModerationQueue } = await import("@/lib/moderation-queue.server");
    const results = await processModerationQueue(5);
    return { processed: results.length };
  });
