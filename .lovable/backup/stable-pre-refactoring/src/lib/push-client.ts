/**
 * Browser-Seite des Push-Systems.
 *
 * Registriert den reinen Nachrichten-Worker (`/push-sw.js`), verwaltet das
 * Abonnement und meldet es serverseitig an. Der Worker cached nichts und ist
 * damit unabhaengig von der PWA-/Preview-Logik in `pwa.ts`.
 */

import { getPushConfig, removePushDevice, savePushDevice } from "@/lib/push.functions";
import { urlBase64ToUint8Array } from "@/lib/push-shared";

const SW_URL = "/push-sw.js";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function pushPermission(): NotificationPermission | "unsupported" {
  if (!pushSupported()) return "unsupported";
  return Notification.permission;
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  try {
    return await navigator.serviceWorker.register(SW_URL, { scope: "/" });
  } catch {
    return null;
  }
}

function toKeys(sub: PushSubscription) {
  const json = sub.toJSON();
  return {
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? "",
  };
}

export type EnableResult = "enabled" | "denied" | "unsupported" | "error";

/** Berechtigung anfragen, abonnieren und serverseitig speichern. */
export async function enablePush(): Promise<EnableResult> {
  if (!pushSupported()) return "unsupported";
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";

    const reg = await registration();
    if (!reg) return "error";
    await navigator.serviceWorker.ready;

    const { publicKey } = await getPushConfig();
    if (!publicKey) return "error";

    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      }));

    const keys = toKeys(sub);
    if (!keys.p256dh || !keys.auth) return "error";
    await savePushDevice({
      data: { ...keys, userAgent: navigator.userAgent.slice(0, 300) },
    });
    return "enabled";
  } catch {
    return "error";
  }
}

/** Abonnement dieses Geraets beenden und serverseitig entfernen. */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_URL);
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await removePushDevice({ data: { endpoint: sub.endpoint } });
      await sub.unsubscribe();
    }
  } catch {
    /* Abmelden darf nie einen Fehler nach oben geben */
  }
}

/** Nach Neustart/Abo-Erneuerung sicherstellen, dass das Geraet bekannt ist. */
export async function syncPushDevice(): Promise<void> {
  if (!pushSupported() || Notification.permission !== "granted") return;
  const result = await enablePush();
  if (result !== "enabled") console.warn("[push] Geraet konnte nicht synchronisiert werden");
}
