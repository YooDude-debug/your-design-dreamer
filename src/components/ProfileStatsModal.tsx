import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  X,
  Play,
  Repeat2,
  Heart,
  MessageCircle,
  Trash2,
  MessageSquare,
  User as UserIcon,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useData } from "@/lib/data-context";
import { useSocial } from "@/lib/social-context";
import { useSocialUI } from "@/lib/social-ui-context";
import { useLang } from "@/lib/lang-context";
import { formatStat, type Profile } from "@/lib/types";
import { SlangTagName } from "@/components/SlangTagName";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export type StatsTab = "tags" | "connections" | "posts" | "likes";

/** Detailansicht hinter den Profil-Statistiken (SlangTags, Connections, Beiträge, Likes). */
export function ProfileStatsModal({
  open,
  tab,
  onTabChange,
  onClose,
}: {
  open: boolean;
  tab: StatsTab;
  onTabChange: (tab: StatsTab) => void;
  onClose: () => void;
}) {
  const { t } = useLang();
  const navigate = useNavigate();
  const { me, posts, tags, profiles, canDeleteTag, deleteTag } = useData();
  const { connectedIds } = useSocial();
  const { openMessenger } = useSocialUI();

  const [confirmTagId, setConfirmTagId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [likers, setLikers] = useState<{ profile: Profile; postId: string; at: number }[]>([]);
  const [loadingLikes, setLoadingLikes] = useState(false);

  const myPosts = useMemo(
    () => posts.filter((p) => p.userId === me?.id).sort((a, b) => b.createdAt - a.createdAt),
    [posts, me],
  );
  const myTags = useMemo(
    () => tags.filter((x) => x.creatorId === me?.id).sort((a, b) => b.createdAt - a.createdAt),
    [tags, me],
  );
  const totalLikes = myPosts.reduce((sum, p) => sum + p.stats.likes, 0);

  // Likes auf eigene Beiträge live nachladen
  useEffect(() => {
    if (!open || tab !== "likes" || !me) return;
    let cancelled = false;
    const load = async () => {
      setLoadingLikes(true);
      const ids = myPosts.map((p) => p.id);
      if (ids.length === 0) {
        if (!cancelled) {
          setLikers([]);
          setLoadingLikes(false);
        }
        return;
      }
      const { data } = await supabase
        .from("post_likes")
        .select("post_id, user_id, created_at")
        .in("post_id", ids)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      setLikers(
        (data ?? [])
          .map((r) => ({
            profile: profiles[r.user_id as string],
            postId: r.post_id as string,
            at: new Date(r.created_at as string).getTime(),
          }))
          .filter((x): x is { profile: Profile; postId: string; at: number } => !!x.profile),
      );
      setLoadingLikes(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, tab, me, myPosts, profiles]);

  const removeTag = async () => {
    if (!confirmTagId) return;
    setBusy(true);
    const ok = await deleteTag(confirmTagId);
    setBusy(false);
    setConfirmTagId(null);
    toast[ok ? "success" : "error"](ok ? t.tagDeleted : t.tagDeleteFailed);
  };

  if (!open || !me) return null;

  const tabs: { key: StatsTab; label: string; count: number }[] = [
    { key: "tags", label: t.statSlangTags, count: myTags.length },
    { key: "connections", label: t.statConnections, count: connectedIds.length },
    { key: "posts", label: t.statPosts, count: myPosts.length },
    { key: "likes", label: t.statLikes, count: totalLikes },
  ];

  const go = (to: string, params?: Record<string, string>) => {
    onClose();
    void navigate({ to, params } as never);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[90] grid place-items-center bg-background/80 p-3 backdrop-blur"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-surface/95 shadow-glow"
      >
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <h2 className="text-sm font-black uppercase tracking-widest">{t.statsDetails}</h2>
          <button
            onClick={onClose}
            aria-label={t.close}
            className="ml-auto grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground hover:border-brand/60 hover:text-brand"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2">
          {tabs.map((x) => (
            <button
              key={x.key}
              onClick={() => onTabChange(x.key)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${
                tab === x.key
                  ? "border-brand bg-brand/15 font-bold text-brand"
                  : "border-border text-muted-foreground hover:text-brand"
              }`}
            >
              {x.label} · {formatStat(x.count)}
            </button>
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {tab === "tags" &&
            (myTags.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.slangBoxEmpty}</p>
            ) : (
              <ul className="space-y-2">
                {myTags.map((tag) => (
                  <li
                    key={tag.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-background/50 px-3 py-2"
                  >
                    <button
                      onClick={() => go("/slangtag/$name", { name: tag.name })}
                      className="min-w-0 flex-1 text-left text-sm font-bold hover:opacity-80"
                    >
                      <SlangTagName tag={tag} showLock={false} />
                    </button>
                    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                      <Play className="h-3 w-3 text-brand" /> {formatStat(tag.stats.plays)}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                      <Repeat2 className="h-3 w-3 text-brand-cyan" /> {formatStat(tag.stats.uses)}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                      <Heart className="h-3 w-3" /> {formatStat(tag.stats.likes)}
                    </span>
                    {canDeleteTag(tag) && (
                      <button
                        onClick={() => setConfirmTagId(tag.id)}
                        aria-label={t.deleteTag}
                        title={t.deleteTag}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:border-brand/60 hover:text-brand"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ))}

          {tab === "connections" &&
            (connectedIds.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.noConnectionsYet}</p>
            ) : (
              <ul className="space-y-2">
                {connectedIds.map((id) => {
                  const p = profiles[id];
                  if (!p) return null;
                  return (
                    <li
                      key={id}
                      className="flex items-center gap-3 rounded-xl border border-border bg-background/50 px-3 py-2"
                    >
                      <Avatar profile={p} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold">{p.displayName}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          @{p.username}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          onClose();
                          openMessenger(id);
                        }}
                        aria-label={t.openChat}
                        title={t.openChat}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:border-brand/60 hover:text-brand"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => go("/profile/$username", { username: p.username })}
                        aria-label={t.viewProfile}
                        title={t.viewProfile}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:border-brand/60 hover:text-brand"
                      >
                        <UserIcon className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ))}

          {tab === "posts" &&
            (myPosts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.noOwnPostsYet}</p>
            ) : (
              <ul className="space-y-2">
                {myPosts.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-background/50 px-3 py-2"
                  >
                    {p.imageThumb || p.image ? (
                      <img
                        src={p.imageThumb ?? p.image ?? ""}
                        alt=""
                        loading="lazy"
                        className="h-10 w-10 shrink-0 rounded-lg object-cover"
                      />
                    ) : null}
                    <button
                      onClick={() => go("/posts")}
                      className="min-w-0 flex-1 truncate text-left text-sm font-bold hover:opacity-80"
                    >
                      {p.title || p.description}
                    </button>
                    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                      <Heart className="h-3 w-3" /> {formatStat(p.stats.likes)}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                      <MessageCircle className="h-3 w-3" /> {formatStat(p.stats.comments)}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                      <Eye className="h-3 w-3" /> {formatStat(p.stats.views)}
                    </span>
                  </li>
                ))}
              </ul>
            ))}

          {tab === "likes" &&
            (loadingLikes ? (
              <p className="text-sm text-muted-foreground">{t.loading}</p>
            ) : likers.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.noLikesReceived}</p>
            ) : (
              <ul className="space-y-2">
                {likers.map((l) => (
                  <li
                    key={`${l.postId}-${l.profile.id}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-background/50 px-3 py-2"
                  >
                    <Avatar profile={l.profile} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{l.profile.displayName}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        @{l.profile.username} ·{" "}
                        {myPosts.find((p) => p.id === l.postId)?.title ?? ""}
                      </div>
                    </div>
                    <Heart className="h-3.5 w-3.5 shrink-0 fill-current text-brand" />
                  </li>
                ))}
              </ul>
            ))}
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmTagId}
        title={t.deleteTagConfirm}
        busy={busy}
        onCancel={() => setConfirmTagId(null)}
        onConfirm={() => void removeTag()}
      />
    </div>
  );
}

function Avatar({ profile }: { profile: Profile }) {
  return (
    <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border border-brand/50 bg-background text-sm font-black text-brand">
      {profile.avatar ? (
        <img
          src={profile.avatar}
          alt={profile.displayName}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        profile.displayName.slice(0, 1).toUpperCase()
      )}
    </div>
  );
}
