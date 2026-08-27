/**
 * Messenger – Ableitung von Kategorie und Zustand beim Öffnen.
 *
 * Bewusst als reine Logik ohne React: der historische Fehler „Messenger bleibt
 * nach einem Market-Chat in der Market-Liste hängen“ soll dauerhaft durch
 * Tests abgesichert sein, ohne von UI-Details abzuhängen.
 */

export type MessengerCategory = "connections" | "market";

/** Eine Unterhaltung gilt als Market-Chat, wenn sie an einen Artikel gebunden ist. */
export function categoryForConversation(
  conv: { marketItemId?: string | null } | null | undefined,
): MessengerCategory {
  return conv?.marketItemId ? "market" : "connections";
}

/**
 * Wird der Messenger ohne konkretes Ziel geöffnet oder geschlossen, muss der
 * alte Zustand fallen: sonst bleibt die zuletzt benutzte Kategorie (Market)
 * aktiv und die normalen Connection-Chats sind nicht erreichbar.
 */
export function shouldResetMessengerState(
  open: boolean,
  target: { conversationId?: string | null; userId?: string | null },
): boolean {
  return !(open && (target.conversationId || target.userId));
}

/**
 * Kategorie der tatsächlich geöffneten Unterhaltung – aber nur einmal je
 * Unterhaltung, damit ein manueller Kategoriewechsel des Nutzers erhalten
 * bleibt, wenn die Chatliste im Hintergrund aktualisiert wird.
 */
export function syncCategoryForActive(input: {
  open: boolean;
  activeId: string | null;
  syncedFor: string | null;
  conversations: Array<{ id: string; marketItemId?: string | null }>;
}): { category: MessengerCategory | null; syncedFor: string | null } {
  if (!input.open || !input.activeId) return { category: null, syncedFor: null };
  if (input.syncedFor === input.activeId) return { category: null, syncedFor: input.syncedFor };
  const conv = input.conversations.find((c) => c.id === input.activeId);
  if (!conv) return { category: null, syncedFor: input.syncedFor };
  return { category: categoryForConversation(conv), syncedFor: input.activeId };
}
