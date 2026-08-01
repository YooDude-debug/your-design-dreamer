import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useRef, useMemo, useEffect } from "react";
import { useAutoPlay, playExclusive, stopOwner, stopAll, isOwnerPlaying } from "@/lib/autoplay";

import { Waveform } from "@/components/Waveform";
import {
  Globe,
  MapPin,
  Flame,
  Users,
  Play,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  TrendingUp,
  BadgeCheck,
  ImageOff,
  PlusSquare,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useData } from "@/lib/data";
import { formatStat, relativeTime, type Post } from "@/lib/types";
import { VisibilityBadge, visibilityLabel } from "@/components/VisibilityBadge";
import { SlangTagCanvas } from "@/components/SlangTagCanvas";
import { SlangTagChip } from "@/components/SlangTagChip";
import { PostDetailOverlay } from "@/components/PostDetailOverlay";
import { PostComposer } from "@/components/CreatePostDialog";
import { SlangTagField, SlangText, extractTagIds } from "@/components/SlangTagInput";
import { ProfilePanel } from "@/components/ProfilePanel";
import { AdFeedCard } from "@/components/AdFeed";
import { TestAccountsPanel } from "@/components/TestAccountsPanel";
import { ReportMenu } from "@/components/ReportDialog";

export const Route = createFileRoute("/_authenticated/dev")({
  head: () => ({
    meta: [
      { title: "Interner Bereich — Y-Dude" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content:
          "Interner Y-Dude Bereich: Beiträge mit SlangTags erstellen, Live-Feed und Community-Statistiken.",
      },
      { property: "og:title", content: "Interner Bereich — Y-Dude" },
      {
        property: "og:description",
        content: "Beiträge mit SlangTags erstellen, Live-Feed und Community.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

type TabKey = "local" | "global" | "trending" | "following";

/** Ein echter Beitrag im Feed – alle Zahlen kommen aus der Datenbank. */
function FeedPost({
  post,
  onOpen,
  scrollRoot,
}: {
  post: Post;
  onOpen: (rect: DOMRect) => void;
  scrollRoot?: HTMLElement | null;
}) {
  const navigate = useNavigate();
  const { t } = useLang();
  const {
    getTag,
    likedPosts,
    savedPosts,
    sharedPosts,
    togglePostLike,
    togglePostSave,
    sharePost,
    commentsByPost,
    loadComments,
    addComment,
    profiles,
    isTagLocked,
    registerPlay,
  } = useData();
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useState("");
  const articleRef = useRef<HTMLElement | null>(null);
  const { autoPlay } = useAutoPlay();

  const liked = likedPosts.includes(post.id);
  const saved = savedPosts.includes(post.id);
  const shared = sharedPosts.includes(post.id);
  const comments = commentsByPost[post.id] ?? [];
  const tags = post.slangTagIds.map((id) => getTag(id)).filter(Boolean);

  /** Erster nutzbarer SlangTag des Beitrags (Kommentare bleiben ausgeschlossen). */
  const autoTag = tags.find((tag) => !!tag?.audio && !isTagLocked(tag!));

  /** AutoPlay: spielt beim Sichtbarwerden, stoppt beim Verlassen. Nur ein Tag gleichzeitig. */
  useEffect(() => {
    const el = articleRef.current;
    if (!autoPlay || !el || !autoTag?.audio) return;
    const owner = `post:${post.id}`;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          if (!isOwnerPlaying(owner)) {
            playExclusive(owner, autoTag.audio!);
            void registerPlay(autoTag.id);
          }
        } else {
          stopOwner(owner);
        }
      },
      { root: scrollRoot ?? null, threshold: [0, 0.6] },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      stopOwner(owner);
    };
  }, [autoPlay, autoTag?.id, autoTag?.audio, post.id, scrollRoot, registerPlay]);

  const openComments = async () => {
    const next = !showComments;
    setShowComments(next);
    if (next) await loadComments(post.id);
  };

  const submit = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await addComment(post.id, text, extractTagIds(text, getTag));
  };

  return (
    <article
      ref={articleRef}
      style={{ contentVisibility: "auto", containIntrinsicSize: "520px" }}
      className="overflow-hidden rounded-xl border border-border bg-background/60"
    >
      <header className="flex items-center justify-between px-3 py-2.5">
        <Link
          to="/profile/$username"
          params={{ username: post.author.username }}
          className="group flex items-center gap-2.5"
        >
          <div className="h-8 w-8 overflow-hidden rounded-full bg-gradient-to-br from-brand to-brand-cyan">
            {post.author.avatar && (
              <img
                src={post.author.avatar}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <div>
            <div className="flex items-center gap-1 text-sm font-semibold leading-tight group-hover:text-brand">
              @{post.author.username}
              {post.author.verified && <BadgeCheck className="h-3.5 w-3.5 text-brand-cyan" />}
            </div>
            <div className="text-xs text-muted-foreground">{post.region || "—"}</div>
          </div>
        </Link>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <VisibilityBadge
            visibility={post.visibility}
            label={visibilityLabel(post.visibility, t as unknown as Record<string, string>)}
          />
          {relativeTime(post.createdAt)}
          <ReportMenu targetType="post" targetId={post.id} targetUserId={post.userId} />
        </span>
      </header>

      {post.image ? (
        <button
          type="button"
          onClick={(e) => onOpen((e.currentTarget as HTMLElement).getBoundingClientRect())}
          className="block w-full px-3 text-left"
        >
          <SlangTagCanvas
            image={post.imageThumb ?? post.image}
            fallbackImage={post.image}
            placements={post.placements}
            onOpenTag={(n) => navigate({ to: "/slangtag/$name", params: { name: n } })}
          />
        </button>
      ) : (
        <div className="mx-3 grid h-24 place-items-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
          <ImageOff className="h-4 w-4" />
        </div>
      )}

      <div className="px-3 pt-2">
        <button
          type="button"
          onClick={(e) => onOpen((e.currentTarget as HTMLElement).getBoundingClientRect())}
          className="text-left text-base font-semibold leading-tight hover:text-brand"
        >
          {post.title}
        </button>
        {post.description && (
          <p className="mt-1 text-sm text-muted-foreground">
            <SlangText
              text={post.description}
              onOpenTag={(tag) => navigate({ to: "/slangtag/$name", params: { name: tag.name } })}
            />
          </p>
        )}
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <SlangTagChip
                key={tag!.id}
                tag={tag!}
                variant="dot"
                onOpen={() => navigate({ to: "/slangtag/$name", params: { name: tag!.name } })}
              />
            ))}
          </div>
        )}
        {post.hashtags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-brand-cyan">
            {post.hashtags.map((h) => (
              <span key={h}>#{h.replace(/^#/, "")}</span>
            ))}
          </div>
        )}
      </div>

      <footer className="mt-2 flex items-center justify-between border-t border-border/60 px-3 py-2.5 text-sm text-muted-foreground">
        <div className="flex items-center gap-4">
          <button
            onClick={() => void togglePostLike(post.id)}
            aria-label={t.like}
            aria-pressed={liked}
            className={`inline-flex items-center gap-1.5 transition-colors ${liked ? "text-brand" : "hover:text-foreground"}`}
          >
            <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />{" "}
            {formatStat(post.stats.likes)}
          </button>
          <button
            onClick={() => void openComments()}
            aria-label={t.statComments}
            aria-expanded={showComments}
            className={`inline-flex items-center gap-1.5 transition-colors ${showComments ? "text-brand-cyan" : "hover:text-foreground"}`}
          >
            <MessageCircle className="h-4 w-4" /> {formatStat(post.stats.comments)}
          </button>
          <button
            onClick={() => void sharePost(post.id)}
            disabled={shared}
            aria-label={t.share}
            className="inline-flex items-center gap-1.5 hover:text-foreground disabled:opacity-60"
          >
            <Share2 className="h-4 w-4" /> {formatStat(post.stats.shares)}
          </button>
        </div>
        <button
          onClick={() => void togglePostSave(post.id)}
          aria-label={t.saveAction}
          className={saved ? "text-brand-cyan" : "hover:text-foreground"}
        >
          <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
        </button>
      </footer>

      {showComments && (
        <div className="space-y-2 border-t border-border/60 bg-background/40 px-3 py-3">
          {comments.length === 0 && (
            <div className="text-xs italic text-muted-foreground">{t.noComments}</div>
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
                <div className="flex-1">
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
            <div className="flex-1 rounded-2xl border border-border bg-surface/60 px-3 py-1.5 focus-within:border-brand">
              <SlangTagField
                value={draft}
                onChange={setDraft}
                onSubmit={() => void submit()}
                placeholder={t.commentPh}
                region={post.region}
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
      )}
    </article>
  );
}

function LiveFeed({ onCreate }: { onCreate: () => void }) {
  const { posts, me, likedPosts, loading } = useData();
  const { t } = useLang();
  const [active, setActive] = useState<TabKey>("global");
  const [detail, setDetail] = useState<number | null>(null);
  const [originRect, setOriginRect] = useState<DOMRect | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null);
  const { autoPlay, toggleAutoPlay } = useAutoPlay();

  useEffect(() => setScrollRoot(scrollRef.current), []);
  useEffect(() => () => stopAll(), []);

  /** Alle Tabs nutzen dieselbe Datenbasis – nur die Filter unterscheiden sich. */
  const visible = useMemo(() => {
    const city = (me?.location ?? "").split(",")[0].trim().toLowerCase();
    switch (active) {
      case "local":
        return city ? posts.filter((p) => p.region.toLowerCase().includes(city)) : [];
      case "trending":
        return [...posts].sort(
          (a, b) =>
            b.stats.likes +
            b.stats.comments +
            b.stats.shares -
            (a.stats.likes + a.stats.comments + a.stats.shares),
        );
      case "following": {
        const authors = new Set(
          posts.filter((p) => likedPosts.includes(p.id)).map((p) => p.userId),
        );
        return posts.filter((p) => authors.has(p.userId));
      }
      default:
        return posts;
    }
  }, [posts, active, me, likedPosts]);

  const tabs: { key: TabKey; label: string; Icon: typeof MapPin }[] = [
    { key: "local", label: t.local, Icon: MapPin },
    { key: "global", label: t.globalTab, Icon: Globe },
    { key: "trending", label: t.trendingTab, Icon: Flame },
    { key: "following", label: t.following, Icon: Users },
  ];

  return (
    <section className="rounded-2xl border border-border bg-surface/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold tracking-widest text-foreground">{t.feed}</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleAutoPlay}
            aria-pressed={autoPlay}
            title={autoPlay ? t.autoPlayOn : t.autoPlayOff}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${
              autoPlay
                ? "border-brand bg-brand/15 text-brand shadow-glow"
                : "border-border text-muted-foreground hover:border-brand/60 hover:text-brand"
            }`}
          >
            {autoPlay ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            {t.autoPlay} {autoPlay ? "ON" : "OFF"}
          </button>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-brand">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
            </span>
            {t.live}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 overflow-x-auto border-b border-border pb-3 text-sm">
        {tabs.map(({ key, label, Icon }) => {
          const on = active === key;
          return (
            <button
              key={key}
              onClick={() => setActive(key)}
              className={`-mb-[13px] inline-flex items-center gap-1.5 whitespace-nowrap pb-2 transition-colors ${
                on
                  ? "border-b-2 border-brand text-brand"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          );
        })}
      </div>

      <div
        ref={scrollRef}
        className="mt-4 max-h-[720px] space-y-4 overflow-y-auto pr-1 scroll-smooth"
      >
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-background/40 px-4 py-10 text-center">
            <div className="text-3xl">🏜️</div>
            <p className="mt-2 text-sm font-semibold">{t.noPostsTitle}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {loading ? t.loadingPosts : t.noPostsHint}
            </p>
            <button
              onClick={onCreate}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-brand px-5 py-2 text-sm font-semibold text-primary-foreground shadow-glow"
            >
              <PlusSquare className="h-4 w-4" /> {t.createFirstPost}
            </button>
          </div>
        ) : (
          visible.map((p, i) => (
            <FeedPost
              key={p.id}
              post={p}
              scrollRoot={scrollRoot}
              onOpen={(rect) => {
                setOriginRect(rect);
                setDetail(i);
              }}
            />
          ))
        )}
      </div>

      {detail !== null && (
        <PostDetailOverlay
          posts={visible}
          index={detail}
          originRect={originRect}
          onIndexChange={setDetail}
          onClose={() => setDetail(null)}
        />
      )}
    </section>
  );
}

/** Top-SlangTags nach echten Wiedergaben. */
function TrendingTags() {
  const { sortedTags, loading } = useData();
  const navigate = useNavigate();
  const { t } = useLang();
  const top = sortedTags("plays").slice(0, 4);

  return (
    <div className="px-6 py-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold">
          <span className="text-gradient-green">{t.topSlangTags}</span>
        </h2>
        <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
          {t.trending} <TrendingUp className="h-4 w-4 text-brand" />
        </p>
      </div>

      {top.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {loading ? t.loadingTags : t.noTagsYet}
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {top.map((tag) => (
            <div key={tag.id} className="min-w-0 rounded-xl border border-border bg-surface p-3">
              <SlangTagChip
                tag={tag}
                variant="compact"
                onOpen={() => navigate({ to: "/slangtag/$name", params: { name: tag.name } })}
              />
              <div className="mt-2 truncate text-xs text-muted-foreground">{tag.region || "—"}</div>
              <div className="mt-1 inline-flex items-center gap-1 text-xs text-brand">
                <Play className="h-3 w-3 fill-brand" /> {formatStat(tag.stats.plays)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Dashboard() {
  const { t } = useLang();
  const { posts, tags } = useData();
  const scrollToComposer = () =>
    document.getElementById("composer")?.scrollIntoView({ behavior: "smooth", block: "start" });

  const totalPlays = tags.reduce((s, x) => s + x.stats.plays, 0);
  const totalLikes = posts.reduce((s, p) => s + p.stats.likes, 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1200px] px-4 py-6 lg:py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr] xl:grid-cols-[300px_1fr_380px]">
          {/* PROFIL + WERBEFEED */}
          <div className="space-y-6">
            <ProfilePanel />
            {/* Werbefeed – direkt unter dem Profilbereich */}
            <AdFeedCard />
          </div>


          {/* MITTE */}
          <div className="min-w-0 space-y-6">
          <div className="overflow-hidden rounded-2xl border border-border bg-surface/40">
            {/* Dauerhaft sichtbarer Beitrags-Editor */}
            <section id="composer" className="px-6 py-8">
              <h1 className="text-xl font-black tracking-tight">
                {t.composerTitleA} <span className="text-gradient-green">{t.composerTitleB}</span>{" "}
                {t.composerTitleC}
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">{t.composerSubtitle}</p>
              <div className="mt-4">
                <PostComposer />
              </div>
            </section>
          </div>

            {/* Feed direkt unter dem Composer */}
            <LiveFeed onCreate={scrollToComposer} />
          </div>

          {/* RECHTS */}
          <aside className="space-y-6">
            <TestAccountsPanel />

            {/* Echte Gesamtwerte */}
            <section className="rounded-2xl border border-border bg-surface/40 p-4">
              <h2 className="mb-3 text-xs font-bold tracking-widest text-foreground">
                {t.community}
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: t.statPosts, v: posts.length },
                  { label: t.statSlangTags, v: tags.length },
                  { label: t.statPlays, v: totalPlays },
                  { label: t.statLikes, v: totalLikes },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-xl border border-border bg-background/60 p-3"
                  >
                    <div className="text-lg font-black text-brand">{formatStat(s.v)}</div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
              <Waveform bars={30} className="mt-3 h-6" />
            </section>
          </aside>
        </div>

        {/* TOP SLANGTAGS – Abschluss der Seite */}
        <div id="discover" className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface/40">
          <TrendingTags />
        </div>

      </div>
    </div>
  );
}
