/**
 * Community-Voting für SlangTag-Audioversionen.
 *
 * Jede Audioversion (= ein `slang_tags`-Datensatz) kann dauerhaft mit 👍/👎
 * bewertet werden. Ein Vote pro Nutzer und Version, änderbar, eigene Versionen
 * sind gesperrt. Die beste Version einer Namensgruppe wird zur Standard-
 * Aussprache und erhält das Badge „Community Pick".
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cachedClientRead, invalidateClientCache, idsKey } from "@/lib/client-cache";
import type { SlangTag } from "@/lib/types";

/** Schwellen für das „Community Pick"-Badge. */
export const COMMUNITY_PICK_MIN_UP = 10;
export const COMMUNITY_PICK_MIN_RATIO = 0.7;
export const COMMUNITY_PICK_MIN_PLAYS = 50;

export type VoteStats = { up: number; down: number };

export type VoteMap = Record<string, VoteStats>;
export type MyVoteMap = Record<string, 1 | -1>;

export const emptyStats: VoteStats = { up: 0, down: 0 };

export function voteScore(s: VoteStats) {
  return s.up - s.down;
}

export function voteRatio(s: VoteStats) {
  const total = s.up + s.down;
  return total === 0 ? 0 : s.up / total;
}

/** Erfüllt eine Version alle Voraussetzungen für das Community Pick-Badge? */
export function qualifiesAsCommunityPick(tag: SlangTag, s: VoteStats) {
  return (
    s.up >= COMMUNITY_PICK_MIN_UP &&
    voteRatio(s) >= COMMUNITY_PICK_MIN_RATIO &&
    tag.stats.plays >= COMMUNITY_PICK_MIN_PLAYS
  );
}

export type SlangTagGroup = {
  /** Kleingeschriebener Name als Gruppenschlüssel. */
  key: string;
  name: string;
  /** Beste Version (höchster Score) – Standard-Aussprache. */
  primary: SlangTag;
  /** Alle weiteren Audio-Varianten, nach Score sortiert. */
  variants: SlangTag[];
  /** Hat die primäre Version das Community Pick-Badge? */
  pick: boolean;
  totalPlays: number;
  totalVariants: number;
};

/** Gruppiert Community-Tags nach Name und sortiert Varianten nach Community-Score. */
export function groupCommunityTags(tags: SlangTag[], votes: VoteMap): SlangTagGroup[] {
  const groups = new Map<string, SlangTag[]>();
  for (const tag of tags) {
    if (tag.kind !== "community") continue;
    const key = tag.name.toLowerCase();
    const list = groups.get(key);
    if (list) list.push(tag);
    else groups.set(key, [tag]);
  }

  const result: SlangTagGroup[] = [];
  for (const [key, list] of groups) {
    const sorted = [...list].sort((a, b) => {
      const diff = voteScore(votes[b.id] ?? emptyStats) - voteScore(votes[a.id] ?? emptyStats);
      return diff !== 0 ? diff : b.stats.plays - a.stats.plays;
    });
    const primary = sorted[0]!;
    result.push({
      key,
      name: primary.name,
      primary,
      variants: sorted.slice(1),
      pick: qualifiesAsCommunityPick(primary, votes[primary.id] ?? emptyStats),
      totalPlays: list.reduce((sum, t) => sum + t.stats.plays, 0),
      totalVariants: list.length,
    });
  }

  return result.sort((a, b) => {
    const scoreDiff =
      voteScore(votes[b.primary.id] ?? emptyStats) - voteScore(votes[a.primary.id] ?? emptyStats);
    return scoreDiff !== 0 ? scoreDiff : b.totalPlays - a.totalPlays;
  });
}

/** Lädt Vote-Zähler und eigene Votes und aktualisiert sie nach jeder Bewertung. */
export function useSlangTagVotes(tagIds: string[], userId: string | null) {
  const idKey = useMemo(() => [...tagIds].sort().join(","), [tagIds]);
  const [votes, setVotes] = useState<VoteMap>({});
  const [myVotes, setMyVotes] = useState<MyVoteMap>({});

  const load = useCallback(async () => {
    const ids = idKey ? idKey.split(",") : [];
    if (ids.length === 0) {
      setVotes({});
      setMyVotes({});
      return;
    }

    const [stats, mine] = await Promise.all([
      // Öffentliche Zähler (nicht nutzerspezifisch) → kurz gecacht.
      cachedClientRead(
        `slang:votes:${idsKey(ids)}`,
        async () => {
          const { data } = await supabase.rpc("slang_tag_vote_stats", { _tag_ids: ids });
          return data ?? [];
        },
        30,
      ),
      userId
        ? supabase.from("slang_tag_votes").select("tag_id, value").eq("user_id", userId)
        : Promise.resolve({ data: [] as { tag_id: string; value: number }[] }),
    ]);

    const next: VoteMap = {};
    for (const row of stats) {
      next[row.tag_id] = { up: row.up_count ?? 0, down: row.down_count ?? 0 };
    }
    setVotes(next);

    const own: MyVoteMap = {};
    for (const row of mine.data ?? []) {
      if (ids.includes(row.tag_id)) own[row.tag_id] = row.value === 1 ? 1 : -1;
    }
    setMyVotes(own);
  }, [idKey, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Bewertet eine Version; erneutes Tippen auf denselben Wert entfernt den Vote. */
  const castVote = useCallback(
    async (tagId: string, value: 1 | -1) => {
      if (!userId) return;
      const current = myVotes[tagId];
      if (current === value) {
        await supabase.from("slang_tag_votes").delete().eq("tag_id", tagId).eq("user_id", userId);
      } else {
        await supabase
          .from("slang_tag_votes")
          .upsert({ tag_id: tagId, user_id: userId, value } as never, {
            onConflict: "tag_id,user_id",
          });
      }
      await load();
    },
    [userId, myVotes, load],
  );

  return { votes, myVotes, castVote, reload: load };
}
