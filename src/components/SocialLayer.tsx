import { useCallback, useMemo, useState, type ReactNode } from "react";
import { SocialUIContext, type Panel, type UICtx } from "@/lib/social-ui-context";
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

  const openMessenger = useCallback((userId?: string, conversationId?: string) => {
    setChatUser(userId ?? null);
    setChatConversation(conversationId ?? null);
    setPanel("messenger");
  }, []);
  const openConnections = useCallback(() => setPanel("connections"), []);
  const openNotifications = useCallback(() => setPanel("notifications"), []);
  const close = useCallback(() => setPanel(null), []);

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
