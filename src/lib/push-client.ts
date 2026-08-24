/**
 * Browser-Seite des Push-Systems.
 *
 * Registriert den reinen Nachrichten-Worker (`/push-sw.js`), verwaltet das
 * Abonnement und meldet es serverseitig an. Der Worker cached nichts und ist
 * damit unabhaengig von der PWA-/Preview-Logik.
 *
 * Wichtig: Kein Schritt der Kette wird verschluckt. Jeder Fehlschlag liefert
 * einen eindeutigen Grund zurueck (`PushReason`) und wird zusaetzlich in der
 * Konsole protokolliert – der Schalter im UI kann daraus eine verstaendliche
 * Meldung bauen statt still auf AUS zu springen.
 */

import { getPushConfig, removePushDevice, savePushDevice } from "@/lib/push.functions";
import { urlBase64ToUint8Array } from "@/lib/push-shared";

const SW_URL = "/push-sw.js";

/** Eindeutige Ursachen entlang der Push-Kette (Browser → Server). */
export type PushReason =
  | "ok"
  | "unsupported"
  | "insecure_context"
  | "permission_denied"
  | "permission_dismissed"
  | "service_worker_failed"
  | "no_vapid_key"
  | "invalid_vapid_key"
  | "subscribe_failed"
  | "incomplete_subscription"
  | "endpoint_not_supported"
  | "save_failed";

export type PushResult = { ok: boolean; reason: PushReason; detail?: string };

function log(reason: PushReason, detail?: unknown) {
  // Technische Details bleiben in der Konsole, nicht im UI-Text.
  console.error(`[push] ${reason}`, detail ?? "");
}

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

/** Push braucht einen sicheren Kontext (HTTPS oder localhost). */
function secureContext(): boolean {
  return typeof window !== "undefined" && window.isSecureContext === true;
}

/** Registrierung des Push-Workers – eigener Worker, eigener Zweck. */
async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.register(SW_URL, { scope: "/" });
    // Auf einen aktiven Worker warten: ohne aktive Instanz kann der
    // PushManager kein Abo anlegen.
    await navigator.serviceWorker.ready;
    return reg;
  } catch (error) {
    log("service_worker_failed", error);
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

/** Grobe Formpruefung des oeffentlichen VAPID-Schluessels (base64url, 65 Byte). */
function vapidKeyBytes(publicKey: string): Uint8Array | null {
  try {
    const bytes = urlBase64ToUint8Array(publicKey);
    if (bytes.length !== 65 || bytes[0] !== 4) return null;
    return bytes;
  } catch {
    return null;
  }
}

/** Gehoert ein bestehendes Abo noch zum aktuellen Serverschluessel? */
function sameServerKey(sub: PushSubscription, key: Uint8Array): boolean {
  const raw = sub.options?.applicationServerKey;
  if (!raw) return true; // Browser gibt den Schluessel nicht immer heraus.
  const current = new Uint8Array(raw as ArrayBuffer);
  if (current.length !== key.length) return false;
  return current.every((b, i) => b === key[i]);
}

/**
 * Vollstaendige Aktivierung: Berechtigung → Service Worker → PushManager →
 * Abo → Serverspeicherung. Bricht mit eindeutigem Grund ab.
 */
export async function enablePush(): Promise<PushResult> {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };
  if (!secureContext()) {
    log("insecure_context", location.origin);
    return { ok: false, reason: "insecure_context" };
  }

  // 1) Berechtigung: "denied" wird nicht erneut angefragt (Browser blockt).
  if (Notification.permission === "denied") return { ok: false, reason: "permission_denied" };
  let permission: NotificationPermission = Notification.permission;
  if (permission !== "granted") {
    try {
      permission = await Notification.requestPermission();
    } catch (error) {
      log("permission_dismissed", error);
      return { ok: false, reason: "permission_dismissed" };
    }
  }
  if (permission === "denied") return { ok: false, reason: "permission_denied" };
  if (permission !== "granted") return { ok: false, reason: "permission_dismissed" };

  // 2) Service Worker
  const reg = await registration();
  if (!reg) return { ok: false, reason: "service_worker_failed" };
  if (!("pushManager" in reg)) {
    log("unsupported", "registration without pushManager");
    return { ok: false, reason: "unsupported" };
  }

  // 3) VAPID-Schluessel vom Server holen und pruefen
  let publicKey = "";
  try {
    publicKey = (await getPushConfig()).publicKey ?? "";
  } catch (error) {
    log("no_vapid_key", error);
    return { ok: false, reason: "no_vapid_key" };
  }
  if (!publicKey) {
    log("no_vapid_key", "server returned empty key");
    return { ok: false, reason: "no_vapid_key" };
  }
  const keyBytes = vapidKeyBytes(publicKey);
  if (!keyBytes) {
    log("invalid_vapid_key", `length=${publicKey.length}`);
    return { ok: false, reason: "invalid_vapid_key" };
  }

  // 4) Abo: bestehendes wiederverwenden, veraltetes ersetzen
  let sub: PushSubscription | null = null;
  try {
    const existing = await reg.pushManager.getSubscription();
    if (existing && !sameServerKey(existing, keyBytes)) {
      // Schluessel gewechselt -> altes Abo ist unbrauchbar.
      await removePushDevice({ data: { endpoint: existing.endpoint } }).catch(() => undefined);
      await existing.unsubscribe().catch(() => undefined);
      sub = null;
    } else {
      sub = existing;
    }
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes as BufferSource,
      });
    }
  } catch (error) {
    log("subscribe_failed", error);
    return { ok: false, reason: "subscribe_failed", detail: (error as Error)?.message };
  }

  const keys = toKeys(sub);
  if (!keys.endpoint || !keys.p256dh || !keys.auth) {
    log("incomplete_subscription", keys.endpoint);
    return { ok: false, reason: "incomplete_subscription" };
  }

  // 5) Serverseitig speichern – erst danach gilt Push als aktiv.
  try {
    const saved = await savePushDevice({
      data: { ...keys, userAgent: navigator.userAgent.slice(0, 300) },
    });
    if (!saved?.ok || !saved.devices) {
      log("save_failed", saved);
      return { ok: false, reason: "save_failed" };
    }
  } catch (error) {
    const message = (error as Error)?.message ?? "";
    if (message.includes("unsupported_push_endpoint")) {
      log("endpoint_not_supported", keys.endpoint);
      return { ok: false, reason: "endpoint_not_supported", detail: keys.endpoint };
    }
    log("save_failed", error);
    return { ok: false, reason: "save_failed", detail: message };
  }

  return { ok: true, reason: "ok" };
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
  } catch (error) {
    // Abmelden darf nie einen Fehler nach oben geben – aber sichtbar bleiben.
    console.warn("[push] disable failed", error);
  }
}

/**
 * Tatsaechlicher Zustand dieses Geraets (kein gespeicherter Boolean):
 * Berechtigung erteilt UND ein Abo im Browser vorhanden.
 */
export async function pushDeviceActive(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_URL);
    const sub = await reg?.pushManager.getSubscription();
    return Boolean(sub);
  } catch {
    return false;
  }
}

/**
 * Nach Neustart/Abo-Erneuerung sicherstellen, dass das Geraet bekannt ist.
 * Liefert den tatsaechlichen Zustand zurueck, damit der Schalter nicht
 * "AN" zeigt, wenn die Kette in Wahrheit unterbrochen ist.
 */
export async function syncPushDevice(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  const result = await enablePush();
  if (!result.ok) console.warn("[push] Geraet konnte nicht synchronisiert werden", result.reason);
  return result.ok;
}
