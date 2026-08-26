import { createContext, useContext } from "react";

export type Panel = "messenger" | "connections" | "notifications" | null;

export type UICtx = {
  panel: Panel;
  /** Optional direkt eine bestimmte Unterhaltung oeffnen (z. B. Market-Chat). */
  openMessenger: (userId?: string, conversationId?: string) => void;
  openConnections: () => void;
  openNotifications: () => void;
  close: () => void;
};

export const SocialUIContext = createContext<UICtx | null>(null);

/** Zugriff auf die globalen Social-Overlays. */
export function useSocialUI() {
  const ctx = useContext(SocialUIContext);
  if (!ctx) throw new Error("useSocialUI must be used within SocialLayer");
  return ctx;
}
