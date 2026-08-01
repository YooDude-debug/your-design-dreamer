import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageCircle,
  Share2,
  Eye,
  MapPin,
  Clock,
  BadgeCheck,
  Bookmark,
} from "lucide-react";
import { toast } from "sonner";
import { SlangTagCanvas } from "@/components/SlangTagCanvas";
import { SlangTagChip } from "@/components/SlangTagChip";
import { useData } from "@/lib/data";
import { useLang } from "@/lib/i18n";
import { SlangTagField, SlangText, extractTagIds } from "@/components/SlangTagInput";
import { formatCount, formatDate, relativeTime, type Post } from "@/lib/types";
import { VisibilityBadge, visibilityLabel } from "@/components/VisibilityBadge";
import { ReportMenu } from "@/components/ReportDialog";
import { ShareSheet } from "@/components/ShareSheet";
import { isShareable, postShareUrl, shareTitle } from "@/lib/share";

type Props = {
  posts: Post[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  /** Rechteck des angeklickten Bildes für die Zoom-Animation */
  originRect?: DOMRect | null;
};

export function PostDetailOverlay({ posts, index, onIndexChange, onClose, originRect }: Props) {
  const post = posts[index];
  const navigate = useNavigate();
  const { t } = useLang();
  const {
    profiles,
    getTag,
    commentsByPost,
    loadComments,
    addComment,
    likedPosts,
    savedPosts,
    togglePostLike,
    togglePostSave,
    sharePost,
    registerView,
  } = useData();
  const mediaRef = useRef<HTMLDivElement | null>(null);
  const [closing, setClosing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const comments = commentsByPost[post?.id ?? ""] ?? [];
  const liked = likedPosts.includes(post?.id ?? "");
  const saved = savedPosts.includes(post?.id ?? "");

  /** Kommentare laden und Aufruf zählen (serverseitig einmal pro Nutzer & Beitrag) */
  useEffect(() => {
    if (!post) return;
    void loadComments(post.id);
    void registerView(post.id);
  }, [post?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /** FLIP-Zoom: startet im Feed-Rechteck und fährt flüssig in die Detailansicht */
  useLayoutEffect(() => {
    const el = mediaRef.current;
    if (!el || !originRect) return;
    const target = el.getBoundingClientRect();
    if (!target.width || !target.height) return;
    const sx = originRect.width / target.width;
    const sy = originRect.height / target.height;
    el.style.transformOrigin = "top left";
    el.style.transition = "none";
    el.style.transform = `translate(${originRect.left - target.left}px, ${originRect.top - target.top}px) scale(${sx}, ${sy})`;
    el.style.opacity = "0.6";
    requestAnimationFrame(() => {
      el.style.transition = "transform 320ms cubic-bezier(0.22,1,0.36,1), opacity 220ms ease-out";
      el.style.transform = "translate(0,0) scale(1)";
      el.style.opacity = "1";
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    const el = mediaRef.current;
    setClosing(true);
    if (el && originRect) {
      const target = el.getBoundingClientRect();
      const sx = originRect.width / target.width;
      const sy = originRect.height / target.height;
      el.style.transition = "transform 260ms cubic-bezier(0.4,0,0.2,1), opacity 220ms ease-in";
      el.style.transform = `translate(${originRect.left - target.left}px, ${originRect.top - target.top}px) scale(${sx}, ${sy})`;
      el.style.opacity = "0";
      setTimeout(onClose, 240);
      return;
    }
    setTimeout(onClose, 120);
  };

  const go = (dir: -1 | 1) => {
    const next = (index + dir + posts.length) % posts.length;
    onIndexChange(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  });

  const placedTags = useMemo(
    () => (post?.placements ?? []).map((p) => getTag(p.tagId)).filter(Boolean),
    [post, getTag],
  );

  if (!post) return null;

  const submit = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await addComment(post.id, text, extractTagIds(text, getTag));
  };

  const openShare = () => {
    if (!isShareable(post.visibility)) {
      toast.error("Private Beiträge können nicht geteilt werden.");
      return;
    }
    setShareOpen(true);
  };

  const stats = [
    { icon: Heart, label: t.statLikes, v: post.stats.likes },
    { icon: MessageCircle, label: t.statComments, v: post.stats.comments },
    { icon: Share2, label: t.statShares, v: post.stats.shares },
    { icon: Eye, label: t.statViews, v: post.stats.views },
  ];

  return (
    <div
      className={`fixed inset-0 z-[120] overflow-y-auto bg-black/90 backdrop-blur-md transition-opacity duration-200 ${
        closing ? "opacity-0" : "animate-fade-in opacity-100"
      }`}
      role="dialog"
      aria-modal="true"
      onClick={close}
    >
      <div className="mx-auto flex min-h-full max-w-5xl items-start justify-center p-4">
        <div
          onClick={(e) => e.stopPropagation()}
          className="my-6 w-full rounded-2xl border border-border bg-surface/95 shadow-glow"
        >
          {/* Ersteller */}
          <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <Link
              to="/profile/$username"
              params={{ username: post.author.username }}
              className="group flex items-center gap-3"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-brand/50 bg-gradient-to-br from-brand to-brand-cyan">
                {post.author.avatar ? (
                  <img
                    src={post.author.avatar}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-black text-black">
                    {post.author.username.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-semibold group-hover:text-brand">
                  @{post.author.username}
                  {post.author.verified && <BadgeCheck className="h-4 w-4 text-brand-cyan" />}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {post.region || "—"}
                  <VisibilityBadge
                    visibility={post.visibility}
                    label={visibilityLabel(post.visibility, t as unknown as Record<string, string>)}
                  />
                </span>
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <ReportMenu targetType="post" targetId={post.id} targetUserId={post.userId} />
              <button
                onClick={() => go(-1)}
                aria-label={t.prevPost}
                className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground hover:border-brand/60 hover:text-brand"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => go(1)}
                aria-label={t.nextPost}
                className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground hover:border-brand/60 hover:text-brand"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={close}
                aria-label={t.close}
                className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground hover:border-brand/60 hover:text-brand"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* Bild groß, SlangTags in Originalposition & interaktiv */}
          <div className="p-4">
            <div ref={mediaRef} className="will-change-transform">
              {post.image ? (
                <SlangTagCanvas
                  image={post.imageMedium ?? post.image}
                  fallbackImage={post.image}
                  placements={post.placements}
                  onOpenTag={(n) => navigate({ to: "/slangtag/$name", params: { name: n } })}
                  className="bg-black"
                />
              ) : (
                <div className="grid h-52 place-items-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                  {t.noImage}
                </div>
              )}
            </div>

            {placedTags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {placedTags.map((tag) => (
                  <SlangTagChip
                    key={tag!.id}
                    tag={tag!}
                    variant="compact"
                    onOpen={() => navigate({ to: "/slangtag/$name", params: { name: tag!.name } })}
                  />
                ))}
              </div>
            )}

            <h2 className="mt-4 text-lg font-black tracking-tight">{post.title}</h2>
            {post.description && (
              <p className="mt-1 text-sm leading-relaxed text-foreground/90">
                <SlangText
                  text={post.description}
                  onOpenTag={(tag) =>
                    navigate({ to: "/slangtag/$name", params: { name: tag.name } })
                  }
                />
              </p>
            )}
            {post.hashtags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-brand-cyan">
                {post.hashtags.map((h) => (
                  <span key={h}>#{h.replace(/^#/, "")}</span>
                ))}
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {formatDate(post.createdAt)}
              </span>
              {post.region && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {post.region}
                </span>
              )}
            </div>

            {/* Statistiken */}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {stats.map(({ icon: Icon, label, v }) => (
                <div
                  key={label}
                  className="rounded-xl border border-border bg-background/60 px-3 py-2"
                >
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                    <Icon className="h-3 w-3" /> {label}
                  </div>
                  <div className="text-sm font-black text-foreground">{formatCount(v)}</div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center gap-4 border-t border-border pt-3 text-sm text-muted-foreground">
              <button
                onClick={() => void togglePostLike(post.id)}
                className={`inline-flex items-center gap-1.5 ${liked ? "text-brand" : "hover:text-foreground"}`}
              >
                <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} /> {t.like}
              </button>
              <button
                onClick={() => void share()}
                className="inline-flex items-center gap-1.5 hover:text-foreground"
              >
                <Share2 className="h-4 w-4" /> {t.share}
              </button>
              <button
                onClick={() => void togglePostSave(post.id)}
                aria-label={t.saveAction}
                className={`ml-auto ${saved ? "text-brand-cyan" : "hover:text-foreground"}`}
              >
                <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
              </button>
            </div>

            {/* Kommentare */}
            <div className="mt-3 space-y-2">
              {comments.length === 0 && (
                <p className="text-xs italic text-muted-foreground">{t.noComments}</p>
              )}
              {comments.map((c) => {
                const author = profiles[c.userId];
                return (
                  <div key={c.id} className="flex items-start gap-2 text-sm">
                    <div className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-brand-cyan to-brand">
                      {author?.avatar && (
                        <img
                          src={author.avatar}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">@{author?.username ?? t.unknown}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {relativeTime(c.createdAt)}
                        </span>
                      </div>
                      <div className="text-foreground/90">
                        <SlangText
                          text={c.body}
                          onOpenTag={(tag) =>
                            navigate({ to: "/slangtag/$name", params: { name: tag.name } })
                          }
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center gap-2 pt-1">
                <div className="flex-1 rounded-2xl border border-border bg-background px-3 py-1.5 focus-within:border-brand">
                  <SlangTagField
                    value={draft}
                    onChange={setDraft}
                    onSubmit={() => void submit()}
                    region={post.region}
                    placeholder={t.commentPh}
                    aria-label={t.commentPh}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={!draft.trim()}
                  className="text-xs font-bold uppercase tracking-wider text-brand disabled:opacity-40"
                >
                  {t.send}
                </button>
              </div>
            </div>
          </div>

          <footer className="flex items-center justify-between border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
            <span>
              {t.postCounter} {index + 1} / {posts.length}
            </span>
            <span>{t.arrowHint}</span>
          </footer>
        </div>
      </div>
    </div>
  );
}
