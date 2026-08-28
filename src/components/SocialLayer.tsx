import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { SocialUIContext, type ConnectionsTab, type Panel, type UICtx } from "@/lib/social-ui-context";
import { SocialProvider } from "@/lib/social";
import { Messenger } from "@/components/Messenger";
import { ConnectionsPanel } from "@/components/ConnectionsPanel";
import { NotificationsPanel } from "@/components/NotificationsPanel";

/** Hüllt den internen Bereich in Social-Daten und die globalen Overlays. */
export function SocialLayer({ children }: { children: ReactNode }) {
  return (
    <SocialProvider>
      <SocialUI>{children}</SocialUI>
    </SocialProvider>
  );
}

function SocialUI({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<Panel>(null);
  const [chatUser, setChatUser] = useState<string | null>(null);
  const [chatConversation, setChatConversation] = useState<string | null>(null);
  const [connectionsTab, setConnectionsTab] = useState<ConnectionsTab | null>(null);

  const openMessenger = useCallback((userId?: string, conversationId?: string) => {
    setChatUser(userId ?? null);
    setChatConversation(conversationId ?? null);
    setPanel("messenger");
  }, []);
  const openConnections = useCallback((tab?: ConnectionsTab) => {
    setConnectionsTab(tab ?? null);
    setPanel("connections");
  }, []);
  const openNotifications = useCallback(() => setPanel("notifications"), []);
  const close = useCallback(() => {
    setPanel(null);
    setConnectionsTab(null);
  }, []);

  /*
   * Antippen einer Chat-Push landet auf `?chat=<Unterhaltung>`: den Messenger
   * genau dort oeffnen (er scrollt selbst an die neuesten Nachrichten) und den
   * Parameter danach aus der Adresse entfernen.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const apply = () => {
      const params = new URLSearchParams(window.location.search);
      const chat = params.get("chat");
      if (!chat) return;
      openMessenger(undefined, chat);
      params.delete("chat");
      const query = params.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${query ? `?${query}` : ""}`,
      );
    };
    apply();
    const onPop = () => apply();
    window.addEventListener("popstate", onPop);

    // Laeuft die App bereits, meldet der Push-Worker das Ziel direkt.
    const onSwMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; link?: string } | null;
      if (data?.type !== "push-navigate" || typeof data.link !== "string") return;
      const chat = new URLSearchParams(data.link.split("?")[1] ?? "").get("chat");
      if (chat) openMessenger(undefined, chat);
    };
    const sw = typeof navigator !== "undefined" ? navigator.serviceWorker : undefined;
    sw?.addEventListener("message", onSwMessage);

    return () => {
      window.removeEventListener("popstate", onPop);
      sw?.removeEventListener("message", onSwMessage);
    };
  }, [openMessenger]);

  const value = useMemo<UICtx>(
    () => ({ panel, openMessenger, openConnections, openNotifications, close }),
    [panel, openMessenger, openConnections, openNotifications, close],
  );

  return (
    <SocialUIContext.Provider value={value}>
      {children}
      <Messenger
        open={panel === "messenger"}
        onClose={close}
        initialUserId={chatUser}
        initialConversationId={chatConversation}
      />
      <ConnectionsPanel
        open={panel === "connections"}
        onClose={close}
        onMessage={(id) => openMessenger(id)}
        initialTab={connectionsTab ?? undefined}
      />
      <NotificationsPanel
        open={panel === "notifications"}
        onClose={close}
        onOpenConnections={openConnections}
        onOpenMessages={(id) => openMessenger(id)}
      />
    </SocialUIContext.Provider>
  );
}
