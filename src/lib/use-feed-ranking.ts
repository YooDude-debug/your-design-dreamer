/**
 * Feed-Algorithmus – Anbindung an die Oberfläche.
 *
 * Wandelt Y-Dude-Beiträge in die Ranking-Form, lädt den Nutzerkontext einmalig
 * und sortiert den Feed. Signale werden gebündelt und im Hintergrund gesendet,
 * damit Scrollen und Wiedergabe nie blockiert werden.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { Post, SlangTag } from "@/lib/types";
import { getFeedContext, recordFeedSignals } from "@/lib/feed.functions";
import {
  FEED_CONFIG,
  rankPosts,
  type FeedMediaType,
  type FeedSignalInput,
  type FeedViewerContext,
  type RankablePost,
} from "@/lib/feed-ranking";

function mediaTypeOf(post: Post): FeedMediaType {
  if (post.image && post.audio) return "mixed";
  if (post.image) return "image";
  if (post.audio) return "audio";
  return "text";
}

/** Übersetzt einen Beitrag in die reduzierte Ranking-Form. */
export function toRankablePost(post: Post, tags: Map<string, SlangTag> = new Map()): RankablePost {
  const usedTags = post.slangTagIds.map((id) => tags.get(id)).filter((t): t is SlangTag => !!t);
  const sum = (pick: (tag: SlangTag) => number) => usedTags.reduce((n, tag) => n + pick(tag), 0);

  return {
    id: post.id,
    authorId: post.userId,
    createdAt: post.createdAt,
    region: post.region,
    hashtags: post.hashtags,
    slangTagIds: post.slangTagIds,
    slangRegions: usedTags.map((t) => t.region).filter(Boolean),
    slangLanguages: usedTags.map((t) => t.language).filter(Boolean),
    // Kein `topics: post.hashtags` – Hashtags haben ihren eigenen Faktor und
    // werden nie mit Themen oder SlangTags vermischt.
    mediaType: mediaTypeOf(post),
    stats: {
      likes: post.stats.likes,
      comments: post.stats.comments,
      shares: post.stats.shares,
      saves: post.stats.saves ?? 0,
      views: post.stats.views ?? 0,
    },
    slangQuality: usedTags.length
      ? {
          plays: sum((t) => t.stats?.plays ?? 0),
          completions: sum((t) => t.stats?.plays ?? 0),
          avgListenSeconds: 0,
          durationSeconds: 0,
          repeats: 0,
          likes: sum((t) => t.stats?.likes ?? 0),
          comments: sum((t) => t.stats?.comments ?? 0),
          shares: sum((t) => t.stats?.shares ?? 0),
          saves: sum((t) => t.stats?.saves ?? 0),
          upvotes: sum((t) => t.stats?.likes ?? 0),
          profileVisits: 0,
        }
      : undefined,
    quality: {
      descriptionLength: post.description.length,
      hasTitle: post.title.trim().length > 0,
      hashtagCount: post.hashtags.length,
      slangTagCount: post.slangTagIds.length,
      imagePixels: post.image ? FEED_CONFIG.goodImagePixels : 0,
      audioKbps: post.audio ? FEED_CONFIG.goodAudioKbps : 0,
    },
  };
}

/** Neutraler Kontext, solange der echte noch lädt (keine Umsortierung). */
const EMPTY_CONTEXT: FeedViewerContext = {
  userId: "",
  interests: [],
  location: {},
  languages: [],
  followingIds: [],
  followedHashtags: [],
  trendingHashtags: [],
  learned: {},
  muted: { authorIds: [], topics: [] },
};

/**
 * Sortiert die übergebenen Beiträge nach dem Feed-Algorithmus.
 * `enabled = false` liefert die Eingabe unverändert zurück.
 */
export function useFeedRanking(
  posts: Post[],
  options: { enabled?: boolean; tags?: Map<string, SlangTag> } = {},
) {
  const enabled = options.enabled ?? true;
  const loadContext = useServerFn(getFeedContext);
  const [ctx, setCtx] = useState<FeedViewerContext | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void loadContext()
      .then((value) => {
        if (alive) setCtx(value as FeedViewerContext);
      })
      .catch(() => {
        /* Ranking ist optional – bei Fehlern bleibt die Ausgangsreihenfolge. */
      });
    return () => {
      alive = false;
    };
  }, [enabled, loadContext]);

  return useMemo(() => {
    if (!enabled || !ctx || posts.length === 0) return posts;
    const rankable = posts.map((post) => toRankablePost(post, options.tags));
    const order = rankPosts(rankable, ctx ?? EMPTY_CONTEXT).map((p) => p.id);
    const byId = new Map(posts.map((p) => [p.id, p]));
    return order.map((id) => byId.get(id)).filter((p): p is Post => !!p);
  }, [enabled, ctx, posts, options.tags]);
}

/**
 * Signal-Sammler: bündelt Ereignisse und schickt sie verzögert ab.
 * Fehler werden bewusst verschluckt, der Feed darf davon nie abhängen.
 */
export function useFeedSignals() {
  const send = useServerFn(recordFeedSignals);
  const queue = useRef<FeedSignalInput[]>([]);
  const timer = useRef<number | undefined>(undefined);

  const flush = useCallback(() => {
    const signals = queue.current;
    queue.current = [];
    if (signals.length === 0) return;
    void send({ data: { signals } }).catch(() => undefined);
  }, [send]);

  const track = useCallback(
    (signal: FeedSignalInput) => {
      queue.current.push(signal);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, 2_500);
    },
    [flush],
  );

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
      flush();
    },
    [flush],
  );

  return { track, flush };
}
