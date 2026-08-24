/**
 * Gemeinsamer Sitzungsstart (ein Aufruf für alle Bereiche).
 *
 * `bootstrap_user_state()` liefert die persönlichen Zustände plus Freigaben,
 * Werbepausen, Verbindungen, Chats, Ungelesen-Zähler und Benachrichtigungen.
 *
 * Damit dieselben Daten nicht mehrfach geholt werden, laufen alle Bereiche
 * (Datenkern, Social-Layer, SlangTag-Freigaben, Werbepausen) über diesen
 * gemeinsamen Zugriff: Der erste Aufruf holt die Daten, alle weiteren erhalten
 * dasselbe Ergebnis. Schlägt der Aufruf fehl, greift bei jedem Bereich
 * unverändert der bisherige Einzel-Ladeweg.
 */

import { supabase } from "@/integrations/supabase/client";

export type BootstrapRow = Record<string, unknown>;

export type SessionBootstrap = {
  user_id?: string;
  granted_tag_ids?: string[];
  ad_pauses?: BootstrapRow[];
  connections?: BootstrapRow[];
  conversations?: BootstrapRow[];
  unread_counts?: Record<string, number>;
  notifications?: BootstrapRow[];
  [key: string]: unknown;
};

type Entry = { userId: string; promise: Promise<SessionBootstrap | null> };

let current: Entry | null = null;

/**
 * Gebündelter Startabruf. `force` erzwingt einen frischen Aufruf (z. B. beim
 * manuellen Neuladen der Daten).
 */
export function loadSessionBootstrap(
  userId: string,
  force = false,
): Promise<SessionBootstrap | null> {
  if (!force && current && current.userId === userId) return current.promise;
  const promise = Promise.resolve(supabase.rpc("bootstrap_user_state"))
    .then((res) => (res.error ? null : ((res.data ?? null) as SessionBootstrap | null)))
    .catch(() => null);
  current = { userId, promise };
  return promise;
}

/** Beim Abmelden verworfen, damit kein fremder Stand übernommen wird. */
export function clearSessionBootstrap() {
  current = null;
}
