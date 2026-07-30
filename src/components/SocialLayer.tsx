import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { SocialProvider } from "@/lib/social";
import { Messenger } from "@/components/Messenger";
import { ConnectionsPanel } from "@/components/ConnectionsPanel";
import { NotificationsPanel } from "@/components/NotificationsPanel";

type Panel = "messenger" | "connections" | "notifications" | null;

type UICtx = {
  panel: Panel;
  openMessenger: (userId?: string) => void;
  openConnections: () => void;
  openNotifications: () => void;
  close: () => void;
};

const Ctx = createContext<UICtx | null>(null);

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

  const openMessenger = useCallback((userId?: string) => {
    setChatUser(userId ?? null);
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
    <Ctx.Provider value={value}>
      {children}
      <Messenger open={panel === "messenger"} onClose={close} initialUserId={chatUser} />
      <ConnectionsPanel open={panel === "connections"} onClose={close} onMessage={(id) => openMessenger(id)} />
      <NotificationsPanel
        open={panel === "notifications"}
        onClose={close}
        onOpenConnections={openConnections}
        onOpenMessages={(id) => openMessenger(id)}
      />
    </Ctx.Provider>
  );
}

export function useSocialUI() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSocialUI must be used within SocialLayer");
  return ctx;
}
