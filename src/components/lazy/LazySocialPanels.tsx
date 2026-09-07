import { lazy, Suspense, type ComponentProps } from "react";
import type { Messenger } from "@/components/Messenger";
import type { ConnectionsPanel } from "@/components/ConnectionsPanel";
import type { NotificationsPanel } from "@/components/NotificationsPanel";

/**
 * P-05: Code-Splitting fuer die drei globalen Overlays (Nachrichten,
 * Kontakte, Benachrichtigungen).
 *
 * Die Panels liefern geschlossen ohnehin `null` und starten geschlossen keine
 * Effekte. Sie werden deshalb erst beim ersten Oeffnen geladen und bleiben
 * danach montiert – Verhalten, Zustand und Aussehen bleiben identisch, nur der
 * Programmcode wird nicht mehr auf jeder internen Seite mitgeladen.
 */
const MessengerImpl = lazy(() =>
  import("@/components/Messenger").then((m) => ({ default: m.Messenger })),
);
const ConnectionsPanelImpl = lazy(() =>
  import("@/components/ConnectionsPanel").then((m) => ({ default: m.ConnectionsPanel })),
);
const NotificationsPanelImpl = lazy(() =>
  import("@/components/NotificationsPanel").then((m) => ({ default: m.NotificationsPanel })),
);

export function LazyMessenger(props: ComponentProps<typeof Messenger> & { mounted: boolean }) {
  const { mounted, ...rest } = props;
  if (!mounted) return null;
  return (
    <Suspense fallback={null}>
      <MessengerImpl {...rest} />
    </Suspense>
  );
}

export function LazyConnectionsPanel(
  props: ComponentProps<typeof ConnectionsPanel> & { mounted: boolean },
) {
  const { mounted, ...rest } = props;
  if (!mounted) return null;
  return (
    <Suspense fallback={null}>
      <ConnectionsPanelImpl {...rest} />
    </Suspense>
  );
}

export function LazyNotificationsPanel(
  props: ComponentProps<typeof NotificationsPanel> & { mounted: boolean },
) {
  const { mounted, ...rest } = props;
  if (!mounted) return null;
  return (
    <Suspense fallback={null}>
      <NotificationsPanelImpl {...rest} />
    </Suspense>
  );
}
