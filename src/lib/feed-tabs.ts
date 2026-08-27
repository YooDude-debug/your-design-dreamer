/**
 * Feed-Reiter: reine Auswahl-Logik (ohne React, ohne Datenzugriff).
 *
 * Diese Datei enthält ausschließlich die Frage „welche Beiträge gehören in
 * welchen Reiter?“. Sie wurde aus `src/routes/_authenticated/dev.tsx`
 * herausgelöst, damit die Regeln testbar sind und die Route-Datei nur noch
 * Darstellung und Zustand enthält. Das Verhalten ist unverändert.
 */

import type { Post } from "@/lib/types";

export const FEED_TABS = ["local", "global", "following", "channels"] as const;

export type TabKey = (typeof FEED_TABS)[number];

export function isTabKey(value: unknown): value is TabKey {
  return typeof value === "string" && (FEED_TABS as readonly string[]).includes(value);
}

/**
 * Trending-Logik (unverändert): rein nach Interaktionen sortiert. Es gibt
 * keinen eigenen Tab mehr – die Reihenfolge fließt in den Global-Feed ein,
 * bevor der personalisierte Algorithmus greift.
 */
export function sortByTrending(list: Post[]): Post[] {
  return [...list].sort(
    (a, b) =>
      b.stats.likes +
      b.stats.comments +
      b.stats.shares -
      (a.stats.likes + a.stats.comments + a.stats.shares),
  );
}

/** Kanalnamen einheitlich vergleichbar machen (# und Groß-/Kleinschreibung). */
export function normChannel(tag: string): string {
  return tag.replace(/^#/, "").toLowerCase();
}

/** Stadt aus einer Standortangabe („Berlin, DE“ → „berlin“). */
export function cityFromLocation(location: string | null | undefined): string {
  return (location ?? "").split(",")[0].trim().toLowerCase();
}

export type FeedTabContext = {
  /** Standort des angemeldeten Nutzers (Rohwert aus dem Profil). */
  location?: string | null;
  /** Eigene Nutzer-ID – eigene Beiträge bleiben im „Folge ich“-Reiter sichtbar. */
  meId?: string | null;
  /** Gefolgte Nutzer (Follow-Relation aus dem Bootstrap). */
  following: readonly string[];
  /** Gefolgte Themen-Hashtags. */
  hashtags: readonly string[];
  /** Gefolgte echte Channels (IDs aus `channel_follows`). */
  channelIds: readonly string[];
};

/**
 * Alle Reiter nutzen dieselbe Datenbasis – nur die Filter unterscheiden sich.
 * Eigene Beiträge erscheinen wie gewohnt im eigenen Feed; die Filterlogik für
 * fremde Beiträge bleibt unverändert.
 */
export function selectFeedPosts(posts: Post[], active: TabKey, ctx: FeedTabContext): Post[] {
  switch (active) {
    case "local": {
      const city = cityFromLocation(ctx.location);
      return city ? posts.filter((p) => p.region.toLowerCase().includes(city)) : [];
    }
    case "channels": {
      // Beiträge der gefolgten Channels (`channel_follows` → `posts.channel_id`)
      // sowie der weiterhin bestehenden gefolgten Themen-Hashtags. Ohne
      // Follows bleibt der Bereich leer – es werden keine Beispieldaten erzeugt.
      const channelSet = new Set(ctx.channelIds);
      const tagSet = new Set(ctx.hashtags.map(normChannel));
      if (channelSet.size === 0 && tagSet.size === 0) return [];
      return posts.filter(
        (p) =>
          (p.channelId ? channelSet.has(p.channelId) : false) ||
          p.hashtags.some((h) => tagSet.has(normChannel(h))),
      );
    }
    case "following": {
      // Ausschließlich Beiträge tatsächlich gefolgter Nutzer (keine zusätzliche
      // Abfrage, keine Like-Heuristik).
      const followed = new Set(ctx.following);
      return posts.filter((p) => followed.has(p.userId) || (ctx.meId && p.userId === ctx.meId));
    }
    default:
      // Global: zentraler überregionaler Feed – Trending-Sortierung als Basis,
      // danach greift der personalisierte Algorithmus.
      return sortByTrending(posts);
  }
}
