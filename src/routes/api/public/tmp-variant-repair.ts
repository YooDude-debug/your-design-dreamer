import { createFileRoute } from "@tanstack/react-router";

/**
 * TEMPORÄRER Wartungs-Endpunkt (wird nach dem Bestandslauf gelöscht).
 * Erzeugt fehlende Bildvarianten über die bestehende Backstop-Logik.
 */
const TOKEN = "yd-variant-repair-2026-08-23-9f3a1c";

export const Route = createFileRoute("/api/public/tmp-variant-repair")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("token") !== TOKEN) {
          return new Response("Forbidden", { status: 403 });
        }
        const limit = Math.min(Number(url.searchParams.get("limit") ?? "20") || 20, 60);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { collectVariantInventory } = await import(
          "@/lib/media-variants-inventory.server"
        );
        const { ensureVariantsForPath, outcomeStatus } = await import(
          "@/lib/media-variants.server"
        );

        const inventory = await collectVariantInventory(supabaseAdmin);
        const targets = inventory.missingPaths.slice(0, limit);
        const details: unknown[] = [];
        let repaired = 0;
        let failed = 0;
        for (const entry of targets) {
          const result = await ensureVariantsForPath(supabaseAdmin, entry.path);
          const status = outcomeStatus(result);
          if (status === "done") repaired += 1;
          else {
            failed += 1;
            details.push({ path: entry.path, ...result });
          }
        }

        return Response.json({
          missingBefore: inventory.missingAny,
          processed: targets.length,
          repaired,
          failed,
          remaining: Math.max(inventory.missingAny - targets.length, 0),
          details: details.slice(0, 5),
        });
      },
    },
  },
});
