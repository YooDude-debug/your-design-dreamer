import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useRef, useMemo, useEffect, useLayoutEffect, type ReactNode } from "react";
import { useAutoPlay, playExclusive, stopOwner, stopAll, isOwnerPlaying } from "@/lib/autoplay";
import { useLiveFeed, LIVE_FEED_INTERVAL_MS } from "@/lib/live-feed";

import { useFeedRanking, useFeedSignals } from "@/lib/use-feed-ranking";
import { useFeedMode } from "@/lib/use-feed-mode";
import { useHorizontalNavSwipe, useSlideInClass } from "@/lib/use-swipe-nav-gesture";

import {
  Globe,
  MapPin,
  Flame,
  Users,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  BadgeCheck,
  ImageOff,
  PlusSquare,
  Volume2,
  VolumeX,
  Radio,
  RadioTower,
  ArrowUp,
} from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { useData } from "@/lib/data-context";
import { formatStat, relativeTime, type Post, type SlangTag } from "@/lib/types";
import { VisibilityBadge } from "@/components/VisibilityBadge";
import { visibilityLabel } from "@/lib/visibility";
import { SlangTagCanvas } from "@/components/SlangTagCanvas";
import { TagRow } from "@/components/TagRow";
import { PostDetailOverlay } from "@/components/PostDetailOverlay";
import { PostComposer } from "@/components/CreatePostDialog";
import { SlangTagField, SlangText } from "@/components/SlangTagInput";
import { collectTagIds } from "@/lib/slangtag-ui";
import { ProfilePanel } from "@/components/ProfilePanel";
import { AdSlider } from "@/components/AdSlider";
import { FeedAdCard } from "@/components/feed/FeedAdCard";
import { useAdTestCounter } from "@/lib/ad-test-counter";
import { SPONSORED_ADS } from "@/lib/ad-demo";
import { useAdsEnabled } from "@/lib/ad-pause";
import type { AdTestKind } from "@/lib/live-test.shared";

import { ReportMenu } from "@/components/ReportDialog";
import { ShareSheet } from "@/components/ShareSheet";
import { isShareable, postShareUrl, shareTitle } from "@/lib/share";
import { toast } from "sonner";
import { TestBotBadge } from "@/components/TestBotBadge";
import { postFullImage, postPreviewImage } from "@/lib/media";

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
  const [shareOpen, setShareOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const articleRef = useRef<HTMLElement | null>(null);
  /** Im Kommentarfeld eingefügte SlangTags (auch neu aufgenommene). */
  const insertedTags = useRef<SlangTag[]>([]);

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
    const tagIds = collectTagIds(text, getTag, insertedTags.current);
    setDraft("");
    insertedTags.current = [];
    await addComment(post.id, text, tagIds);
  };

  return (
    <article
      ref={articleRef}
      style={{ contentVisibility: "auto", containIntrinsicSize: "520px" }}
      className="overflow-hidden rounded-xl border border-border bg-background/60"
    >
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5">
        <Link
          to="/profile/$username"
          params={{ username: post.author.username }}
          className="group flex min-w-0 items-center gap-2.5"
        >
          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-brand to-brand-cyan">
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
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1 text-sm font-semibold leading-tight group-hover:text-brand">
              <span className="truncate">@{post.author.username}</span>
              {post.author.verified && (
                <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-brand-cyan" />
              )}
              {post.author.isTestBot && <TestBotBadge />}
            </div>
            <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <span className="truncate">{post.region || "—"}</span>
              <span aria-hidden className="shrink-0 opacity-50">
                ·
              </span>
              <span className="shrink-0 whitespace-nowrap">{relativeTime(post.createdAt)}</span>
            </div>
          </div>
        </Link>
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground sm:gap-1.5 sm:text-xs">
          <VisibilityBadge
            visibility={post.visibility}
            label={visibilityLabel(post.visibility, t as unknown as Record<string, string>)}
          />
          <ReportMenu targetType="post" targetId={post.id} targetUserId={post.userId} />
        </span>

      </header>

      {post.image ? (
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => onOpen((e.currentTarget as HTMLElement).getBoundingClientRect())}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpen((e.currentTarget as HTMLElement).getBoundingClientRect());
            }
          }}
          className="block w-full cursor-pointer px-3 text-left"
        >
          <SlangTagCanvas
            image={postPreviewImage(post) ?? ""}
            fallbackImage={post.image}
            placements={post.placements}
            onOpenTag={(n) => navigate({ to: "/slangtag/$name", params: { name: n } })}
          />
        </div>
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
        <TagRow
          hashtags={post.hashtags}
          tags={tags.filter((t): t is NonNullable<typeof t> => Boolean(t))}
          onOpenTag={(tag) => navigate({ to: "/slangtag/$name", params: { name: tag.name } })}
          onOpenHashtag={(h) => navigate({ to: "/hashtag/$name", params: { name: h } })}
          className="mt-2"
        />
      </div>

      <footer className="mt-2 flex items-center justify-between gap-2 border-t border-border/60 px-2 py-1.5 text-sm text-muted-foreground sm:px-3 sm:py-2.5">
        <div className="flex min-w-0 items-center gap-1 sm:gap-3">
          <button
            onClick={() => void togglePostLike(post.id)}
            aria-label={t.like}
            aria-pressed={liked}
            className={`tap-safe inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors ${liked ? "text-brand" : "hover:text-foreground"}`}
          >
            <Heart className={`h-4 w-4 shrink-0 ${liked ? "fill-current" : ""}`} />
            {formatStat(post.stats.likes)}
          </button>
          <button
            onClick={() => void openComments()}
            aria-label={t.statComments}
            aria-expanded={showComments}
            className={`tap-safe inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors ${showComments ? "text-brand-cyan" : "hover:text-foreground"}`}
          >
            <MessageCircle className="h-4 w-4 shrink-0" /> {formatStat(post.stats.comments)}
          </button>
          <button
            onClick={() => {
              if (!isShareable(post.visibility)) {
                toast.error("Private Beiträge können nicht geteilt werden.");
                return;
              }
              setShareOpen(true);
            }}
            aria-label={t.share}
            className={`tap-safe inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors ${shared ? "text-brand-cyan" : "hover:text-foreground"}`}
          >
            <Share2 className="h-4 w-4 shrink-0" /> {formatStat(post.stats.shares)}
          </button>
        </div>
        <button
          onClick={() => void togglePostSave(post.id)}
          aria-label={t.saveAction}
          className={`tap-safe inline-flex shrink-0 items-center justify-center rounded-lg px-2 py-1.5 ${saved ? "text-brand-cyan" : "hover:text-foreground"}`}
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
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2">
                    <span className="truncate font-semibold">@{author?.username ?? t.unknown}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
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
            <div
              className="min-w-0 flex-1 cursor-text rounded-2xl border border-border bg-surface/60 px-3 py-1.5 focus-within:border-brand"
              onMouseDown={(e) => {
                // Klick auf Rand/Innenabstand fokussiert das Eingabefeld.
                if (e.target !== e.currentTarget) return;
                e.preventDefault();
                const el = e.currentTarget.querySelector("input");
                el?.focus();
                el?.setSelectionRange(el.value.length, el.value.length);
              }}
            >
              <SlangTagField
                value={draft}
                onChange={setDraft}
                onTagInserted={(tag) => {
                  insertedTags.current = [
                    ...insertedTags.current.filter((x) => x.id !== tag.id),
                    tag,
                  ];
                }}
                onSubmit={() => void submit()}
                placeholder={t.commentPh}
                region={post.region}
                keepFocus
                aria-label={t.commentPh}
              />
            </div>

            <button
              type="button"
              onClick={() => void submit()}
              disabled={!draft.trim()}
              className="tap-safe shrink-0 rounded-lg px-2 text-xs font-bold uppercase tracking-wider text-brand disabled:opacity-40"
            >
              {t.send}
            </button>
          </div>
        </div>
      )}

      {shareOpen && (
        <ShareSheet
          payload={{
            url: postShareUrl(post.id),
            title: shareTitle(post.title, post.description),
            author: post.author.displayName || post.author.username,
            image: postFullImage(post),
          }}
          onShared={() => void sharePost(post.id)}
          onClose={() => setShareOpen(false)}
        />
      )}
    </article>
  );
}

/**
 * Meldet einmalig, wenn der eingeschlossene Beitrag wirklich gesehen wurde:
 * mindestens 50 % Fläche für mindestens 800 ms im Feed sichtbar. Reine
 * Datenabfragen (Live-Refresh) lösen das niemals aus.
 */
function SeenWatcher({
  root,
  enabled,
  onSeen,
  children,
}: {
  root: HTMLElement | null;
  enabled: boolean;
  onSeen: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const done = useRef(false);
  // Callback in einer Ref: der Beobachter wird nicht bei jedem Render neu gestartet.
  const cb = useRef(onSeen);
  cb.current = onSeen;

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el || done.current) return;
    let timer: number | undefined;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            if (timer === undefined) {
              timer = window.setTimeout(() => {
                done.current = true;
                io.disconnect();
                cb.current();
              }, 800);
            }
          } else if (timer !== undefined) {
            window.clearTimeout(timer);
            timer = undefined;
          }
        }
      },
      { root: root ?? null, threshold: [0, 0.5, 1] },
    );
    io.observe(el);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      io.disconnect();
    };
  }, [enabled, root]);

  return <div ref={ref}>{children}</div>;
}

function LiveFeed({

  onCreate,
  locked = false,
  scrollMaxHeight,
}: {
  onCreate: () => void;
  locked?: boolean;
  scrollMaxHeight?: string;
}) {
  const {
    posts,
    me,
    following,
    loading,
    isAdmin,
    newPostsCount,
    checkNewPosts,
    applyNewPosts,
    freshPostIds,
  } = useData();


  const { t, lang } = useLang();
  const [active, setActive] = useState<TabKey>("global");
  const [detail, setDetail] = useState<number | null>(null);
  const [originRect, setOriginRect] = useState<DOMRect | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null);
  const { autoPlay, toggleAutoPlay } = useAutoPlay();
  const { liveFeed, toggleLiveFeed } = useLiveFeed();

  useEffect(() => setScrollRoot(scrollRef.current), []);
  useEffect(() => () => stopAll(), []);

  /**
   * Laufende Berührung/Geste im Feed – währenddessen wird nichts geprüft.
   * Ein einziger Effekt für alle Zeiger-Ereignisse; Listener werden vollständig
   * wieder entfernt.
   */
  const gestureRef = useRef(false);
  useEffect(() => {
    const down = () => {
      gestureRef.current = true;
    };
    const up = () => {
      gestureRef.current = false;
    };
    window.addEventListener("pointerdown", down, { passive: true });
    window.addEventListener("pointerup", up, { passive: true });
    window.addEventListener("pointercancel", up, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  /**
   * Der scrollende Container wird einmal ermittelt und gemerkt. Erst wenn er
   * aus dem Dokument fällt (Layoutwechsel Feed-Modus/Desktop), wird neu
   * gesucht – das vermeidet wiederholte Layout-Reflows bei jedem Scrollen.
   */
  const scrollerRef = useRef<HTMLElement | null>(null);
  const feedScroller = useCallback((): HTMLElement | null => {
    const cached = scrollerRef.current;
    if (cached && cached.isConnected) return cached;
    const found = resolveFeedScroller(scrollRef.current);
    scrollerRef.current = found;
    return found;
  }, []);

  /**
   * Zum Feed-Anfang springen. Der eigentliche Feed-Scroller wird sofort auf 0
   * gesetzt, zusätzlich die Seite selbst. Kein Reload, keine neue Abfrage.
   */
  const scrollToTop = useCallback(() => {
    scrollFeedToTop(scrollRef.current ?? feedScroller());
  }, [feedScroller]);

  const atFeedTop = useCallback(() => isFeedAtTop(feedScroller()), [feedScroller]);


  /**
   * Live-Feed: alle 10 Sekunden nur auf neue Beiträge prüfen. Es wird nichts
   * ersetzt und nichts verschoben – neue Beiträge werden vorgeladen und nur
   * dann sofort eingefügt, wenn der Feed ganz oben steht und keine
   * Detailansicht offen ist. Kein Polling bei inaktivem Tab.
   */
  /** Offene Detailansicht ohne Effekt-Neustart prüfbar halten. */
  const detailRef = useRef<number | null>(null);
  useEffect(() => {
    detailRef.current = detail;
  }, [detail]);

  useEffect(() => {
    if (!liveFeed) return;
    let busy = false;
    let stopped = false;
    const run = async () => {
      if (busy || stopped || document.hidden) return;
      // Offene Detailansicht oder laufende Geste: nicht anfassen.
      if (detailRef.current !== null || gestureRef.current) return;

      busy = true;
      try {
        const count = await checkNewPosts();
        // Nur wenn der Feed wirklich ganz oben steht, direkt einfügen –
        // sonst bleibt es bei der dezenten Anzeige „X neue Beiträge“.
        if (!stopped && count > 0 && atFeedTop()) applyNewPosts();
      } finally {
        busy = false;
      }
    };
    const id = window.setInterval(() => void run(), LIVE_FEED_INTERVAL_MS);
    const onVisible = () => {
      if (!document.hidden) void run();
    };
    document.addEventListener("visibilitychange", onVisible);
    void run();
    return () => {
      stopped = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // Absichtlich nur `liveFeed`: `checkNewPosts`/`applyNewPosts` sind stabil,
    // damit das 10-Sekunden-Intervall nicht bei jedem Render neu startet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveFeed]);




  /** Alle Tabs nutzen dieselbe Datenbasis – nur die Filter unterscheiden sich.
   *  Eigene Beiträge erscheinen nie in den öffentlichen Feeds (Lokal, Global,
   *  Trending, Folge ich); sie bleiben im Profil, in der Beitragsübersicht,
   *  per Direktlink und in Moderationsansichten sichtbar. */
  const visible = useMemo(() => {
    const city = (me?.location ?? "").split(",")[0].trim().toLowerCase();
    const base = me?.id ? posts.filter((p) => p.userId !== me.id) : posts;
    switch (active) {
      case "local":
        return city ? base.filter((p) => p.region.toLowerCase().includes(city)) : [];
      case "trending":
        return [...base].sort(
          (a, b) =>
            b.stats.likes +
            b.stats.comments +
            b.stats.shares -
            (a.stats.likes + a.stats.comments + a.stats.shares),
        );
      case "following": {
        // Ausschließlich Beiträge tatsächlich gefolgter Nutzer (Follow-Relation
        // aus dem Bootstrap – keine zusätzliche Abfrage, keine Like-Heuristik).
        const followed = new Set(following);
        return base.filter((p) => followed.has(p.userId));
      }
      default:
        return base;
    }
  }, [posts, active, me, following]);


  /**
   * Feed-Algorithmus 2.0: personalisierte Reihenfolge (Interessen, Region,
   * SlangTag-Qualität, Aktualität, Vielfalt). "Trending" bleibt bewusst
   * rein nach Interaktionen sortiert.
   */
  const ranked = useFeedRanking(visible, { enabled: active !== "trending" });
  const { track } = useFeedSignals();

  /**
   * Neue Beiträge stehen immer als eigener oberster Block im Feed – sortiert
   * nach ihrem Erstellungszeitpunkt (neuester zuerst). Der Algorithmus
   * bestimmt weiterhin die Reihenfolge aller übrigen Beiträge; er darf neue
   * Beiträge aber nicht zwischen bereits geladene einsortieren.
   */
  const feed = useMemo(() => {
    if (freshPostIds.length === 0) return ranked;
    const fresh = new Set(freshPostIds);
    const top = ranked.filter((p) => fresh.has(p.id)).sort((a, b) => b.createdAt - a.createdAt);
    if (top.length === 0) return ranked;
    return [...top, ...ranked.filter((p) => !fresh.has(p.id))];
  }, [ranked, freshPostIds]);

  /**
   * Wächst der Feed oben (neue Beiträge), bleibt der sichtbare Bereich stehen:
   * die Scrollposition wird um die dazugekommene Höhe korrigiert.
   */
  const heightRef = useRef(0);
  useLayoutEffect(() => {
    const el = feedScroller();
    const prev = heightRef.current;
    const next = el ? el.scrollHeight : document.documentElement.scrollHeight;
    heightRef.current = next;
    const offset = el ? el.scrollTop : window.scrollY;
    if (prev && next > prev && offset > 8) {
      const delta = next - prev;
      if (el) el.scrollTop = offset + delta;
      else window.scrollTo({ top: offset + delta });
    }
  }, [feed]);

  /**
   * Live-Testmodus des Werbekernels: zählt echte Feed-Interaktionen und
   * mischt nach 15/25 Interaktionen eine gekennzeichnete Werbekarte ein.
   * Nur für Admin-Sitzungen und nur bei aktivem Testmodus.
   */
  const adTest = useAdTestCounter(Boolean(isAdmin));

  /**
   * Regulaere Werbeplatzierung: nach jedem 15. normalen Beitrag erscheint eine
   * gekennzeichnete Werbekarte. Gezaehlt werden ausschliesslich echte Beitraege
   * (Werbekarten selbst und UI-Elemente zaehlen nicht), daher ist der Slot an
   * die Position im Beitragsarray gebunden und bleibt beim Nachladen stabil.
   */
  const AD_EVERY = 15;
  const adsState = useAdsEnabled(me?.id, Boolean(isAdmin));
  /** Weggeklickte Werbekarten werden am Beitrag verankert, nicht an der Position. */
  const [dismissedAds, setDismissedAds] = useState<string[]>([]);
  const adSlotFor = (
    index: number,
    postId: string,
  ): { slot: number; ad: (typeof SPONSORED_ADS)[number] } | null => {
    if (!adsState.enabled || SPONSORED_ADS.length === 0) return null;
    const n = index + 1;
    if (n % AD_EVERY !== 0) return null;
    const slot = n / AD_EVERY;
    if (dismissedAds.includes(postId)) return null;
    return { slot, ad: SPONSORED_ADS[(slot - 1) % SPONSORED_ADS.length]! };
  };




  const tabs: { key: TabKey; label: string; Icon: typeof MapPin }[] = [
    { key: "local", label: t.local, Icon: MapPin },
    { key: "global", label: t.globalTab, Icon: Globe },
    { key: "trending", label: t.trendingTab, Icon: Flame },
    { key: "following", label: t.following, Icon: Users },
  ];

  return (
    <section className="rounded-none border-x-0 border-y border-border bg-surface/40 p-2 sm:rounded-2xl sm:border-x sm:p-3">
      {/* Einziges Pull-Down-Feld: zwischen oberem Werbefeed und "FEED" */}
      <FeedPullToTop open={showBackToTop} onTrigger={scrollToTop} />
      <div className="mb-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">

        <h3 className="min-w-0 truncate text-[13px] font-bold tracking-widest text-foreground">
          {t.feed}
        </h3>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={toggleLiveFeed}
            role="switch"
            aria-checked={liveFeed}
            aria-label="Live-Feed"
            title="Live-Feed"
            className={`control-chip inline-flex shrink-0 items-center gap-1.5 rounded-full px-1.5 py-1 ${
              liveFeed ? "control-chip-active" : "control-track"
            }`}
          >
            {liveFeed ? <Radio className="h-3.5 w-3.5" /> : <RadioTower className="h-3.5 w-3.5" />}
            <span
              className={`relative block h-3.5 w-7 rounded-full transition-colors ${
                liveFeed ? "bg-brand/70" : "bg-border"
              }`}
            >
              <span
                className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-background transition-transform ${
                  liveFeed ? "translate-x-[1.05rem]" : "translate-x-0.5"
                }`}
              />
            </span>
          </button>
          <button
            type="button"
            onClick={toggleAutoPlay}
            role="switch"
            aria-checked={autoPlay}
            aria-label={autoPlay ? t.autoPlayOn : t.autoPlayOff}
            title={autoPlay ? t.autoPlayOn : t.autoPlayOff}
            className={`control-chip inline-flex shrink-0 items-center gap-1.5 rounded-full px-1.5 py-1 ${
              autoPlay ? "control-chip-active" : "control-track"
            }`}
          >
            {autoPlay ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            <span
              className={`relative block h-3.5 w-7 rounded-full transition-colors ${
                autoPlay ? "bg-brand/70" : "bg-border"
              }`}
            >
              <span
                className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-background transition-transform ${
                  autoPlay ? "translate-x-[1.05rem]" : "translate-x-0.5"
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      {newPostsCount > 0 && (
        <button
          type="button"
          onClick={() => {
            applyNewPosts();
            const el = feedScroller();
            if (el) el.scrollTo({ top: 0, behavior: "smooth" });
            else window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="control-bar mb-2 flex w-full items-center justify-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-brand"
        >
          <Radio className="h-3.5 w-3.5" />
          {newPostsCount === 1 ? "1 neuer Beitrag" : `${newPostsCount} neue Beiträge`}
        </button>
      )}


      <div className="-mx-1 flex items-center gap-2 overflow-x-auto border-b border-border px-1 pb-2 text-[12px] sm:gap-3.5 sm:text-[13px]">
        {tabs.map(({ key, label, Icon }) => {
          const on = active === key;
          return (
            <button
              key={key}
              onClick={() => setActive(key)}
              className={`-mb-[9px] inline-flex items-center gap-1 whitespace-nowrap px-1 pb-1.5 pt-0.5 transition-colors ${
                on
                  ? "border-b-2 border-brand text-brand"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" /> {label}
            </button>
          );
        })}
      </div>

      <div
        ref={scrollRef}
        data-feedscroll=""
        style={{
          touchAction: "pan-y",
          overscrollBehaviorY: "contain",
          // Eigene Korrektur statt Browser-Anker: sonst springt der Feed doppelt.
          overflowAnchor: "none",
          ...(scrollMaxHeight ? { maxHeight: scrollMaxHeight } : null),
        }}

        className={`mt-3 space-y-4 pr-1 scroll-smooth ${
          locked
            ? "overflow-visible"
            : scrollMaxHeight
              ? "overflow-y-auto"
              : "max-h-[80svh] overflow-y-auto sm:max-h-[680px] xl:max-h-[780px] 2xl:max-h-[880px]"
        }`}
      >
        {feed.length === 0 ? (
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
          feed.map((p, i) => (
            <div key={p.id} className="space-y-4">
              <SeenWatcher
                root={scrollRoot}
                enabled={adTest.active}
                onSeen={() => adTest.noteFeedImpression(p.id, i)}
              >
                <FeedPost
                  post={p}
                  scrollRoot={scrollRoot}
                  onOpen={(rect) => {
                    setOriginRect(rect);
                    setDetail(i);
                    // Echte Feed-Interaktion (Testmodus).
                    adTest.registerInteraction(i, p.id);
                    // Positives Signal: der Beitrag wurde bewusst geöffnet.
                    track({
                      signal: "view_complete",
                      postId: p.id,
                      authorId: p.userId,
                      // Getrennte Signale: Hashtags (#) und SlangTags ($) lernen eigenständig.
                      hashtags: p.hashtags,
                      slangTagIds: p.slangTagIds,
                      region: p.region,
                    });
                  }}
                />
              </SeenWatcher>
              {adTest.ad && adTest.slotPostId === p.id ? (
                <FeedAdCard
                  ad={adTest.ad}
                  position={adTest.slotPosition || i + 1}
                  lang={lang}
                  onEvent={(kind: AdTestKind) => adTest.logAdEvent(kind, { adId: adTest.ad?.id })}
                  onDismiss={adTest.dismissAd}
                />
              ) : (
                (() => {
                  const slot = adSlotFor(i, p.id);
                  if (!slot) return null;
                  return (
                    <FeedAdCard
                      ad={slot.ad}
                      position={i + 1}
                      lang={lang}
                      onEvent={(kind: AdTestKind) =>
                        adTest.logAdEvent(kind, { adId: slot.ad.id, position: i + 1 })
                      }
                      onDismiss={() =>
                        setDismissedAds((prev) => (prev.includes(p.id) ? prev : [...prev, p.id]))
                      }
                    />
                  );
                })()
              )}



            </div>
          ))
        )}
      </div>

      {detail !== null && (
        <PostDetailOverlay
          posts={feed}
          index={detail}
          originRect={originRect}
          onIndexChange={(next) => {
            // Wechsel zum nächsten/vorherigen Beitrag = eine Feed-Interaktion.
            adTest.registerInteraction(next, feed[next]?.id);
            setDetail(next);
          }}
          onClose={() => setDetail(null)}
        />
      )}


    </section>
  );
}

/**
 * Einzelnes Pull-Down-Feld in der Feed-Kopfstruktur: direkt unter dem oberen
 * Werbefeed und oberhalb der "FEED"-Ueberschrift. Standardmaessig dezent
 * eingeklappt, nach ca. 2 Wischbewegungen ausgeklappt. Beim Antippen wird
 * der Feed-Scroller sofort auf 0 gesetzt – ohne Reload, ohne neue Abfrage.
 */
function FeedPullToTop({
  open,
  onTrigger,
}: {
  open: boolean;
  onTrigger: () => void;
}) {
  return (
    <div
      className="flex justify-center overflow-hidden transition-[height,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
      style={{ height: open ? 30 : 8, opacity: open ? 1 : 0.35 }}
    >
      <button
        type="button"
        aria-label="Zurück zum Anfang"
        aria-hidden={!open}
        tabIndex={open ? 0 : -1}
        disabled={!open}
        onClick={() => onTrigger()}
        className={`control-bar flex items-center justify-center gap-1 rounded-full transition-[height,width] duration-300 ${
          open ? "h-7 w-24" : "pointer-events-none h-1.5 w-10"
        }`}
      >
        {open && (
          <>
            <ArrowUp className="h-3 w-3 text-primary" />
            <span className="h-[3px] w-8 rounded-full bg-foreground/25" />
          </>
        )}
      </button>
    </div>
  );
}



function Dashboard() {

  const { adRef, feedMode, scrollReady, adH, pullY } = useFeedMode<HTMLDivElement>();
  // Horizontaler Swipe aus dem mittleren Content-Bereich:
  // nach links → Arena, nach rechts → Slang Globe. Randzonen bleiben frei.
  useHorizontalNavSwipe({ left: "/arena", right: "/globe" });
  const slideIn = useSlideInClass();
  const scrollToComposer = () =>
    document.getElementById("composer")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div
      className={`min-h-screen overflow-x-clip bg-background text-foreground ${slideIn}`}
      style={{ willChange: slideIn ? "transform" : undefined }}
    >
      <div
        className={`mx-auto w-full transition-[max-width,padding] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
          feedMode
            ? "max-w-none px-0 py-0"
            : "max-w-[1200px] px-3 py-5 sm:px-4 sm:py-6 lg:py-8 xl:max-w-[1440px] 2xl:max-w-[1680px]"
        }`}
      >
        <div
          className={
            feedMode
              ? "relative grid grid-cols-1 gap-4 sm:gap-6"
              : "relative grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]"
          }
        >
          {/* PROFIL – inkl. eingeklappter Composer */}
          <div
            aria-hidden={feedMode}
            className={`space-y-4 sm:space-y-6 will-change-transform ${
              feedMode
                ? "pointer-events-none absolute inset-x-0 top-0 z-0 -translate-y-full opacity-0 transition-[transform,opacity] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                : // Rückweg ohne Transform-Animation: das Profil belegt seinen Platz
                  // sofort wieder, sonst entsteht bis zum Ende der Animation eine
                  // sichtbare Leerfläche zwischen Header und Feed.
                  "translate-y-0 opacity-100 transition-opacity duration-200 lg:sticky lg:top-16 lg:max-h-[calc(100svh-5rem)] lg:self-start lg:overflow-y-auto"
            }`}
          >
            <ProfilePanel>
              <section id="composer">
                <PostComposer />
              </section>
            </ProfilePanel>
          </div>

          {/* MITTE */}
          <div className="min-w-0 space-y-4 sm:space-y-6">
            {/* Werbefeed + Feed liegen im Feed-Modus in EINEM fixierten
                Container (Position ausschließlich aus der Headerhöhe).
                Dadurch folgt der Feed dem Werbefeed immer bündig – ohne
                zusätzliche Offsets, Lücken oder Sprünge. Die Pull-down-
                Animation bewegt beide Bereiche gemeinsam. */}
            <div
              style={
                feedMode
                  ? {
                      position: "fixed",
                      left: 0,
                      right: 0,
                      top: "var(--yd-header-h, 52px)",
                      bottom: 0,
                      zIndex: 30,
                      display: "flex",
                      flexDirection: "column",
                      transform: `translate3d(0,${pullY}px,0)`,
                      transition: pullY ? "none" : "transform 380ms cubic-bezier(0.22,1,0.36,1)",
                    }
                  : undefined
              }
              className={feedMode ? "will-change-transform" : "space-y-4 sm:space-y-6"}
            >
              {/* Werbefeed – kompakter Slider, im Feed-Modus Pull-down-Leiste */}
              <div
                ref={adRef}
                data-adbar=""
                style={feedMode ? { overscrollBehaviorY: "contain" } : undefined}
                className={
                  feedMode
                    ? "relative z-10 shrink-0 cursor-grab touch-pan-x bg-background/95 backdrop-blur active:cursor-grabbing"
                    : ""
                }
              >
                <AdSlider />
                {/* Weicher Auslauf statt harter Trennkante zwischen Leiste und Feed */}
                {feedMode && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-full h-6 bg-gradient-to-b from-background/95 to-transparent"
                  />
                )}
              </div>

              {/* Feed – begrenzter Scrollbereich direkt unter der Leiste */}
              <div className={feedMode ? "min-h-0 flex-1 overflow-hidden" : undefined}>
                <LiveFeed
                  onCreate={scrollToComposer}
                  locked={!scrollReady}
                  scrollMaxHeight={
                    feedMode
                      ? `calc(100svh - var(--yd-header-h, 52px) - ${adH + 104}px)`
                      : undefined
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
