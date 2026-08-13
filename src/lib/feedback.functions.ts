import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { FeedbackCategory, FeedbackRow, FeedbackStatus } from "@/lib/feedback.shared";

export const feedbackSubmit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      category: FeedbackCategory;
      message: string;
      area?: string;
      device?: string;
      browser?: string;
      os?: string;
    }) => ({
      category: input.category,
      message: String(input.message ?? ""),
      area: String(input.area ?? ""),
      device: String(input.device ?? ""),
      browser: String(input.browser ?? ""),
      os: String(input.os ?? ""),
    }),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { submitFeedback } = await import("@/lib/feedback.server");
    return submitFeedback(context, data);
  });

export const feedbackListOwn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FeedbackRow[]> => {
    const { listOwnFeedback } = await import("@/lib/feedback.server");
    return listOwnFeedback(context);
  });

export const adminFeedbackList = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status?: FeedbackStatus | "all"; category?: FeedbackCategory | "all" }) => ({
    status: input?.status ?? "all",
    category: input?.category ?? "all",
  }))
  .handler(async ({ data, context }): Promise<{ rows: FeedbackRow[]; counts: Record<string, number> }> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(context);
    const { adminListFeedback } = await import("@/lib/feedback.server");
    return adminListFeedback(data);
  });

export const adminFeedbackUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: FeedbackStatus; adminNote?: string; notify?: boolean }) => ({
    id: String(input.id),
    status: input.status,
    adminNote: String(input.adminNote ?? ""),
    notify: input.notify !== false,
  }))
  .handler(async ({ data, context }): Promise<FeedbackRow> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    const { adminUpdateFeedback } = await import("@/lib/feedback.server");
    return adminUpdateFeedback(adminId, data);
  });
