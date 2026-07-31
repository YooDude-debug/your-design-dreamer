import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Heart, MessageCircle, Eye, Pencil, Trash2, Maximize2, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/lib/data";
import { useLang } from "@/lib/i18n";
import { formatDate, formatStat } from "@/lib/types";
import { SlangTagCanvas } from "@/components/SlangTagCanvas";
import { VisibilityBadge, visibilityLabel } from "@/components/VisibilityBadge";
import { PostDetailOverlay } from "@/components/PostDetailOverlay";
import { PostEditDialog } from "@/components/PostEditDialog";

export const Route = createFileRoute("/_authenticated/posts")({
  head: () => ({
    meta: [
      { title: "Meine Beiträge — Y-Dude" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Eigene Y-Dude Beiträge verwalten: öffnen, bearbeiten und löschen." },
      { property: "og:title", content: "Meine Beiträge — Y-Dude" },
      { property: "og:description", content: "Eigene Beiträge mit SlangTags verwalten." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyPostsPage,
});

function MyPostsPage() {
  const { t } = useLang();
  const navigate = useNavigate();
  const { me, posts, loading, deletePost } = useData();
  const [detail, setDetail] = useState<number | null>(null);
  const [originRect, setOriginRect] = useState<DOMRect | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const myPosts = useMemo(
    () => posts.filter((p) => p.userId === me?.id).sort((a, b) => b.createdAt - a.createdAt),
    [posts, me],
  );

  const editing = myPosts.find((p) => p.id === editId) ?? null;

  const remove = async () => {
    if (!confirmId) return;
    setBusy(true);
    const ok = await deletePost(confirmId);
    setBusy(false);
    setConfirmId(null);
    toast[ok ? "success" : "error"](ok ? t.postDeleted : t.deleteFailed);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link to="/dev" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-brand">
        <ArrowLeft className="h-3.5 w-3.5" /> {t.backToDashboard}
      </Link>

      <header className="mt-4">
        <h1 className="text-2xl font-black tracking-tight">{t.myPosts}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.myPostsHint}</p>
      </header>

      {myPosts.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {loading ? t.loadingPosts : t.noOwnPostsYet}
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {myPosts.map((p, i) => (
            <article key={p.id} className="flex flex-col rounded-2xl border border-border bg-surface/40 p-3">
              {p.image ? (
                <SlangTagCanvas
                  image={p.image}
                  placements={p.placements}
                  onOpenTag={(n) => navigate({ to: "/slangtag/$name", params: { name: n } })}
                />
              ) : (
                <div className="grid h-32 place-items-center rounded-xl border border-dashed border-border text-muted-foreground">
                  <ImageOff className="h-4 w-4" />
                </div>
              )}

              <div className="mt-2 flex items-start justify-between gap-2">
                <h2 className="min-w-0 flex-1 truncate text-sm font-bold">{p.title}</h2>
                <VisibilityBadge
                  visibility={p.visibility}
                  label={visibilityLabel(p.visibility, t as unknown as Record<string, string>)}
                />
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Heart className="h-3 w-3" /> {formatStat(p.stats.likes)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MessageCircle className="h-3 w-3" /> {formatStat(p.stats.comments)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-3 w-3" /> {formatStat(p.stats.views)}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">{formatDate(p.createdAt)}</div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    setOriginRect((e.currentTarget as HTMLElement).getBoundingClientRect());
                    setDetail(i);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] hover:border-brand/60 hover:text-brand"
                >
                  <Maximize2 className="h-3 w-3" /> {t.openPost}
                </button>
                <button
                  type="button"
                  onClick={() => setEditId(p.id)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] hover:border-brand/60 hover:text-brand"
                >
                  <Pencil className="h-3 w-3" /> {t.editPost}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmId(p.id)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-destructive/50 px-3 py-1.5 text-[11px] text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3 w-3" /> {t.delete}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {detail !== null && myPosts[detail] && (
        <PostDetailOverlay
          posts={myPosts}
          index={detail}
          originRect={originRect}
          onIndexChange={setDetail}
          onClose={() => setDetail(null)}
        />
      )}

      <PostEditDialog post={editing} onClose={() => setEditId(null)} />

      {confirmId && (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-glow">
            <p className="text-sm font-semibold">{t.deletePostConfirm}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmId(null)}
                className="rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => void remove()}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full border border-destructive/60 bg-destructive/15 px-4 py-1.5 text-xs font-semibold text-destructive disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" /> {t.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
