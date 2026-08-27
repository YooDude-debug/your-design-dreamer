/**
 * Eingabeprüfung für Push-Geräte.
 *
 * Bewusst außerhalb von `push.functions.ts`: Dateien mit `createServerFn`
 * dürfen im Modulkopf nur Importe und Server-Funktionen enthalten. Zusätzliche
 * Konstanten im Modulkopf können beim Aufteilen der Server-Funktionen
 * verlorengehen und führen zu ungültigen Funktions-IDs.
 */
import { z } from "zod";
import { isAllowedPushEndpoint } from "@/lib/push-endpoint";

export const pushDeviceSchema = z.object({
  // SSRF-Schutz: nur Adressen der tatsaechlich unterstuetzten Push-Dienste.
  endpoint: z
    .string()
    .max(1000)
    .refine(isAllowedPushEndpoint, { message: "unsupported_push_endpoint" }),
  p256dh: z.string().min(10).max(500),
  auth: z.string().min(5).max(500),
  userAgent: z.string().max(300).default(""),
});
