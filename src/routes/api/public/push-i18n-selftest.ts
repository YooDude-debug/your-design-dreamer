import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/push-i18n-selftest")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const messageId = url.searchParams.get("m") ?? "";
        const lang = (url.searchParams.get("lang") ?? "de") as "de" | "en" | "el";
        const { messagePushContent } = await import("@/lib/push-message.server");
        const { pushTitle } = await import("@/lib/push-shared");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const content = await messagePushContent(supabaseAdmin, messageId, lang);
        return Response.json({
          title: pushTitle({ type: "message", lang, actorName: "Mario", voice: content?.voice }),
          content,
        });
      },
    },
  },
});
