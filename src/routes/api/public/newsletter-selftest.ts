import { createFileRoute } from "@tanstack/react-router";

/** Temporärer Diagnose-Endpunkt für den Notify-Me-Mailversand. */
export const Route = createFileRoute("/api/public/newsletter-selftest")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const email = url.searchParams.get("email") ?? "test@example.com";
        try {
          const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
          const res = await sendTemplateEmail("newsletter-confirm", email, {
            templateData: { confirmUrl: `${url.origin}/newsletter/confirm?token=diag`, language: "de" },
            idempotencyKey: `diag-${Date.now()}`,
          });
          return Response.json({ ok: true, res });
        } catch (e) {
          const err = e as { name?: string; message?: string; code?: string; status?: number };
          return Response.json({
            ok: false,
            name: err.name,
            message: err.message,
            code: err.code,
            status: err.status,
          });
        }
      },
    },
  },
});
