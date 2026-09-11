import { describe, expect, it } from "vitest";

import {
  cityFromLocation,
  isTabKey,
  normalizeTab,
  normChannel,
  selectFeedPosts,
  sortByTrending,
} from "@/lib/feed-tabs";
import type { Post } from "@/lib/types";

function post(over: Partial<Post> & { id: string }): Post {
  return {
    id: over.id,
    userId: over.userId ?? "u1",
    author: {
      id: over.userId ?? "u1",
      username: "tester",
      displayName: "Tester",
      avatar: null,
      verified: false,
    } as Post["author"],
    title: "",
    description: "",
    region: over.region ?? "Berlin",
    hashtags: over.hashtags ?? [],
    channelId: over.channelId ?? null,
    image: null,
    audio: null,
    duration: "0:01",
    placements: [],
    slangTagIds: [],
    visibility: "public" as Post["visibility"],
    stats: over.stats ?? { likes: 0, comments: 0, shares: 0, views: 0, saves: 0 },
    createdAt: over.createdAt ?? 0,
  } as Post;
}

const emptyCtx = { following: [], hashtags: [], channelIds: [] };

describe("feed-tabs", () => {
  it("erkennt gültige Reiter", () => {
    expect(isTabKey("feed")).toBe(true);
    expect(isTabKey("global")).toBe(false);
    expect(normalizeTab("global")).toBe("feed");
    expect(normalizeTab("local")).toBe("feed");
    expect(normalizeTab("channels")).toBe("channels");
    expect(normalizeTab("trending")).toBe("feed");
  });

  it("normalisiert Kanalnamen", () => {
    expect(normChannel("#Berlin")).toBe("berlin");
    expect(cityFromLocation("Berlin, DE")).toBe("berlin");
    expect(cityFromLocation(null)).toBe("");
  });

  it("sortiert Trending nach Interaktionen und verändert die Eingabe nicht", () => {
    const a = post({ id: "a", stats: { likes: 1, comments: 0, shares: 0, views: 0, saves: 0 } });
    const b = post({ id: "b", stats: { likes: 5, comments: 2, shares: 1, views: 0, saves: 0 } });
    const input = [a, b];
    expect(sortByTrending(input).map((p) => p.id)).toEqual(["b", "a"]);
    expect(input.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("folge ich: ausschließlich Beiträge gefolgter Accounts", () => {
    const posts = [
      post({ id: "a", userId: "friend" }),
      post({ id: "b", userId: "stranger" }),
      post({ id: "c", userId: "me" }),
      post({ id: "d", userId: "friend", channelId: "ch1" }),
    ];
    expect(
      selectFeedPosts(posts, "following", { ...emptyCtx, following: ["friend"], meId: "me" }).map(
        (p) => p.id,
      ),
    ).toEqual(["a"]);
  });

  it("channels: ohne Follows leer, sonst ausschließlich Channel-Beiträge", () => {
    const posts = [
      post({ id: "a", channelId: "ch1" }),
      post({ id: "b", hashtags: ["#Slang"] }),
      post({ id: "c" }),
    ];
    expect(selectFeedPosts(posts, "channels", emptyCtx)).toEqual([]);
    expect(
      selectFeedPosts(posts, "channels", {
        ...emptyCtx,
        channelIds: ["ch1"],
        hashtags: ["slang"],
      }).map((p) => p.id),
    ).toEqual(["a"]);
  });

  it("gemeinsamer Feed: Trending-Sortierung als Basis", () => {
    const posts = [
      post({ id: "a", stats: { likes: 0, comments: 0, shares: 0, views: 0, saves: 0 } }),
      post({ id: "b", stats: { likes: 3, comments: 0, shares: 0, views: 0, saves: 0 } }),
    ];
    expect(selectFeedPosts(posts, "feed", emptyCtx).map((p) => p.id)).toEqual(["b", "a"]);
  });
});
