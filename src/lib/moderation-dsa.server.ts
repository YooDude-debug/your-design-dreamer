import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  APPEAL_WINDOW_DAYS,
  actionLabel,
  defaultPublicReason,
  reasonLabel,
  type ModerationActionKind,
  type ModerationReasonCode,
} from "@/lib/moderation-reasons";

/**
 * DSA-Umsetzung: begründete Moderationsentscheidungen (Art. 17),
 * Information des Meldenden (Art. 16 Abs. 5) und internes
 * Beschwerdemanagement (Art. 20).
 *
 * Jede Maßnahme gegen einen Inhalt oder ein Konto wird hier protokolliert,
 * dem betroffenen Nutzer verständlich mitgeteilt und mit einer Einspruchs-
 * frist versehen.
 */

type AnyDb = {
  from: (t: string) => {
    insert: (v: unknown) => {
      select: (c: string) => { maybeSingle: () => Promise<{ data: { id: string } | null; error: { message: string } | null }> };
    };
    update: (v: unknown) => {
      eq: (c: string, v: string) => Promise<{ error: { message: string } | null }>;
    };
    select: (c: string) => {
      eq: (
        c: string,
        v: string,
      ) => {
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
        order: (c: string, o: { ascending: boolean }) => Promise<{ data: Record<string, unknown>[] | null }>;
      };
      order: (
        c: string,
        o: { ascending: boolean },
      ) => { limit: (n: number) => Promise<{ data: Record<string, unknown>[] | null }> };
    };
  };
};
const db = supabaseAdmin as unknown as AnyDb;

export type ModerationTargetType =
  | "post"
  | "comment"
  | "message"
  | "slang_tag"
  | "profile"
  | "market_item";

export type RecordActionInput = {
  targetType: ModerationTargetType;
  targetId: string | null;
  /** Betroffener Nutzer (Urheber des Inhalts bzw. Kontoinhaber). */
  targetUserId: string | null;
  actionKind: ModerationActionKind;
  reasonCode: ModerationReasonCode;
  /** Begründung für den Nutzer; leer → Standardtext aus dem Katalog. */
  publicReason?: string;
  /** Interne Notiz; wird dem Nutzer nie angezeigt. */
  internalNote?: string;
  automated?: boolean;
  reportId?: string | null;
  adminId?: string | null;
  /** Kurzbezeichnung des Inhalts, damit der Nutzer ihn wiedererkennt. */
  targetLabel?: string;
};

const TARGET_OWNER: Record<ModerationTargetType, { table: string; column: string } | null> = {
  post: { table: "posts", column: "user_id" },
  comment: { table: "comments", column: "user_id" },
  message: { table: "messages", column: "sender_id" },
  slang_tag: { table: "slang_tags", column: "owner_id" },
  market_item: { table: "market_items", column: "seller_id" },
  profile: null,
};

/** Ermittelt den betroffenen Nutzer aus dem Inhalt. */
export async function ownerOfTarget(
  targetType: ModerationTargetType,
  targetId: string | null,
): Promise<string | null> {
  if (!targetId) return null;
  if (targetType === "profile") return targetId;
  const map = TARGET_OWNER[targetType];
  if (!map) return null;
  const { data } = await db.from(map.table).select(map.column).eq("id", targetId).maybeSingle();
  const value = data?.[map.column];
  return typeof value === "string" ? value : null;
}

/**
 * Protokolliert eine Moderationsentscheidung und informiert den betroffenen
 * Nutzer mit Grund, Maßnahme und Hinweis auf das Einspruchsrecht.
 */
export async function recordModerationAction(input: RecordActionInput): Promise<string | null> {
  const targetUserId =
    input.targetUserId ?? (await ownerOfTarget(input.targetType, input.targetId));

  const publicReason =
    input.publicReason?.trim() || defaultPublicReason(input.actionKind, input.reasonCode, "de");
  const deadline = new Date(Date.now() + APPEAL_WINDOW_DAYS * 86_400_000).toISOString();
  const informable = targetUserId !== null && input.actionKind !== "no_action";

  const { data, error } = await db
    .from("moderation_actions")
    .insert({
      target_type: input.targetType,
      target_id: input.targetId,
      target_user_id: targetUserId,
      action_kind: input.actionKind,
      reason_code: input.reasonCode,
      public_reason: publicReason,
      internal_note: input.internalNote ?? "",
      automated: input.automated === true,
      report_id: input.reportId ?? null,
      admin_id: input.adminId ?? null,
      target_label: input.targetLabel ?? "",
      user_informed_at: informable ? new Date().toISOString() : null,
      appeal_deadline: deadline,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[moderation-dsa] record failed", error.message);
    return null;
  }

  if (informable && targetUserId) {
    await notify(targetUserId, {
      type: "moderation_action",
      title: actionLabel(input.actionKind, "de"),
      body: publicReason,
      entityType: "moderation_action",
      entityId: data?.id ?? null,
      link: "/moderation",
    });
  }

  return data?.id ?? null;
}

/** Informiert die meldende Person über das Ergebnis ihrer Meldung. */
export async function informReporter(
  reportId: string,
  decisionCode: ModerationReasonCode,
  outcome: "actioned" | "no_action",
): Promise<void> {
  const { data: report } = await db
    .from("reports")
    .select("id,reporter_id,target_type")
    .eq("id", reportId)
    .maybeSingle();
  const reporterId = typeof report?.reporter_id === "string" ? report.reporter_id : null;

  const now = new Date().toISOString();
  await db
    .from("reports")
    .update({ decision_code: decisionCode, decided_at: now, reporter_informed_at: reporterId ? now : null })
    .eq("id", reportId);

  if (!reporterId) return;
  await notify(reporterId, {
    type: "report_decision",
    title: "Deine Meldung wurde geprüft",
    body:
      outcome === "actioned"
        ? `Wir haben Maßnahmen ergriffen. Einordnung: ${reasonLabel(decisionCode, "de")}.`
        : "Wir haben keinen Verstoß festgestellt. Die Meldung ist damit abgeschlossen.",
    entityType: "report",
    entityId: reportId,
    link: null,
  });
}

/* --------------------------------------------------------------- Einspruch */

export type AppealDecision = "in_review" | "upheld" | "overturned" | "rejected";

/** Hebt eine Maßnahme technisch wieder auf, soweit möglich. */
async function restoreTarget(action: Record<string, unknown>): Promise<void> {
  const targetType = action["target_type"];
  const targetId = action["target_id"];
  const kind = action["action_kind"];
  if (typeof targetId !== "string") return;

  if (targetType === "post" && (kind === "content_hidden" || kind === "content_removed")) {
    await db.from("posts").update({ hidden_at: null }).eq("id", targetId);
    return;
  }
  if (targetType === "slang_tag") {
    await db.from("slang_tags").update({ deleted_at: null }).eq("id", targetId);
    return;
  }
  if (targetType === "market_item" && kind === "market_item_removed") {
    await db.from("market_items").update({ status: "active" }).eq("id", targetId);
  }
}

/**
 * Entscheidung über einen Einspruch. `overturned` hebt die Maßnahme auf,
 * soweit der Inhalt technisch wiederherstellbar ist.
 */
export async function decideAppeal(
  adminId: string,
  appealId: string,
  decision: AppealDecision,
  note: string,
): Promise<void> {
  const { data: appeal } = await db
    .from("moderation_appeals")
    .select("id,user_id,action_id,status")
    .eq("id", appealId)
    .maybeSingle();
  if (!appeal) throw new Error("Einspruch nicht gefunden");

  const now = new Date().toISOString();
  const { error } = await db
    .from("moderation_appeals")
    .update({
      status: decision,
      decision_note: note,
      decided_by: adminId,
      decided_at: decision === "in_review" ? null : now,
    })
    .eq("id", appealId);
  if (error) throw new Error(error.message);

  if (decision === "overturned") {
    const actionId = appeal["action_id"];
    if (typeof actionId === "string") {
      const { data: action } = await db
        .from("moderation_actions")
        .select("id,target_type,target_id,action_kind")
        .eq("id", actionId)
        .maybeSingle();
      if (action) await restoreTarget(action);
    }
  }

  const userId = appeal["user_id"];
  if (typeof userId !== "string" || decision === "in_review") return;

  const titles: Record<Exclude<AppealDecision, "in_review">, string> = {
    upheld: "Einspruch geprüft – Entscheidung bestätigt",
    overturned: "Einspruch erfolgreich – Maßnahme aufgehoben",
    rejected: "Einspruch abgelehnt",
  };
  await notify(userId, {
    type: "moderation_appeal",
    title: titles[decision],
    body: note.trim() || "Die Prüfung ist abgeschlossen. Details findest du unter Moderation.",
    entityType: "moderation_appeal",
    entityId: appealId,
    link: "/moderation",
  });
}

/* ------------------------------------------------------------------ intern */

async function notify(
  userId: string,
  n: {
    type: string;
    title: string;
    body: string;
    entityType: string;
    entityId: string | null;
    link: string | null;
  },
): Promise<void> {
  try {
    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      actor_id: null,
      type: n.type,
      title: n.title,
      body: n.body,
      entity_type: n.entityType,
      entity_id: n.entityId,
      link: n.link,
    });
  } catch (error) {
    console.error("[moderation-dsa] notify failed", error);
  }
}
