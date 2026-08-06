/**
 * SlangTag Arena – Community-Wettbewerbe für Werbe-SlangTags.
 *
 * Unternehmen schreiben Challenges aus, Creator reichen eigene SlangTags ein
 * und die Community entscheidet über Votes, Likes, Wiedergaben und Kommentare.
 * Alle Schreibzugriffe laufen über die Datenbank-Regeln (RLS) – hier liegt nur
 * die Lade- und Ranglogik.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ArenaStatus = "draft" | "active" | "judging" | "closed";

export type ArenaChallenge = {
  id: string;
  companyId: string;
  companyName: string;
  logoUrl: string | null;
  title: string;
  description: string;
  category: string;
  targetAudience: string;
  terms: string;
  region: string;
  prize: string;
  status: ArenaStatus;
  startsAt: number;
  endsAt: number | null;
};

export type ArenaSubmission = {
  id: string;
  challengeId: string;
  creatorId: string;
  tagId: string;
  pitch: string;
  votes: number;
  likes: number;
  plays: number;
  comments: number;
  createdAt: number;
};

export type ArenaAward = {
  id: string;
  challengeId: string;
  submissionId: string;
  place: number;
  licensed: boolean;
  note: string;
};

export type ArenaComment = {
  id: string;
  submissionId: string;
  userId: string;
  body: string;
  createdAt: number;
};

export type CreateChallengeInput = {
  title: string;
  companyName: string;
  description: string;
  category: string;
  targetAudience: string;
  terms: string;
  region: string;
  prize: string;
  endsAt: string | null;
};

/** Gewichtung des Live-Rankings: Votes zählen am stärksten. */
export const SCORE_WEIGHTS = { votes: 4, likes: 2, comments: 1.5, plays: 0.5 };

export function arenaScore(s: ArenaSubmission): number {
  return Math.round(
    s.votes * SCORE_WEIGHTS.votes +
      s.likes * SCORE_WEIGHTS.likes +
      s.comments * SCORE_WEIGHTS.comments +
      s.plays * SCORE_WEIGHTS.plays,
  );
}

/** Abschlussquote: Anteil der Wiedergaben, die zu Engagement geführt haben. */
export function completionRate(s: ArenaSubmission): number {
  if (s.plays === 0) return 0;
  return Math.min(1, (s.votes + s.likes + s.comments) / s.plays);
}

/** Absteigend nach Score, bei Gleichstand nach Votes und Alter. */
export function rankSubmissions(subs: ArenaSubmission[]): ArenaSubmission[] {
  return [...subs].sort((a, b) => {
    const diff = arenaScore(b) - arenaScore(a);
    if (diff !== 0) return diff;
    if (b.votes !== a.votes) return b.votes - a.votes;
    return a.createdAt - b.createdAt;
  });
}

/** Läuft die Challenge noch? */
export function isRunning(c: ArenaChallenge): boolean {
  return c.status === "active" && (c.endsAt === null || c.endsAt > Date.now());
}

export const MEDALS = ["🥇", "🥈", "🥉"];

export type CreatorStats = {
  creatorId: string;
  submissions: number;
  votes: number;
  likes: number;
  plays: number;
  comments: number;
  score: number;
  wins: number;
  licensed: number;
};

/** Aggregiert alle Arena-Kennzahlen je Creator (Basis der Creator-Liga). */
export function creatorStats(subs: ArenaSubmission[], awards: ArenaAward[]): CreatorStats[] {
  const byId = new Map<string, CreatorStats>();
  const submissionCreator = new Map(subs.map((s) => [s.id, s.creatorId]));

  for (const s of subs) {
    const entry = byId.get(s.creatorId) ?? {
      creatorId: s.creatorId,
      submissions: 0,
      votes: 0,
      likes: 0,
      plays: 0,
      comments: 0,
      score: 0,
      wins: 0,
      licensed: 0,
    };
    entry.submissions += 1;
    entry.votes += s.votes;
    entry.likes += s.likes;
    entry.plays += s.plays;
    entry.comments += s.comments;
    entry.score += arenaScore(s);
    byId.set(s.creatorId, entry);
  }

  for (const a of awards) {
    const creatorId = submissionCreator.get(a.submissionId);
    if (!creatorId) continue;
    const entry = byId.get(creatorId);
    if (!entry) continue;
    if (a.place === 1) entry.wins += 1;
    if (a.licensed) entry.licensed += 1;
  }

  return [...byId.values()].sort((a, b) => b.score - a.score);
}

type Row = Record<string, unknown>;

const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const num = (v: unknown) => (typeof v === "number" ? v : 0);
const time = (v: unknown) => (typeof v === "string" ? new Date(v).getTime() : 0);

function mapChallenge(r: Row): ArenaChallenge {
  return {
    id: str(r["id"]),
    companyId: str(r["company_id"]),
    companyName: str(r["company_name"]),
    logoUrl: typeof r["logo_url"] === "string" ? r["logo_url"] : null,
    title: str(r["title"]),
    description: str(r["description"]),
    category: str(r["category"]),
    targetAudience: str(r["target_audience"]),
    terms: str(r["terms"]),
    region: str(r["region"]),
    prize: str(r["prize"]),
    status: str(r["status"], "active") as ArenaStatus,
    startsAt: time(r["starts_at"]),
    endsAt: typeof r["ends_at"] === "string" ? new Date(r["ends_at"]).getTime() : null,
  };
}

function mapSubmission(r: Row): ArenaSubmission {
  return {
    id: str(r["id"]),
    challengeId: str(r["challenge_id"]),
    creatorId: str(r["creator_id"]),
    tagId: str(r["tag_id"]),
    pitch: str(r["pitch"]),
    votes: num(r["votes_count"]),
    likes: num(r["likes_count"]),
    plays: num(r["plays_count"]),
    comments: num(r["comments_count"]),
    createdAt: time(r["created_at"]),
  };
}

/** Lädt alle Arena-Daten und liefert die Community-Aktionen. */
export function useArena(userId: string | null) {
  const [loading, setLoading] = useState(true);
  const [challenges, setChallenges] = useState<ArenaChallenge[]>([]);
  const [submissions, setSubmissions] = useState<ArenaSubmission[]>([]);
  const [awards, setAwards] = useState<ArenaAward[]>([]);
  const [myVotes, setMyVotes] = useState<string[]>([]);
  const [myLikes, setMyLikes] = useState<string[]>([]);
  const [commentsBySubmission, setComments] = useState<Record<string, ArenaComment[]>>({});

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const [ch, sub, aw, votes, likes] = await Promise.all([
      supabase.from("arena_challenges").select("*").order("created_at", { ascending: false }),
      supabase.from("arena_submissions").select("*").order("created_at", { ascending: false }),
      supabase.from("arena_awards").select("*"),
      supabase.from("arena_votes").select("submission_id").eq("user_id", userId),
      supabase.from("arena_likes").select("submission_id").eq("user_id", userId),
    ]);

    setChallenges(((ch.data ?? []) as Row[]).map(mapChallenge));
    setSubmissions(((sub.data ?? []) as Row[]).map(mapSubmission));
    setAwards(
      ((aw.data ?? []) as Row[]).map((r) => ({
        id: str(r["id"]),
        challengeId: str(r["challenge_id"]),
        submissionId: str(r["submission_id"]),
        place: num(r["place"]),
        licensed: r["licensed"] === true,
        note: str(r["note"]),
      })),
    );
    setMyVotes(((votes.data ?? []) as Row[]).map((r) => str(r["submission_id"])));
    setMyLikes(((likes.data ?? []) as Row[]).map((r) => str(r["submission_id"])));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Optimistischer Zähler-Update für flüssige Interaktion. */
  const bump = (id: string, key: "votes" | "likes" | "plays" | "comments", delta: number) => {
    setSubmissions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [key]: Math.max(0, s[key] + delta) } : s)),
    );
  };

  const toggleVote = useCallback(
    async (submissionId: string) => {
      if (!userId) return;
      const active = myVotes.includes(submissionId);
      if (active) {
        setMyVotes((p) => p.filter((id) => id !== submissionId));
        bump(submissionId, "votes", -1);
        await supabase
          .from("arena_votes")
          .delete()
          .eq("submission_id", submissionId)
          .eq("user_id", userId);
      } else {
        setMyVotes((p) => [...p, submissionId]);
        bump(submissionId, "votes", 1);
        await supabase
          .from("arena_votes")
          .insert({ submission_id: submissionId, user_id: userId } as never);
      }
    },
    [userId, myVotes],
  );

  const toggleLike = useCallback(
    async (submissionId: string) => {
      if (!userId) return;
      const active = myLikes.includes(submissionId);
      if (active) {
        setMyLikes((p) => p.filter((id) => id !== submissionId));
        bump(submissionId, "likes", -1);
        await supabase
          .from("arena_likes")
          .delete()
          .eq("submission_id", submissionId)
          .eq("user_id", userId);
      } else {
        setMyLikes((p) => [...p, submissionId]);
        bump(submissionId, "likes", 1);
        await supabase
          .from("arena_likes")
          .insert({ submission_id: submissionId, user_id: userId } as never);
      }
    },
    [userId, myLikes],
  );

  const registerPlay = useCallback(
    async (submissionId: string) => {
      if (!userId) return;
      bump(submissionId, "plays", 1);
      await supabase
        .from("arena_plays")
        .insert({ submission_id: submissionId, user_id: userId } as never);
    },
    [userId],
  );

  const loadComments = useCallback(async (submissionId: string) => {
    const { data } = await supabase
      .from("arena_comments")
      .select("*")
      .eq("submission_id", submissionId)
      .order("created_at", { ascending: true });
    setComments((prev) => ({
      ...prev,
      [submissionId]: ((data ?? []) as Row[]).map((r) => ({
        id: str(r["id"]),
        submissionId: str(r["submission_id"]),
        userId: str(r["user_id"]),
        body: str(r["body"]),
        createdAt: time(r["created_at"]),
      })),
    }));
  }, []);

  const addComment = useCallback(
    async (submissionId: string, body: string, slangTagIds: string[] = []) => {
      if (!userId || !body.trim()) return false;
      const { error } = await supabase.from("arena_comments").insert({
        submission_id: submissionId,
        user_id: userId,
        body: body.trim(),
        slang_tag_ids: slangTagIds,
      } as never);
      if (error) return false;
      bump(submissionId, "comments", 1);
      await loadComments(submissionId);
      return true;
    },
    [userId, loadComments],
  );

  const createChallenge = useCallback(
    async (input: CreateChallengeInput) => {
      if (!userId) return false;
      const { error } = await supabase.from("arena_challenges").insert({
        company_id: userId,
        company_name: input.companyName,
        title: input.title,
        description: input.description,
        category: input.category,
        target_audience: input.targetAudience,
        terms: input.terms,
        region: input.region,
        prize: input.prize,
        ends_at: input.endsAt,
        status: "active",
      } as never);
      if (error) return false;
      await load();
      return true;
    },
    [userId, load],
  );

  const submitTag = useCallback(
    async (challengeId: string, tagId: string, pitch: string) => {
      if (!userId) return false;
      const { error } = await supabase.from("arena_submissions").insert({
        challenge_id: challengeId,
        creator_id: userId,
        tag_id: tagId,
        pitch,
      } as never);
      if (error) return false;
      await load();
      return true;
    },
    [userId, load],
  );

  const removeSubmission = useCallback(async (submissionId: string) => {
    const { error } = await supabase.from("arena_submissions").delete().eq("id", submissionId);
    if (error) return false;
    setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
    return true;
  }, []);

  const setAward = useCallback(
    async (challengeId: string, submissionId: string, place: number, licensed: boolean) => {
      const { error } = await supabase
        .from("arena_awards")
        .upsert(
          { challenge_id: challengeId, submission_id: submissionId, place, licensed } as never,
          { onConflict: "challenge_id,submission_id" },
        );
      if (error) return false;
      await load();
      return true;
    },
    [load],
  );

  const closeChallenge = useCallback(
    async (challengeId: string, status: ArenaStatus) => {
      const { error } = await supabase
        .from("arena_challenges")
        .update({ status } as never)
        .eq("id", challengeId);
      if (error) return false;
      await load();
      return true;
    },
    [load],
  );

  const submissionsByChallenge = useMemo(() => {
    const map: Record<string, ArenaSubmission[]> = {};
    for (const s of submissions) (map[s.challengeId] ??= []).push(s);
    return map;
  }, [submissions]);

  return {
    loading,
    challenges,
    submissions,
    submissionsByChallenge,
    awards,
    myVotes,
    myLikes,
    commentsBySubmission,
    reload: load,
    toggleVote,
    toggleLike,
    registerPlay,
    loadComments,
    addComment,
    createChallenge,
    submitTag,
    removeSubmission,
    setAward,
    closeChallenge,
  };
}
