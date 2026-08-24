/**
 * @username-Erwähnungen (Mentions).
 *
 * Bewusst getrennt von SlangTags und Moderation: hier geht es ausschließlich
 * um das Erkennen, Auflösen und Suchen von Benutzernamen. Es werden nur
 * tatsächlich existierende Profile als Mention dargestellt.
 */
import { supabase } from "@/integrations/supabase/client";

/** Erlaubte Zeichen in einem Benutzernamen. */
const HANDLE = "[A-Za-z0-9_.]";

/** Erkennt eine Mention direkt vor dem Cursor (Autovervollständigung). */
export const MENTION_AT_CURSOR = new RegExp(`(?:^|[^\\w@])@(${HANDLE}{0,40})$`);

/** Zerlegt Text in Mentions und normalen Text. */
export const MENTION_GLOBAL = new RegExp(`(@${HANDLE}{2,40})`, "g");

export type MentionProfile = { id: string; username: string; avatar: string | null };

/** Bereits aufgelöste Handles (klein geschrieben) – bekannte und unbekannte. */
const known = new Map<string, MentionProfile>();
const unknown = new Set<string>();
const pending = new Map<string, Promise<void>>();

export function cachedMention(handle: string): MentionProfile | null | undefined {
  const key = handle.toLowerCase();
  if (known.has(key)) return known.get(key)!;
  if (unknown.has(key)) return null;
  return undefined;
}

/** Prüft eine Liste von Handles gegen die Datenbank (mit Cache). */
export async function resolveMentions(handles: string[]): Promise<void> {
  const missing = [...new Set(handles.map((h) => h.toLowerCase()))].filter(
    (h) => cachedMention(h) === undefined,
  );
  if (!missing.length) return;
  const key = missing.sort().join(",");
  const running = pending.get(key);
  if (running) return running;

  const task = (async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id,username,avatar_url")
      .in("username", missing);
    for (const row of data ?? []) {
      known.set(String(row.username).toLowerCase(), {
        id: row.id as string,
        username: row.username as string,
        avatar: (row.avatar_url as string | null) ?? null,
      });
    }
    for (const h of missing) if (!known.has(h)) unknown.add(h);
  })().finally(() => pending.delete(key));

  pending.set(key, task);
  return task;
}

/** Vorschläge für die Autovervollständigung beim Tippen von `@`. */
export async function searchMentions(query: string, limit = 6): Promise<MentionProfile[]> {
  const q = query.trim();
  const builder = supabase.from("profiles").select("id,username,avatar_url").limit(limit);
  const { data } = q
    ? await builder.ilike("username", `${q}%`).order("username")
    : await builder.order("last_seen_at", { ascending: false });
  const list = (data ?? []).map((row) => ({
    id: row.id as string,
    username: row.username as string,
    avatar: (row.avatar_url as string | null) ?? null,
  }));
  for (const p of list) known.set(p.username.toLowerCase(), p);
  return list;
}

/** Alle im Text erwähnten (existierenden) Handles. */
export function extractMentions(text: string): string[] {
  return [
    ...new Set(
      (text.match(MENTION_GLOBAL) ?? []).map((m) => m.slice(1).replace(/\.+$/, "").toLowerCase()),
    ),
  ];
}
