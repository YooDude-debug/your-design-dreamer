import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAllowedPushEndpoint } from "@/lib/push-endpoint";

/** Oeffentlicher VAPID-Schluessel fuer das Push-Abonnement im Browser. */
export const getPushConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { pushPublicKey } = await import("@/lib/push.server");
  return { publicKey: pushPublicKey() };
});

const deviceSchema = z.object({
  // SSRF-Schutz: nur Adressen der tatsaechlich unterstuetzten Push-Dienste.
  endpoint: z
    .string()
    .max(1000)
    .refine(isAllowedPushEndpoint, { message: "unsupported_push_endpoint" }),
  p256dh: z.string().min(10).max(500),
  auth: z.string().min(5).max(500),
  userAgent: z.string().max(300).default(""),
});

/** Geraet des angemeldeten Nutzers speichern (mehrere Geraete moeglich). */
export const savePushDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => deviceSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { saveSubscription, countDevices } = await import("@/lib/push.server");
    await saveSubscription(context.userId, data);
    return { ok: true, devices: await countDevices(context.userId) };
  });

/** Kontrollierter Test-Push an die eigenen Geraete (echter Versandweg). */
export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sendTestNotification } = await import("@/lib/push.server");
    return await sendTestNotification(context.userId);
  });

/** Geraet des angemeldeten Nutzers entfernen. */
export const removePushDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ endpoint: z.string().max(1000) }).parse(data))
  .handler(async ({ data, context }) => {
    const { removeSubscription } = await import("@/lib/push.server");
    await removeSubscription(context.userId, data.endpoint);
    return { ok: true };
  });

/**
 * Versandwarteschlange abarbeiten. Wird nach Aktionen im Hintergrund
 * angestossen ("fire and forget"), zusaetzlich laeuft ein regelmaessiger Lauf
 * ueber den oeffentlichen Endpunkt.
 */
export const flushPushQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const { processNotificationQueue } = await import("@/lib/push.server");
      return await processNotificationQueue(20);
    } catch (error) {
      // Hintergrundlauf darf die App nie mit einem 500 stoeren.
      console.error("flushPushQueue failed", error);
      return { processed: 0, sent: 0, skipped: true as const };
    }
  });
