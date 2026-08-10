import { createFileRoute } from "@tanstack/react-router";

/**
 * Zeitgesteuerter Lauf des Bot-Live-Tests.
 *
 * Der Endpunkt prüft zuerst die Testeinstellungen: ist der Live-Test aus,
 * passiert nichts. Es werden ausschließlich Bot-Konten bespielt, niemals
 * echte Nutzer. Rückgabe enthält keine Nutzerdaten.
 */
export const Route = createFileRoute("/api/public/bot-live-run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Öffentlicher Job-Endpunkt: nur mit Server-Secret aufrufbar.
        const { isAuthorizedWorkerRequest } = await import("@/lib/worker-auth.server");
        if (!isAuthorizedWorkerRequest(request, ["BOT_CRON_TOKEN", "MODERATION_CRON_TOKEN"])) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const { runLiveRound } = await import("@/lib/live-test.server");
          const res = await runLiveRound(false);
          return Response.json({
            ok: true,
            ran: res.ran,
            reason: res.reason ?? null,
            posts: res.posts,
            likes: res.likes,
            bots: res.bots.length,
          });
        } catch (error) {
          console.error("[bot-live-run] failed", error);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
