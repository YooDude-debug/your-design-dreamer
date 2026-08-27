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

/** Zugriff ohne Zwang: `null`, wenn keine Overlay-Hülle darüber liegt. */
export function useSocialUIOptional() {
  return useContext(SocialUIContext);
}

/** Zugriff auf die globalen Social-Overlays. */
export function useSocialUI() {
  const ctx = useContext(SocialUIContext);
  if (!ctx) throw new Error("useSocialUI must be used within SocialLayer");
  return ctx;
}

