import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useMemo, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAutoPlay, stopAll } from "@/lib/autoplay";
import { useLiveFeed, LIVE_FEED_INTERVAL_MS } from "@/lib/live-feed";
import {
  resolveFeedScroller,
  scrollFeedToTop,
  feedScrollTop,
  feedViewportHeight,
  subscribeFeedScroll,
} from "@/lib/feed-scroll";
import { createFeedAnchor } from "@/lib/feed-anchor";
import { useFeedRanking, useFeedSignals } from "@/lib/use-feed-ranking";
import { useFeedMode } from "@/lib/use-feed-mode";
import { patchFeedSession, readFeedSession } from "@/lib/feed-session";
import { useSlideInClass } from "@/lib/use-swipe-nav-gesture";
import {
  Globe,
  MapPin,
  Users,
  PlusSquare,
  Volume2,
  VolumeX,
  Radio,
  RadioTower,
  ArrowUp,
  Tv,
  ChevronDown,
  Swords,
  Globe2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFollowedChannelIds } from "@/lib/channels.functions";
import { listFollowedHashtags } from "@/lib/hashtags.functions";
import { useLang } from "@/lib/lang-context";
import { useData } from "@/lib/data-context";
import { type Post, type SlangTag } from "@/lib/types";
import { isTabKey, selectFeedPosts, type TabKey } from "@/lib/feed-tabs";
import { PostDetailOverlay } from "@/components/PostDetailOverlay";
import { PostComposer } from "@/components/CreatePostDialog";
import { ChallengeOnboarding } from "@/components/ChallengeOnboarding";
import { ProfilePanel } from "@/components/ProfilePanel";
import { AdSlider } from "@/components/AdSlider";
import { FeedAdCard } from "@/components/feed/FeedAdCard";
import { AdSenseDevSlot } from "@/components/ads/AdSenseDevSlot";
import { FeedVideoAdCard } from "@/components/feed/FeedVideoAdCard";
import { SPONSORED_ADS } from "@/lib/ad-demo";
import { videoAdById } from "@/lib/ad-video-demo";
import { useAdTestCounter } from "@/lib/ad-test-counter";
import { useFeedAdPlan } from "@/lib/use-feed-ad-plan";
import { useAdPause, useAdsEnabled } from "@/lib/ad-pause";
import type { AdTestKind } from "@/lib/live-test.shared";
import { ToggleTrack } from "@/components/ui/toggle-track";
import { FeedPost, SeenWatcher } from "@/components/feed/FeedPost";

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
    loadMorePosts,
    hasMorePosts,
    loadingMorePosts,
  } = useData();

  const { t, lang } = useLang();
  /**
   * Rückkehr aus Market/Channels/Profil: Reiter, Infinite-Scroll-Stand und
   * Scrollposition stammen aus dem gemerkten Feed-Sitzungszustand
   * (`feed-session.ts`) – der Feed startet nicht neu oben.
   */
  const restoredSession = useRef(readFeedSession());
  const restoredTab: TabKey = isTabKey(restoredSession.current?.tab)
    ? restoredSession.current.tab
    : "global";
  const [active, setActive] = useState<TabKey>(restoredTab);
  const [mainTab, setMainTab] = useState<TabKey>(
    restoredTab === "channels" ? "global" : restoredTab,
  );

  const [feedMenuOpen, setFeedMenuOpen] = useState(false);
  const feedMenuRef = useRef<HTMLDivElement>(null);
  /**
   * Die Detailansicht merkt sich den BEITRAG, nicht seine Position. Rutschen
   * neue Beiträge nach oben nach, bleibt weiterhin derselbe Beitrag offen.
   */
  const [detailId, setDetailId] = useState<string | null>(null);
  const [originRect, setOriginRect] = useState<DOMRect | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null);
  const { autoPlay, toggleAutoPlay } = useAutoPlay();
  const { liveFeed, toggleLiveFeed } = useLiveFeed();

  /** Gefolgte Themenbereiche (bestehende Hashtag-Follows). */
  const fetchChannels = useServerFn(listFollowedHashtags);
  const { data: channels = [] } = useQuery({
    queryKey: ["followed-channels", me?.id ?? ""],
    queryFn: () => fetchChannels(),
    // Lazy: erst laden, wenn der Reiter "Channels" wirklich geoeffnet wird.
    // Global/Lokal/Folge ich fuehren damit keine Channel-Abfrage aus.
    enabled: Boolean(me?.id) && active === "channels",
    staleTime: 300_000,
  });

  /**
   * Gefolgte echte Channels – nur die IDs (`channel_follows`), keine
   * Channel-Metadaten. Ebenfalls lazy: ausschliesslich im Reiter "Channels".
   */
  const fetchChannelIds = useServerFn(listFollowedChannelIds);
  const { data: followedChannelIds = [] } = useQuery({
    queryKey: ["followed-channel-ids", me?.id ?? ""],
    queryFn: () => fetchChannelIds(),
    enabled: Boolean(me?.id) && active === "channels",
    staleTime: 300_000,
  });

  useEffect(() => setScrollRoot(scrollRef.current), []);
  useEffect(() => {
    if (!feedMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (!feedMenuRef.current?.contains(e.target as Node)) setFeedMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [feedMenuOpen]);
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

  /**
   * Live-Feed: alle 10 Sekunden nur auf neue Beiträge prüfen. Es wird nichts
   * ersetzt und nichts verschoben – neue Beiträge werden vorgeladen und nur
   * dann sofort eingefügt, wenn der Feed ganz oben steht und keine
   * Detailansicht offen ist. Kein Polling bei inaktivem Tab.
   */
  /** Offene Detailansicht ohne Effekt-Neustart prüfbar halten. */
  const detailRef = useRef<string | null>(null);
  useEffect(() => {
    detailRef.current = detailId;
  }, [detailId]);

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
        // Neue Beiträge rutschen direkt nach. Die Scrollposition bleibt
        // erhalten (Höhenausgleich weiter unten), ein Reload findet nicht
        // statt. Läuft gerade eine Videowerbung, wird nichts eingefügt.
        const adOverlay = document.querySelector("[data-feed-ad-overlay]");
        if (!stopped && count > 0 && !adOverlay) applyNewPosts();
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
   *  Eigene Beiträge (Bild, GIF, SlangShot, mit SlangTags) erscheinen wie
   *  gewohnt im eigenen Feed; die Filterlogik für fremde Beiträge bleibt
   *  unverändert. */
  const visible = useMemo(
    () =>
      selectFeedPosts(posts, active, {
        location: me?.location,
        meId: me?.id,
        following,
        hashtags: channels,
        channelIds: followedChannelIds,
      }),
    [posts, active, me, following, channels, followedChannelIds],
  );

  /**
   * Feed-Algorithmus 2.0: personalisierte Reihenfolge (Interessen, Region,
   * SlangTag-Qualität, Aktualität, Vielfalt). "Trending" bleibt bewusst
   * rein nach Interaktionen sortiert.
   */
  const bootstrapReady = !loading && Boolean(me?.id);
  const ranked = useFeedRanking(visible, {
    enabled: true,
    ready: bootstrapReady,
  });
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
   * Nur der tatsaechlich benoetigte Teil des Feeds wird gerendert. Die
   * Reihenfolge, die Werbeplaetze (an Beitrags-IDs verankert) und das
   * bestehende Lazy Loading bleiben unveraendert – es wird lediglich
   * kontrolliert nachgerendert, statt alle Beitraege sofort aufzubauen.
   * Nachladen erfolgt ueber einen Beobachter am Listenende: kein zusaetzlicher
   * Scroll-Handler, keine neue Netzabfrage.
   */
  const FEED_PAGE = 20;
  const [renderCount, setRenderCount] = useState(() =>
    Math.max(FEED_PAGE, restoredSession.current?.renderCount ?? FEED_PAGE),
  );
  // Reiterwechsel setzt den Renderstand zurueck – der erste Lauf (Mount) nicht,
  // sonst wuerde der wiederhergestellte Stand sofort verworfen.
  const tabSettled = useRef(false);
  useEffect(() => {
    if (!tabSettled.current) {
      tabSettled.current = true;
      return;
    }
    setRenderCount(FEED_PAGE);
  }, [active]);

  const rendered = useMemo(() => feed.slice(0, renderCount), [feed, renderCount]);
  /**
   * P-02: Der Beobachter am Listenende rendert zuerst die bereits geladenen
   * Beiträge nach; ist der geladene Stand aufgebraucht, wird die nächste
   * Server-Seite (20 Beiträge) geholt.
   */
  const hasMoreRendered = renderCount < feed.length || hasMorePosts;
  const showMore = useCallback(() => {
    if (renderCount < feed.length) {
      setRenderCount((prev) => prev + FEED_PAGE);
      return;
    }
    if (hasMorePosts && !loadingMorePosts) void loadMorePosts();
  }, [feed.length, renderCount, hasMorePosts, loadingMorePosts, loadMorePosts]);

  /**
   * Scroll-Anker des Feeds – die Logik liegt gebündelt in `feed-anchor.ts`.
   * Hier wird sie nur an den Feed-Container gebunden: gemerkt wird der oberste
   * sichtbare Beitrag, ausgeglichen wird ausschliesslich dessen Verschiebung.
   */
  const anchor = useMemo(
    () => createFeedAnchor(feedScroller, () => scrollRef.current),
    [feedScroller],
  );

  useEffect(() => subscribeFeedScroll(anchor.record), [anchor]);

  useLayoutEffect(() => {
    anchor.restore();
  }, [anchor, feed, rendered]);

  /**
   * Feed-Sitzung: laufend den echten Scrollzustand mitschreiben (gedrosselter
   * gemeinsamer Listener) – Quelle ist der tatsaechlich scrollende Container,
   * sonst die Seite. Zusaetzlich der zuletzt oben sichtbare Beitrag als
   * stabiler Anker.
   */
  const sessionState = useRef({ active, renderCount });
  sessionState.current = { active, renderCount };
  useEffect(() => {
    const save = () => {
      const el = scrollRef.current;
      const viewTop = el ? el.getBoundingClientRect().top : 0;
      let anchorId: string | null = null;
      let anchorOffset = 0;
      const root = el ?? null;
      if (root) {
        for (const node of Array.from(root.querySelectorAll<HTMLElement>("[data-post-id]"))) {
          const rect = node.getBoundingClientRect();
          if (rect.bottom > viewTop + 1) {
            anchorId = node.dataset["postId"] ?? null;
            anchorOffset = rect.top - viewTop;
            break;
          }
        }
      }
      patchFeedSession({
        tab: sessionState.current.active,
        renderCount: sessionState.current.renderCount,
        scrollTop: el ? el.scrollTop : 0,
        windowScrollY: window.scrollY,
        anchorId,
        anchorOffset,
      });
    };
    save();
    return subscribeFeedScroll(save);
  }, []);

  /**
   * Rueckkehr in den Feed: genau EINE Wiederherstellung, sobald Beitraege
   * gerendert sind. Bevorzugt ueber den gemerkten Beitrag (stabil, auch wenn
   * sich Kartenhoehen oder Feed-Daten leicht geaendert haben), sonst ueber die
   * rohe Scrollposition. Kein fester Wert, keine Verzoegerung.
   */
  const sessionRestored = useRef(false);
  useLayoutEffect(() => {
    if (sessionRestored.current) return;
    const prev = restoredSession.current;
    if (!prev || (prev.scrollTop <= 0 && prev.windowScrollY <= 0)) {
      sessionRestored.current = true;
      return;
    }
    if (rendered.length === 0) return;
    const el = scrollRef.current;
    if (!el) return;
    sessionRestored.current = true;

    const apply = () => {
      const node = prev.anchorId
        ? el.querySelector<HTMLElement>(`[data-post-id="${CSS.escape(prev.anchorId)}"]`)
        : null;
      if (node) {
        const delta = node.getBoundingClientRect().top - el.getBoundingClientRect().top;
        el.scrollTop = Math.max(0, Math.round(el.scrollTop + delta - prev.anchorOffset));
      } else if (prev.scrollTop > 0) {
        el.scrollTop = prev.scrollTop;
      }
      if (prev.windowScrollY > 0 && window.scrollY !== prev.windowScrollY) {
        window.scrollTo({ top: prev.windowScrollY, behavior: "instant" as ScrollBehavior });
      }
    };
    apply();
    // Eine stille Nachkorrektur im naechsten Frame (Layout der Karten steht
    // erst dann endgueltig) – danach wird nicht mehr gescrollt.
    window.requestAnimationFrame(apply);
  }, [rendered]);

  /**
   * Live-Testmodus des Werbekernels: zählt echte Feed-Interaktionen und
   * mischt nach 15/25 Interaktionen eine gekennzeichnete Werbekarte ein.
   * Nur für Admin-Sitzungen und nur bei aktivem Testmodus.
   */
  const adTest = useAdTestCounter(Boolean(isAdmin));

  /**
   * Öffnen der Detailansicht: eine einzige, über alle Renderdurchläufe stabile
   * Funktion. Dadurch bleiben die Beitragskarten von Werbe- und Zählerwechseln
   * unberührt (kein Neurendern der ganzen Liste).
   */
  const sideEffects = useRef({ adTest, track });
  sideEffects.current = { adTest, track };
  const openDetail = useCallback(
    (rect: DOMRect, post: Post, index: number) => {
      // Feedposition einfrieren, BEVOR die Detailansicht das Scrollen sperrt.
      anchor.hold();
      setOriginRect(rect);
      setDetailId(post.id);
      // Echte Feed-Interaktion (Testmodus).
      sideEffects.current.adTest.registerInteraction(index, post.id);
      // Positives Signal: der Beitrag wurde bewusst geöffnet.
      sideEffects.current.track({
        signal: "view_complete",
        postId: post.id,
        authorId: post.userId,
        // Getrennte Signale: Hashtags (#) und SlangTags ($) lernen eigenständig.
        hashtags: post.hashtags,
        slangTagIds: post.slangTagIds,
        region: post.region,
      });
    },
    [anchor],
  );

  /** Position des offenen Beitrags im aktuellen Feed (-1 = nicht offen). */
  const detailIndex = useMemo(
    () => (detailId ? feed.findIndex((p) => p.id === detailId) : -1),
    [detailId, feed],
  );

  /** Verschwindet der offene Beitrag (gelöscht/gefiltert), schliesst die Ansicht. */
  useEffect(() => {
    if (detailId && detailIndex < 0) setDetailId(null);
  }, [detailId, detailIndex]);

  /**
   * Rueckkehr aus der Detailansicht: die eingefrorene Feedposition wird genau
   * EINMAL exakt wiederhergestellt – ohne Animation, ohne Sprung nach oben und
   * ohne Verschiebung um Beitraege (der gemerkte Beitrag ist die Referenz,
   * nicht sein Index).
   */
  const detailWasOpen = useRef(false);
  useLayoutEffect(() => {
    if (detailId !== null) {
      detailWasOpen.current = true;
      return;
    }
    if (!detailWasOpen.current) return;
    detailWasOpen.current = false;
    anchor.release();
  }, [detailId, anchor]);

  /**
   * Regulaere Werbeplatzierung: der Werbeplan kommt serverseitig und mischt
   * personalisierte Bildwerbung und Videowerbung mit variablen Abstaenden.
   * Feste Intervalle gibt es bewusst nicht.
   */
  const adsState = useAdsEnabled(me?.id, Boolean(isAdmin));
  /**
   * Werbepause: temporaerer Schalter des Nutzers. Ist sie aktiv, werden im Feed
   * keine Werbekarten gerendert – die Werbelogik selbst bleibt unveraendert.
   */
  const adPause = useAdPause(me?.id);
  const adsVisible = adsState.enabled && !adPause.active;
  const adPlan = useFeedAdPlan(adsVisible, bootstrapReady && !adsState.loading);

  const mainTabs: { key: TabKey; label: string; Icon: typeof MapPin }[] = [
    { key: "local", label: t.local, Icon: MapPin },
    { key: "global", label: t.globalTab, Icon: Globe },
    { key: "following", label: t.following, Icon: Users },
  ];

  return (
    <section
      className={`rounded-none border-x-0 border-y-0 bg-background px-1 py-2 sm:rounded-3xl sm:border sm:border-brand/10 sm:px-3 sm:py-3 ${
        // Im Feed-Modus muss die Hoehenkette durchgehend definit sein, sonst
        // kann der innere Scrollbereich keine Resthoehe bestimmen.
        scrollMaxHeight ? "flex min-h-0 flex-1 flex-col" : ""
      }`}
    >
      {/* Einziges Pull-Down-Feld: zwischen oberem Werbefeed und Feed-Navigation */}
      <FeedPullToTop getScroller={feedScroller} onTrigger={scrollToTop} />

      {/* [Auto Feed] [Feed-Auswahl ▼] [Channels] [Auto Sound] – eine Reihe */}
      <div className="flex items-center justify-between gap-1 text-[10px] sm:justify-center sm:gap-2 sm:text-xs">
        {/* Automatischer Feed */}
        <button
          type="button"
          onClick={toggleLiveFeed}
          role="switch"
          aria-checked={liveFeed}
          aria-label={liveFeed ? t.autoFeedOn : t.autoFeedOff}
          title={liveFeed ? t.autoFeedOn : t.autoFeedOff}
          className={`control-chip inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-1 sm:gap-1.5 sm:px-2 ${
            liveFeed ? "control-chip-active" : "control-track"
          }`}
        >
          {liveFeed ? (
            <Radio className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
          ) : (
            <RadioTower className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
          )}
          <span className="hidden xs:inline font-medium leading-none">{t.autoFeed}</span>
          <ToggleTrack on={liveFeed} />
        </button>

        {/* Slang Globe – sichtbarer Button statt Wisch-Geste */}
        <Link
          to="/globe"
          aria-label="Slang Globe"
          title="Slang Globe"
          className="control-chip control-track inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full sm:h-8 sm:w-8"
        >
          <Globe2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Link>

        {/* Feed-Auswahl: ein klickbarer Container */}
        <div ref={feedMenuRef} className="relative flex min-w-0 shrink">
          <button
            type="button"
            onClick={() => setFeedMenuOpen((s) => !s)}
            aria-haspopup="listbox"
            aria-expanded={feedMenuOpen}
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 font-medium sm:px-2.5 ${
              active !== "channels" ? "control-chip-active" : "control-chip"
            }`}
          >
            {(() => {
              const Current = mainTabs.find((m) => m.key === mainTab)!.Icon;
              return <Current className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />;
            })()}
            <span className="truncate leading-none">
              {mainTabs.find((m) => m.key === mainTab)!.label}
            </span>
            <ChevronDown
              className={`h-3 w-3 shrink-0 transition-transform sm:h-3.5 sm:w-3.5 ${
                feedMenuOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {feedMenuOpen && (
            <div
              role="listbox"
              className="absolute top-full left-1/2 z-20 mt-1 min-w-[7.5rem] -translate-x-1/2 rounded-xl border border-[var(--control-border)] bg-[var(--control-surface)] p-1 shadow-[var(--shadow-control)] backdrop-blur"
            >
              {mainTabs.map(({ key, label, Icon }) => {
                const selected = mainTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      setMainTab(key);
                      setActive(key);
                      setFeedMenuOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[10px] font-medium sm:text-xs ${
                      selected ? "text-brand" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Channels */}
        <button
          type="button"
          onClick={() => setActive(active === "channels" ? mainTab : "channels")}
          aria-pressed={active === "channels"}
          className={`control-chip inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 font-medium sm:px-2.5 ${
            active === "channels" ? "control-chip-active" : "control-track"
          }`}
        >
          <Tv className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
          <span className="leading-none">{t.channelsTab}</span>
        </button>

        {/* Slang Arena – sichtbarer Button statt Wisch-Geste */}
        <Link
          to="/arena"
          search={{ tab: "box" as const }}
          aria-label="Slang Arena"
          title="Slang Arena"
          className="control-chip control-track inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full sm:h-8 sm:w-8"
        >
          <Swords className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Link>

        {/* Automatische Soundwiedergabe */}
        <button
          type="button"
          onClick={toggleAutoPlay}
          role="switch"
          aria-checked={autoPlay}
          aria-label={autoPlay ? t.autoSoundOn : t.autoSoundOff}
          title={autoPlay ? t.autoSoundOn : t.autoSoundOff}
          className={`control-chip inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-1 sm:gap-1.5 sm:px-2 ${
            autoPlay ? "control-chip-active" : "control-track"
          }`}
        >
          {autoPlay ? (
            <Volume2 className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
          ) : (
            <VolumeX className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
          )}
          <span className="hidden xs:inline font-medium leading-none">{t.autoSound}</span>
          <ToggleTrack on={autoPlay} />
        </button>
      </div>

      {newPostsCount > 0 && (
        <button
          type="button"
          onClick={() => {
            applyNewPosts();
            scrollFeedToTop(scrollRef.current ?? feedScroller(), true);
          }}
          className="control-bar mb-2 flex w-full items-center justify-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-brand"
        >
          <Radio className="h-3.5 w-3.5" />
          {newPostsCount === 1 ? "1 neuer Beitrag" : `${newPostsCount} neue Beiträge`}
        </button>
      )}

      <div
        ref={scrollRef}
        data-feedscroll=""
        style={{
          touchAction: "pan-y",
          overscrollBehaviorY: "contain",
          // Eigene Korrektur statt Browser-Anker: sonst springt der Feed doppelt.
          overflowAnchor: "none",
          ...(scrollMaxHeight
            ? {
                // Kein `maxHeight: 100%`: gegen eine Auto-Hoehe des Elternteils
                // ist das unbestimmt, der Bereich wuchs mit dem Inhalt und war
                // dadurch nicht mehr scrollbar. Die Resthoehe kommt jetzt aus
                // der Flex-Kette (flex-1 + min-h-0).
                // Letzter Beitrag bleibt oberhalb von Systemleiste/Safe-Area
                // vollstaendig erreichbar.
                paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
                WebkitOverflowScrolling: "touch",
              }
            : null),
        }}
        // Kein `scroll-smooth`: Ausgleichs-Scrolls des Ankers würden sonst als
        // sichtbare Fahrt über mehrere Beiträge animiert werden.
        className={`mx-auto mt-2 w-full max-w-[600px] space-y-4 px-0.5 sm:px-1 ${
          locked
            ? "overflow-visible"
            : scrollMaxHeight
              ? "min-h-0 flex-1 overflow-y-auto"
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
          rendered.map((p, i) => (
            <div key={p.id} className="space-y-4">
              <SeenWatcher
                root={scrollRoot}
                enabled={adTest.active}
                onSeen={() => adTest.noteFeedImpression(p.id, i)}
              >
                <FeedPost post={p} index={i} scrollRoot={scrollRoot} onOpen={openDetail} />
              </SeenWatcher>
              {!adsVisible ? null : adTest.ad && adTest.slotPostId === p.id ? (
                /* Testmodus: die ursprüngliche Y-Dude Test-Werbekarte
                   (blauer Rahmen, „GESPONSERT“) – auch für Admins. */
                <FeedAdCard
                  ad={adTest.ad}
                  position={adTest.slotPosition || i + 1}
                  lang={lang}
                  onEvent={(kind: AdTestKind) => adTest.logAdEvent(kind, { adId: adTest.ad?.id })}
                  onDismiss={adTest.dismissAd}
                />
              ) : (
                (() => {
                  const slot = adPlan.slotFor(i, p.id);
                  if (!slot) return null;
                  const onEvent = (kind: AdTestKind) => {
                    if (kind === "ad_impression") adPlan.noteShown(slot.adId);
                    adTest.logAdEvent(kind, { adId: slot.adId, position: slot.position });
                  };
                  const onDismiss = () => adPlan.dismiss(p.id);
                  /* Entwicklungs-Platzhalter: zeigt nur die spätere
                     AdSense-Position. Kein Google-Kontakt, keine Messung. */
                  if (slot.source === "adsense_preview") {
                    return <AdSenseDevSlot position={slot.position} lang={lang} />;
                  }
                  if (slot.kind === "video") {
                    const video = videoAdById(slot.adId);
                    if (video) {
                      return (
                        <FeedVideoAdCard
                          ad={video}
                          position={slot.position}
                          lang={lang}
                          autoPlay={autoPlay}
                          onEvent={onEvent}
                          onDismiss={onDismiss}
                        />
                      );
                    }
                  }
                  const ad = SPONSORED_ADS.find((a) => a.id === slot.adId);
                  if (ad) {
                    adPlan.noteShown(slot.adId);
                    return (
                      <FeedAdCard
                        ad={ad}
                        position={slot.position}
                        lang={lang}
                        onEvent={onEvent}
                        onDismiss={onDismiss}
                      />
                    );
                  }
                  /* Echte/externe Werbung (z. B. SkyNori) bleibt unverändert
                     im bestehenden Werbefeed. */
                  adPlan.noteShown(slot.adId);
                  return (
                    <AdSlider
                      variant="feed"
                      onEvent={(kind) =>
                        adTest.logAdEvent(kind as AdTestKind, {
                          adId: slot.adId,
                          position: slot.position,
                        })
                      }
                    />
                  );
                })()
              )}
            </div>
          ))
        )}
        {hasMoreRendered ? <FeedMoreSentinel onReach={showMore} /> : null}
      </div>

      {/* Detailansicht liegt bewusst direkt am <body>: der Feed-Modus rendert
          Werbefeed und Feed in einem transformierten, fixierten Container –
          darin waere `position: fixed` an diesen Container gebunden und die
          Ansicht koennte beim ersten Oeffnen verschoben/verschiebbar wirken. */}
      {detailIndex >= 0 &&
        typeof document !== "undefined" &&
        createPortal(
          <PostDetailOverlay
            posts={feed}
            index={detailIndex}
            originRect={originRect}
            onIndexChange={(next) => {
              // Wechsel zum nächsten/vorherigen Beitrag = eine Feed-Interaktion.
              adTest.registerInteraction(next, feed[next]?.id);
              setDetailId(feed[next]?.id ?? null);
            }}
            onClose={() => setDetailId(null)}
          />,
          document.body,
        )}
    </section>
  );
}

/**
 * Einzelnes Pull-Down-Feld in der Feed-Kopfstruktur: direkt unter dem oberen
 * Werbefeed und oberhalb der "FEED"-Ueberschrift. Standardmaessig dezent
 * eingeklappt, nach ca. 2 Wischbewegungen ausgeklappt. Beim Antippen wird
 * der Feed-Scroller sofort auf 0 gesetzt – ohne Reload, ohne neue Abfrage.
 *
 * Die Sichtbarkeit wird hier lokal beobachtet (ein gemeinsamer, gedrosselter
 * Scroll-Listener). So loest Scrollen kein Neu-Rendern des gesamten Feeds aus.
 */
function FeedPullToTop({
  getScroller,
  onTrigger,
}: {
  getScroller: () => HTMLElement | null;
  onTrigger: () => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const update = () => {
      const scroller = getScroller();
      const next = feedScrollTop(scroller) > feedViewportHeight(scroller) * 2;
      setOpen((prev) => (prev === next ? prev : next));
    };
    update();
    return subscribeFeedScroll(update);
  }, [getScroller]);

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
  const { adRef, feedMode, scrollReady, pullY } = useFeedMode<HTMLDivElement>();
  // Navigation zu Globe/Arena laeuft ausschliesslich ueber die Buttons in der
  // Kopfleiste – keine Oeffnungs-Wischgeste mehr im Feed.
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
              : "relative grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[320px_minmax(0,640px)] xl:grid-cols-[360px_minmax(0,640px)] lg:justify-center"
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
                <PostComposer forceOpen />
              </section>
            </ProfilePanel>
          </div>

          {/* MITTE */}
          <div className="min-w-0 space-y-4 sm:space-y-6">
            {!feedMode && <ChallengeOnboarding />}
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
                      background: "var(--background)",
                      display: "flex",
                      flexDirection: "column",
                      transform: `translate3d(0,${pullY}px,0)`,
                      transition: pullY ? "none" : "transform 380ms cubic-bezier(0.22,1,0.36,1)",
                    }
                  : undefined
              }
              // Im Feed-Modus bleibt der Feed auf Desktop in derselben
              // Spaltenbreite wie im Startlayout (zentriert, gross lesbar) –
              // das Andocken des Werbefeeds veraendert die Groesse nicht.
              // Mobile/Tablet: unveraendert volle Breite.
              // Ausserhalb des Feed-Modus: Flex-Spalte mit kleinem, definiertem
              // Abstand. Rendert der Werbefeed nichts, wird der leere Halter per
              // `empty:hidden` ausgeblendet und der Gap entfaellt komplett – der
              // Feed reserviert keinen Werbeplatz.
              className={
                feedMode
                  ? "will-change-transform lg:mx-auto lg:w-full lg:max-w-[640px]"
                  : "flex flex-col gap-2 sm:gap-3"
              }
            >
              {/* Werbefeed – kompakter Slider, im Feed-Modus Pull-down-Leiste */}
              <div
                ref={adRef}
                data-adbar=""
                style={feedMode ? { overscrollBehaviorY: "contain" } : undefined}
                className={
                  feedMode
                    ? "relative z-10 shrink-0 cursor-grab touch-pan-x bg-background active:cursor-grabbing empty:hidden"
                    : "empty:hidden"
                }
              >
                <AdSlider />
                {/* Weicher Auslauf statt harter Trennkante zwischen Leiste und Feed */}
                {feedMode && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-full h-6 bg-gradient-to-b from-background to-transparent"
                  />
                )}
              </div>

              {/* Feed – begrenzter Scrollbereich direkt unter der Leiste */}
              <div
                className={feedMode ? "flex min-h-0 flex-1 flex-col overflow-hidden" : undefined}
              >
                <LiveFeed
                  onCreate={scrollToComposer}
                  locked={!scrollReady}
                  // Keine eigene Viewport-Rechnung (100svh o.ä.): der fixierte
                  // Container liefert im Feed-Modus bereits die exakte, vom
                  // Browser laufend korrigierte Resthoehe. In Mobile Chrome
                  // wanderte der Feed sonst unter den Bildschirmrand, sobald
                  // die Adressleiste ein-/ausgeblendet wurde.
                  scrollMaxHeight={feedMode ? "100%" : undefined}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Unsichtbarer Beobachter am Listenende: sobald er in die Naehe des sichtbaren
 * Bereichs kommt, wird der naechste Abschnitt des Feeds gerendert. Bewusst per
 * IntersectionObserver – ohne zusaetzlichen Scroll-Handler.
 */
function FeedMoreSentinel({ onReach }: { onReach: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onReach();
      },
      { rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [onReach]);

  return <div ref={ref} aria-hidden className="h-4 w-full" />;
}
