/**
 * Feed-Algorithmus – Anbindung an die Oberfläche.
 *
 * Wandelt Y-Dude-Beiträge in die Ranking-Form, lädt den Nutzerkontext einmalig
 * und sortiert den Feed. Signale werden gebündelt und im Hintergrund gesendet,
 * damit Scrollen und Wiedergabe nie blockiert werden.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { Post, SlangTag } from "@/lib/types";
import { getFeedContext } from "@/lib/feed.functions";
import { flushFeedSignals, trackFeedSignal } from "@/lib/feed-signals";
import {
  FEED_CONFIG,
  rankPosts,
  type FeedMediaType,
  type FeedViewerContext,
  type RankablePost,
} from "@/lib/feed-ranking";

/**
 * Zwischenspeicher fuer den Personalisierungs-Kontext (nur Sitzung, kein neues
 * Tracking). Er sorgt dafuer, dass die Personalisierung schon beim ersten
 * Rendern greift, statt die sichtbare Liste nachtraeglich umzusortieren.
 */
const CTX_KEY = "yd-feed-ctx";

function cachedContext(): FeedViewerContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CTX_KEY);
    return raw ? (JSON.parse(raw) as FeedViewerContext) : null;
  } catch {
    return null;
  }
}

function cacheContext(value: FeedViewerContext) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CTX_KEY, JSON.stringify(value));
  } catch {
    /* Speicher voll oder gesperrt – Personalisierung laeuft trotzdem. */
  }
}

/**
 * Session-Variation: eine kleine Kennung pro Browser-Sitzung. Sie wird nicht
 * dauerhaft gespeichert und ändert nur die Reihenfolge nahezu gleichwertiger
 * Beiträge – die Personalisierung bleibt unverändert.
 */
function sessionSeed() {
  if (typeof window === "undefined") return "";
  try {
    const key = "yd-feed-session";
    let value = window.sessionStorage.getItem(key);
    if (!value) {
      value = Math.random().toString(36).slice(2, 10);
      window.sessionStorage.setItem(key, value);
    }
    return value;
  } catch {
    return "";
  }
}

/** Zuletzt ganz oben gezeigte Beiträge dieser Sitzung (max. 5 IDs). */
function recentTopIds() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem("yd-feed-top") ?? "[]";
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function rememberTopIds(ids: string[]) {
  if (typeof window === "undefined" || ids.length === 0) return;
  try {
    window.sessionStorage.setItem("yd-feed-top", JSON.stringify(ids.slice(0, 3)));
  } catch {
    /* Speicher ist optional. */
  }
}

function mediaTypeOf(post: Post): FeedMediaType {
  if (post.image && post.audio) return "mixed";
  if (post.image) return "image";
  if (post.audio) return "audio";
  return "text";
}

/** "0:03" / "3.4" → Sekunden. Ohne verlässliche Angabe: 0. */
function durationSeconds(value: string | undefined | null) {
  const raw = (value ?? "").trim();
  if (!raw) return 0;
  const parts = raw.split(":");
  const n =
    parts.length === 2
      ? Number(parts[0]) * 60 + Number(parts[1])
      : Number(raw.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Übersetzt einen Beitrag in die reduzierte Ranking-Form. */
export function toRankablePost(post: Post, tags: Map<string, SlangTag> = new Map()): RankablePost {
  const usedTags = post.slangTagIds
    .map((id) => tags.get(id))
    .filter((t): t is SlangTag => !!t)
    // Werbe-/Unternehmens-SlangTags fließen nie in das organische Ranking ein.
    .filter((t) => !t.sponsored && t.ownerType !== "company");
  const avg = (pick: (tag: SlangTag) => number) =>
    usedTags.length === 0 ? 0 : usedTags.reduce((n, tag) => n + pick(tag), 0) / usedTags.length;

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
    channelId: post.channelId ?? null,
    imageCount: post.image ? 1 : 0,
    hasVideo: Boolean(post.video),
    stats: {
      likes: post.stats.likes,
      comments: post.stats.comments,
      shares: post.stats.shares,
      saves: post.stats.saves ?? 0,
      views: post.stats.views ?? 0,
    },
    // Statistiken werden GEMITTELT (nicht summiert): mehr SlangTags an einem
    // Beitrag erzeugen dadurch keinen künstlichen Reichweitenvorteil.
    // Nicht gemessene Größen bleiben 0 und werden im Faktor als "unbekannt"
    // behandelt – sie dürfen nie als perfekter Wert gelten.
    slangQuality: usedTags.length
      ? {
          plays: avg((t) => t.stats?.plays ?? 0),
          completions: 0,
          avgListenSeconds: 0,
          durationSeconds: avg((t) => durationSeconds(t.duration)),
          repeats: 0,
          likes: avg((t) => t.stats?.likes ?? 0),
          comments: avg((t) => t.stats?.comments ?? 0),
          shares: avg((t) => t.stats?.shares ?? 0),
          saves: avg((t) => t.stats?.saves ?? 0),
          uses: avg((t) => t.stats?.uses ?? 0),
          upvotes: 0,
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
  connectionIds: [],
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
  options: { enabled?: boolean; ready?: boolean; tags?: Map<string, SlangTag> } = {},
) {
  const enabled = options.enabled ?? true;
  // Der Kontext wird erst geholt, wenn der Nutzerzustand vollstaendig geladen
  // ist – sonst laeuft der erste Aufruf mit leerem Interessen-/Follow-Stand
  // und wird danach ein zweites Mal wiederholt.
  const ready = options.ready ?? true;
  const loadContext = useServerFn(getFeedContext);
  // Der zuletzt geladene Kontext liegt in der Sitzung bereit. Dadurch steht die
  // Personalisierung bereits beim ERSTEN Rendern zur Verfuegung (Feed erneut
  // oeffnen, Globe -> Feed, Arena -> Feed) und die sichtbare Reihenfolge muss
  // nicht nachtraeglich korrigiert werden.
  const [ctx, setCtx] = useState<FeedViewerContext | null>(() => cachedContext());
  const requested = useRef(false);

  useEffect(() => {
    if (!enabled || !ready || requested.current) return;
    requested.current = true;
    let alive = true;
    void loadContext()
      .then((value) => {
        cacheContext(value as FeedViewerContext);
        if (alive) setCtx(value as FeedViewerContext);
      })
      .catch(() => {
        /* Ranking ist optional – bei Fehlern bleibt die Ausgangsreihenfolge. */
        requested.current = false;
      });
    return () => {
      alive = false;
    };
  }, [enabled, ready, loadContext]);

  // Session-Variation und bereits oben gesehene Beiträge werden einmal pro
  // Sitzung ermittelt (kein neues Tracking, nur sessionStorage).
  const variation = useRef<{ seed: string; seen: string[] } | null>(null);
  if (variation.current === null && typeof window !== "undefined") {
    variation.current = { seed: sessionSeed(), seen: recentTopIds() };
  }

  /**
   * Die Reihenfolge wird ausschliesslich neu berechnet, wenn sich die MENGE
   * der Beitraege aendert (neue oder entfernte Beitraege) – nicht, wenn sich
   * nur Zahlen eines Beitrags aendern (Aufrufe, Likes, Kommentare). Vorher
   * loeste jede gezaehlte Ansicht waehrend des Scrollens eine komplette
   * Neusortierung aus: bereits sichtbare Karten wechselten ihre Position und
   * der Feed sprang um einige Karten.
   */
  const idsKey = useMemo(() => posts.map((p) => p.id).join(","), [posts]);
  const rankedIds = useMemo(() => {
    if (!enabled || !ctx || posts.length === 0) return null;
    const rankable = posts.map((post) => toRankablePost(post, options.tags));
    const richCtx: FeedViewerContext = {
      ...(ctx ?? EMPTY_CONTEXT),
      sessionSeed: variation.current?.seed,
      recentlySeenIds: variation.current?.seen,
    };
    return rankPosts(rankable, richCtx).map((p) => p.id);
    // Bewusst nur `idsKey`: Statistik-Aktualisierungen sollen den bereits
    // gezeigten Feed nicht umsortieren.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ctx, idsKey, options.tags]);

  /**
   * Bereits ANGEZEIGTE Reihenfolge bleibt fest.
   *
   * Alles, was schon einmal ausgegeben wurde, behaelt seine Position; nur
   * Beitraege, die neu hinzukommen (Nachladen, neue Beitraege), werden nach
   * dem Algorithmus hinten angehaengt. So kann weder ein spaet eintreffender
   * Nutzerkontext noch das Nachladen einer weiteren Seite den sichtbaren Feed
   * umsortieren (Layout Shift).
   */
  const shownOrder = useRef<string[]>([]);

  const result = useMemo(() => {
    const byId = new Map(posts.map((p) => [p.id, p]));
    let base: Post[] = posts;
    if (rankedIds) {
      const order = rankedIds.map((id) => byId.get(id)).filter((p): p is Post => !!p);
      const known = new Set(rankedIds);
      base =
        order.length === posts.length
          ? order
          : [...order, ...posts.filter((p) => !known.has(p.id))];
    }
    const locked = shownOrder.current;
    if (locked.length === 0) return base;
    const head = locked.map((id) => byId.get(id)).filter((p): p is Post => !!p);
    if (head.length === 0) return base;
    const seen = new Set(head.map((p) => p.id));
    const tail = base.filter((p) => !seen.has(p.id));
    return tail.length === 0 ? head : [...head, ...tail];
  }, [rankedIds, posts]);

  useEffect(() => {
    shownOrder.current = result.map((p) => p.id);
  }, [result]);

  // Merken, welche Beiträge oben standen – beim nächsten Aufruf werden sie
  // leicht nach hinten gewichtet, damit nicht immer dasselbe zuerst kommt.
  useEffect(() => {
    if (rankedIds && rankedIds.length > 0) rememberTopIds(rankedIds);
  }, [rankedIds]);

  return result;
}

/**
 * Signal-Sammler: bündelt Ereignisse und schickt sie verzögert ab.
 * Fehler werden bewusst verschluckt, der Feed darf davon nie abhängen.
 */
export function useFeedSignals() {
  return { track: trackFeedSignal, flush: flushFeedSignals };
}
