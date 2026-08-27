import { CloseButton } from "@/components/ui/nav-buttons";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  X,
  Bell,
  BellOff,
  UserPlus,
  UserCheck,
  MessageSquare,
  Heart,
  MessageCircle,
  Reply,
  AtSign,
  Tag,
  Megaphone,
  ShieldCheck,
  Info,
  CheckCheck,
  Trash2,
  ShoppingBag,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { sendTestPush } from "@/lib/push.functions";
import { useNavigate } from "@tanstack/react-router";
import { useData } from "@/lib/data-context";
import { useLang } from "@/lib/lang-context";
import { useSocial } from "@/lib/social-context";
import { relativeTime } from "@/lib/types";
import { notificationLink, notificationTitle } from "@/lib/push-shared";

const ICONS: Record<string, typeof Bell> = {
  connection_request: UserPlus,
  connection_accepted: UserCheck,
  message: MessageSquare,
  post_like: Heart,
  comment: MessageCircle,
  comment_reply: Reply,
  mention: AtSign,
  slangtag_used: Tag,
  slangtag_liked: Tag,
  ad_campaign: Megaphone,
  moderation: ShieldCheck,
  system: Info,
  market_match: ShoppingBag,
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
  const { profiles, ensureProfiles } = useData();
  const { t } = useLang();
  const navigate = useNavigate();
  const {
    notifications,
    unreadNotifications,
    markNotificationsRead,
    deleteNotification,
    deleteReadNotifications,
    pushEnabled,
    pushBusy,
    pushSupported,
    pushPermission,
    setPushEnabled,
  } = useSocial();

  /** Like-Geber je Beitrag (nur für gebündelte Like-Benachrichtigungen). */
  const [likers, setLikers] = useState<Record<string, string[]>>({});
  const [testBusy, setTestBusy] = useState(false);

  /**
   * Test-Push über den echten Versandweg. Ergebnis wird ehrlich gemeldet:
   * „gesendet“ nur, wenn der Push-Dienst die Nachricht angenommen hat.
   */
  const runTestPush = async () => {
    if (testBusy) return;
    setTestBusy(true);
    try {
      const res = await sendTestPush({ data: undefined });
      if (res.sent > 0) {
        toast.success(`Test-Push an ${res.sent} Gerät(e) gesendet.`);
      } else {
        toast.error("Test-Push konnte nicht zugestellt werden.", {
          description: `Code: ${res.error ?? "unknown"}`,
        });
      }
    } catch (error) {
      console.error("[push] test failed", error);
      toast.error("Test-Push konnte nicht gesendet werden.");
    } finally {
      setTestBusy(false);
    }
  };

  // Beim Öffnen automatisch alle Benachrichtigungen als gelesen markieren.
  useEffect(() => {
    if (open) void markNotificationsRead();
  }, [open, markNotificationsRead]);

  // Namen der auslösenden Nutzer nachladen, damit immer "@name hat ..." steht.
  useEffect(() => {
    if (!open) return;
    const missing = Array.from(
      new Set(
        notifications
          .map((n) => n.actorId)
          .filter((id): id is string => Boolean(id) && !profiles[id as string]),
      ),
    );
    if (missing.length) void ensureProfiles(missing);
  }, [open, notifications, profiles, ensureProfiles]);

  // Beiträge mit gebündelten Likes – die Namen kommen aus den echten
  // Like-Daten der Datenbank, nicht aus einer Frontend-Zählung.
  const likePostIds = useMemo(
    () =>
      Array.from(
        new Set(
          notifications
            .filter((n) => n.type === "post_like" && n.groupCount > 1 && n.entityId)
            .map((n) => n.entityId as string),
        ),
      ),
    [notifications],
  );
  const likersKey = likePostIds.join(",");

  useEffect(() => {
    if (!open || !likersKey) return;
    let cancelled = false;
    void (async () => {
      // Eine einzige Abfrage für alle gebündelten Like-Benachrichtigungen.
      const { data } = await supabase
        .from("post_likes")
        .select("post_id,user_id,created_at")
        .in("post_id", likersKey.split(","))
        .order("created_at", { ascending: false })
        .limit(300);
      if (cancelled) return;
      const map: Record<string, string[]> = {};
      for (const row of data ?? []) {
        const list = (map[row.post_id] ??= []);
        if (!list.includes(row.user_id)) list.push(row.user_id);
      }
      setLikers(map);
      const ids = Object.values(map).flat();
      if (ids.length) void ensureProfiles(ids);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, likersKey, ensureProfiles]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:p-6">
      <div className="my-4 w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-glow">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="inline-flex shrink-0 items-center gap-2 text-lg font-black tracking-tight">
            <Bell className="h-5 w-5 text-brand" /> {t.notifications}
          </h2>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={() => void markNotificationsRead()}
              disabled={unreadNotifications === 0}
              className="inline-flex h-7 items-center gap-1 rounded-full border border-border px-2.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:border-brand/50 hover:text-brand disabled:opacity-40"
            >
              <CheckCheck className="h-3 w-3" /> Alle gelesen
            </button>
            <button
              onClick={() => void deleteReadNotifications()}
              disabled={notifications.every((n) => !n.read)}
              className="inline-flex h-7 items-center gap-1 rounded-full border border-border px-2.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:border-brand/50 hover:text-brand disabled:opacity-40"
            >
              <Trash2 className="h-3 w-3" /> Gelesene löschen
            </button>
            <CloseButton onClick={onClose} label={t.close} />
          </div>
        </div>

        {/* Push-Schalter: dauerhaft im Profil gespeichert */}
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-background/40 p-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-brand/50 text-brand">
              {pushEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">Push-Benachrichtigungen</span>
              <span className="block text-[11px] text-muted-foreground">
                {!pushSupported
                  ? "Auf diesem Gerät nicht verfügbar."
                  : pushPermission === "denied"
                    ? "Im Browser blockiert – bitte dort erlauben."
                    : pushEnabled
                      ? "Aktiv auf diesem Gerät."
                      : "Aus – du erhältst nur In-App-Hinweise."}
              </span>
            </span>
          </div>
          <button
            role="switch"
            aria-checked={pushEnabled}
            aria-label="Push-Benachrichtigungen"
            disabled={pushBusy || !pushSupported}
            onClick={() => void setPushEnabled(!pushEnabled)}
            className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-40 ${
              pushEnabled ? "border-brand bg-brand/80" : "border-border bg-background"
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-foreground transition-transform ${
                pushEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Kontrollierter Test-Push: geht den echten Versandweg. */}
        {pushEnabled && (
          <button
            onClick={() => void runTestPush()}
            disabled={testBusy}
            className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-brand/50 hover:text-brand disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" /> {testBusy ? "Test läuft …" : "Test-Push senden"}
          </button>
        )}

        <div className="mt-4 space-y-2">
          {notifications.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              {t.noNotifications}
            </p>
          )}
          {notifications.map((n) => {
            const Icon = ICONS[n.type] ?? Bell;
            const actor = n.actorId ? profiles[n.actorId] : undefined;
            // Gebündelte Likes: Gesamtzahl statt Einzelmeldung.
            const grouped = n.type === "post_like" && n.groupCount > 1;
            const likerIds = grouped && n.entityId ? (likers[n.entityId] ?? []) : [];
            return (
              <div key={n.id} className="relative">
                <button
                  onClick={() => {
                    if (n.type === "message") {
                      onOpenMessages(n.actorId ?? undefined);
                      return;
                    }
                    if (n.type === "connection_request" || n.type === "connection_accepted") {
                      onOpenConnections();
                      return;
                    }
                    const target = notificationLink({
                      type: n.type,
                      link: n.link,
                      entityType: n.entityType,
                      entityId: n.entityId,
                    });
                    onClose();
                    void navigate({ to: target });
                  }}
                  className={`flex w-full items-start gap-3 rounded-xl border p-3 pr-9 text-left transition-colors hover:bg-brand/10 ${
                    n.read ? "border-border bg-background/40" : "border-brand/40 bg-brand/5"
                  }`}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-brand/50 text-brand">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-bold uppercase tracking-wide text-brand">
                      {grouped ? "Neue Likes" : notificationTitle(n.type, n.title)}
                    </span>
                    {grouped ? (
                      <>
                        <span className="block text-sm">
                          {n.groupCount} Personen haben deinen Beitrag geliked.
                        </span>
                        {likerIds.length > 0 && (
                          <span className="mt-1 block max-h-32 space-y-0.5 overflow-y-auto pr-1">
                            {likerIds.map((id) => (
                              <span
                                key={id}
                                className="flex items-center gap-1.5 text-[12px] text-muted-foreground"
                              >
                                <Heart className="h-3 w-3 shrink-0 text-brand" />
                                <span className="truncate">@{profiles[id]?.username ?? "…"}</span>
                              </span>
                            ))}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="block text-sm">
                        {actor && <span className="font-semibold">@{actor.username} </span>}
                        {n.body}
                      </span>
                    )}
                    <span className="block text-[11px] text-muted-foreground">
                      {relativeTime(n.createdAt)}
                    </span>
                  </span>
                  {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand" />}
                </button>
                <button
                  onClick={() => void deleteNotification(n.id)}
                  aria-label="Benachrichtigung löschen"
                  className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-brand/10 hover:text-brand"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
