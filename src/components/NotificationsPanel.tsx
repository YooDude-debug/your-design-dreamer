import { useEffect } from "react";
import { X, Bell, UserPlus, UserCheck, MessageSquare } from "lucide-react";
import { useData } from "@/lib/data";
import { useLang } from "@/lib/i18n";
import { useSocial } from "@/lib/social";
import { relativeTime } from "@/lib/types";

const ICONS: Record<string, typeof Bell> = {
  connection_request: UserPlus,
  connection_accepted: UserCheck,
  message: MessageSquare,
};

export function NotificationsPanel({
  open,
  onClose,
  onOpenConnections,
  onOpenMessages,
}: {
  open: boolean;
  onClose: () => void;
  onOpenConnections: () => void;
  onOpenMessages: (userId?: string) => void;
}) {
  const { profiles } = useData();
  const { t } = useLang();
  const { notifications, markNotificationsRead } = useSocial();

  // Beim Öffnen automatisch alle Benachrichtigungen als gelesen markieren.
  useEffect(() => {
    if (open) void markNotificationsRead();
  }, [open, markNotificationsRead]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:p-6">
      <div className="my-4 w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-glow">
        <div className="flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 text-lg font-black tracking-tight">
            <Bell className="h-5 w-5 text-brand" /> {t.notifications}
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              aria-label={t.close}
              className="text-muted-foreground hover:text-brand"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>


        <div className="mt-4 space-y-2">
          {notifications.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              {t.noNotifications}
            </p>
          )}
          {notifications.map((n) => {
            const Icon = ICONS[n.type] ?? Bell;
            const actor = n.actorId ? profiles[n.actorId] : undefined;
            return (
              <button
                key={n.id}
                onClick={() => {
                  if (n.type === "message") onOpenMessages(n.actorId ?? undefined);
                  else onOpenConnections();
                }}
                className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-brand/10 ${
                  n.read ? "border-border bg-background/40" : "border-brand/40 bg-brand/5"
                }`}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-brand/50 text-brand">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm">
                    <span className="font-semibold">@{actor?.username ?? t.someone}</span> {n.body}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {relativeTime(n.createdAt)}
                  </span>
                </span>
                {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
