import { BackButton } from "@/components/ui/nav-buttons";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { goBackOr } from "@/lib/back-nav";
import { memo, useCallback, useMemo, useState } from "react";
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Eye,
  Pencil,
  Trash2,
  Maximize2,
  ImageOff,
} from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/lib/data-context";
import { useLang } from "@/lib/lang-context";
import { formatDate, formatStat, type Post } from "@/lib/types";
import { SlangTagCanvas } from "@/components/SlangTagCanvas";
import { VisibilityBadge } from "@/components/VisibilityBadge";
import { visibilityLabel } from "@/lib/visibility";
import { PostDetailOverlay } from "@/components/PostDetailOverlay";
import { PostEditDialog } from "@/components/PostEditDialog";
import { postCardImage } from "@/lib/media";
import { PostModerationNotice, isPostUnderReview } from "@/components/PostModerationNotice";

export const Route = createFileRoute("/_authenticated/posts")({
  head: () => ({
    meta: [
      { title: "Meine Beiträge — Y-Dude" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content: "Eigene Y-Dude Beiträge verwalten: öffnen, bearbeiten und löschen.",
      },
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
  const router = useRouter();
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

  /** Stabile Callbacks/Labels halten die memoisierten Karten unveraendert. */
  const openTag = useCallback(
    (name: string) => navigate({ to: "/slangtag/$name", params: { name } }),
    [navigate],
  );
  const cardLabels = useMemo(
    () => ({ open: t.openPost, edit: t.editPost, delete: t.delete }),
    [t.openPost, t.editPost, t.delete],
  );

  const remove = async () => {
    if (!confirmId) return;
    setBusy(true);
    const ok = await deletePost(confirmId);
    setBusy(false);
    setConfirmId(null);
    toast[ok ? "success" : "error"](ok ? t.postDeleted : t.deleteFailed);
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-4 sm:py-8 2xl:max-w-6xl">
      <BackButton onClick={() => goBackOr(router, "/dev")} label={t.backToDashboard} />

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
            <MyPostCard
              key={p.id}
              post={p}
              labels={cardLabels}
              ownUserId={me?.id ?? null}
              onOpenTag={openTag}
              onOpen={(rect: DOMRect) => {
                setOriginRect(rect);
                setDetail(i);
              }}
              onEdit={setEditId}
              onDelete={setConfirmId}
            />
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

/**
 * Karte der Beitragsuebersicht – memoisiert.
 * Zeigt das Vorschaubild (Thumbnail); das Original laedt erst die Detailansicht.
 */
const MyPostCard = memo(function MyPostCard({
  post,
  labels,
  onOpen,
  onEdit,
  onDelete,
  onOpenTag,
  ownUserId,
}: {
  post: Post;
  labels: { open: string; edit: string; delete: string };
  /** Eigene Kennung – für die dezente Statusanzeige der KI-Prüfung. */
  ownUserId?: string | null;
  onOpen: (rect: DOMRect) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenTag: (name: string) => void;
}) {
  const { t } = useLang();
  return (
    <article
      className={`flex flex-col rounded-2xl border border-border bg-background p-3 transition-opacity duration-300 ${
        isPostUnderReview(post, ownUserId) ? "opacity-70" : "opacity-100"
      }`}
    >
      {post.image ? (
        <SlangTagCanvas
          image={postCardImage(post) ?? ""}
          fallbackImage={post.image}
          placements={post.placements}
          onOpenTag={onOpenTag}
        />
      ) : (
        <div className="grid h-32 place-items-center rounded-xl border border-dashed border-border text-muted-foreground">
          <ImageOff className="h-4 w-4" />
        </div>
      )}

      <div className="mt-2 flex items-start justify-between gap-2">
        <h2 className="min-w-0 flex-1 truncate text-sm font-bold">{post.title}</h2>
        <VisibilityBadge
          visibility={post.visibility}
          label={visibilityLabel(post.visibility, t as unknown as Record<string, string>)}
        />
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Heart className="h-3 w-3" /> {formatStat(post.stats.likes)}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageCircle className="h-3 w-3" /> {formatStat(post.stats.comments)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Eye className="h-3 w-3" /> {formatStat(post.stats.views)}
        </span>
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">{formatDate(post.createdAt)}</div>

      {/* Prüfstand: dezent, ohne Popup. Bearbeiten ist hier direkt möglich. */}
      <div className="-mx-3">
        <PostModerationNotice post={post} ownUserId={ownUserId} showEditAction={false} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={(e) => onOpen((e.currentTarget as HTMLElement).getBoundingClientRect())}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] hover:border-brand/60 hover:text-brand"
        >
          <Maximize2 className="h-3 w-3" /> {labels.open}
        </button>
        <button
          type="button"
          onClick={() => onEdit(post.id)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] hover:border-brand/60 hover:text-brand"
        >
          <Pencil className="h-3 w-3" /> {labels.edit}
        </button>
        <button
          type="button"
          onClick={() => onDelete(post.id)}
          className="inline-flex items-center gap-1.5 rounded-full border border-destructive/50 px-3 py-1.5 text-[11px] text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-3 w-3" /> {labels.delete}
        </button>
      </div>
    </article>
  );
});
