/**
 * Kleine Outbox für kurzzeitige Netzwerkausfälle.
 *
 * Bewusste Grenzen (keine Offline-Architektur):
 * - nur reine Text-Nachrichten des Messengers, keine Bilder/Videos/Audio,
 *   keine Storage-Medien, keine Verläufe, keine Feed-Daten, keine Tokens.
 * - Speicherung in localStorage, nur so lange wie für den Retry nötig
 *   (TTL + begrenzte Versuche), danach wird der Eintrag verworfen.
 * - Idempotenz über die bestehende Struktur: die Primärschlüssel-UUID der
 *   Tabelle `messages` wird clientseitig erzeugt. Ein doppelter Sendeversuch
 *   läuft in einen Unique-Violation-Konflikt und gilt als bereits geliefert.
 */
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "y-dude:outbox:v1";
const SYNC_TAG = "ydude-outbox";
/** Nach dieser Zeit wird ein Eintrag verworfen (kurzer Ausfall, kein Archiv). */
const MAX_AGE_MS = 30 * 60 * 1000;
/** Endlicher Retry – niemals endlos wiederholen. */
const MAX_ATTEMPTS = 5;

export type OutboxMessage = {
  /** = messages.id (Idempotency-ID) */
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  slangTagIds: string[];
  createdAt: number;
  attempts: number;
  status: "pending" | "retrying";
};

type Listener = (items: OutboxMessage[]) => void;

const listeners = new Set<Listener>();
let flushing = false;

function read(): OutboxMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OutboxMessage[];
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed.filter((item) => now - item.createdAt < MAX_AGE_MS);
  } catch {
    return [];
  }
}

function write(items: OutboxMessage[]) {
  if (typeof window === "undefined") return;
  try {
    if (items.length === 0) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* Speicher voll o. ä. darf den Versand nie blockieren */
  }
  for (const listener of listeners) listener(items);
}

/** Ausstehende Einträge des angemeldeten Nutzers (nie fremde Konten). */
export function getOutbox(senderId: string | null): OutboxMessage[] {
  if (!senderId) return [];
  return read().filter((item) => item.senderId === senderId);
}

export function subscribeOutbox(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Nach Logout: ausstehende Aktionen verwerfen, damit nichts fremd landet. */
export function clearOutbox() {
  write([]);
}

export function isOfflineError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";
  return /failed to fetch|network|load failed|offline|timeout|fetch event/i.test(message);
}

/** Unique-Violation = derselbe Idempotency-Key ist schon angekommen. */
function isDuplicate(error: { code?: string | null } | null): boolean {
  return error?.code === "23505";
}

async function requestBackgroundSync() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sync = (reg as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } })
      .sync;
    // Ohne Browser-Support bleibt es beim normalen online-/Intervall-Retry.
    if (!sync) return;
    await sync.register(SYNC_TAG);
  } catch {
    /* Background Sync ist optional – niemals einen Fehler erzeugen */
  }
}

export function enqueueMessage(entry: Omit<OutboxMessage, "attempts" | "status">) {
  const items = read();
  if (items.some((item) => item.id === entry.id)) return;
  write([...items, { ...entry, attempts: 0, status: "pending" }]);
  void requestBackgroundSync();
}

export function removeFromOutbox(id: string) {
  write(read().filter((item) => item.id !== id));
}

/**
 * Sendet ausstehende Nachrichten des aktuellen Nutzers erneut.
 * Rückgabe: Anzahl erfolgreich übermittelter Nachrichten.
 */
export async function flushOutbox(senderId: string | null): Promise<number> {
  if (!senderId || flushing) return 0;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return 0;
  flushing = true;
  let delivered = 0;
  try {
    for (const item of read()) {
      // Nie unter einem anderen Konto senden.
      if (item.senderId !== senderId) continue;
      if (item.attempts >= MAX_ATTEMPTS) {
        removeFromOutbox(item.id);
        continue;
      }
      write(
        read().map((row) =>
          row.id === item.id ? { ...row, attempts: row.attempts + 1, status: "retrying" } : row,
        ),
      );
      try {
        const { error } = await supabase.from("messages").insert({
          id: item.id,
          conversation_id: item.conversationId,
          sender_id: item.senderId,
          kind: "text",
          body: item.body,
          slang_tag_ids: item.slangTagIds,
          delivered_at: new Date().toISOString(),
        });
        if (!error || isDuplicate(error)) {
          removeFromOutbox(item.id);
          delivered += 1;
          continue;
        }
        if (!isOfflineError(error)) {
          // Fachlicher Fehler (z. B. Berechtigung): nicht endlos wiederholen.
          removeFromOutbox(item.id);
        }
      } catch (err) {
        if (!isOfflineError(err)) removeFromOutbox(item.id);
      }
    }
  } finally {
    flushing = false;
  }
  return delivered;
}

/**
 * Verbindet die Outbox mit online-Ereignis, Service-Worker-Background-Sync und
 * einem sanften Intervall (Fallback ohne Background-Sync-Support).
 */
export function installOutboxFlush(
  senderId: string | null,
  onDelivered: () => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const run = async () => {
    if (read().length === 0) return;
    const delivered = await flushOutbox(senderId);
    if (delivered > 0) onDelivered();
  };
  const onOnline = () => void run();
  const onMessage = (event: MessageEvent) => {
    if ((event.data as { type?: string } | null)?.type === "ydude-outbox-flush") void run();
  };
  window.addEventListener("online", onOnline);
  if ("serviceWorker" in navigator)
    navigator.serviceWorker.addEventListener("message", onMessage);
  const timer = window.setInterval(() => void run(), 15000);
  void run();
  return () => {
    window.removeEventListener("online", onOnline);
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.removeEventListener("message", onMessage);
    window.clearInterval(timer);
  };
}
