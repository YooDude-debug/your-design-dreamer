import { describe, expect, it } from "vitest";
import {
  categoryForConversation,
  shouldResetMessengerState,
  syncCategoryForActive,
} from "@/lib/messenger-view";

const connectionChat = { id: "c1", marketItemId: null };
const marketChat = { id: "m1", marketItemId: "item-1" };
const conversations = [connectionChat, marketChat];

describe("Messenger – Kategorie einer Unterhaltung", () => {
  it("erkennt Market-Chats an der Artikelbindung", () => {
    expect(categoryForConversation(marketChat)).toBe("market");
  });

  it("behandelt Chats ohne Artikel als Connection-Chat", () => {
    expect(categoryForConversation(connectionChat)).toBe("connections");
    expect(categoryForConversation(undefined)).toBe("connections");
  });
});

describe("Messenger – Zustand beim Öffnen/Schließen", () => {
  it("setzt zurück, wenn ohne Ziel geöffnet wird", () => {
    expect(shouldResetMessengerState(true, {})).toBe(true);
  });

  it("setzt beim Schließen zurück", () => {
    expect(shouldResetMessengerState(false, { conversationId: "m1" })).toBe(true);
  });

  it("behält den Zustand bei direktem Ziel", () => {
    expect(shouldResetMessengerState(true, { conversationId: "m1" })).toBe(false);
    expect(shouldResetMessengerState(true, { userId: "u1" })).toBe(false);
  });
});

describe("Messenger – Kategoriewechsel", () => {
  it("schaltet einmalig auf die Kategorie der offenen Unterhaltung", () => {
    const first = syncCategoryForActive({
      open: true,
      activeId: "m1",
      syncedFor: null,
      conversations,
    });
    expect(first).toEqual({ category: "market", syncedFor: "m1" });

    const again = syncCategoryForActive({
      open: true,
      activeId: "m1",
      syncedFor: "m1",
      conversations,
    });
    expect(again.category).toBeNull();
  });

  it("wartet, bis die Unterhaltung geladen ist", () => {
    const result = syncCategoryForActive({
      open: true,
      activeId: "unbekannt",
      syncedFor: null,
      conversations,
    });
    expect(result).toEqual({ category: null, syncedFor: null });
  });

  it("Regression: nach Market-Chat und erneutem Öffnen ohne Ziel erscheinen Connection-Chats", () => {
    // 1. Market-Chat geöffnet
    const opened = syncCategoryForActive({
      open: true,
      activeId: "m1",
      syncedFor: null,
      conversations,
    });
    expect(opened.category).toBe("market");

    // 2. Messenger geschlossen -> Zustand muss fallen
    expect(shouldResetMessengerState(false, {})).toBe(true);

    // 3. Erneut ohne Ziel geöffnet -> Reset greift, keine Kategorie wird erzwungen
    expect(shouldResetMessengerState(true, {})).toBe(true);
    const reopened = syncCategoryForActive({
      open: true,
      activeId: null,
      syncedFor: "m1",
      conversations,
    });
    expect(reopened).toEqual({ category: null, syncedFor: null });
  });
});
