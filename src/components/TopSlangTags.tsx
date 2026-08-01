import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Building2,
  ChevronDown,
  Heart,
  MousePointerClick,
  Play,
  Share2,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  TrendingUp,
  Users,
  BadgeCheck,
  Building2 as BuildingIcon,
} from "lucide-react";
import { CompanySlangTagCard } from "@/components/CompanySlangTagCard";
import { supabase } from "@/integrations/supabase/client";
import { SlangTagChip } from "@/components/SlangTagChip";
import { useData } from "@/lib/data";
import { formatStat, type SlangTag } from "@/lib/types";
import {
  COMMUNITY_PICK_MIN_PLAYS,
  COMMUNITY_PICK_MIN_RATIO,
  COMMUNITY_PICK_MIN_UP,
  emptyStats,
  groupCommunityTags,
  useSlangTagVotes,
  voteScore,
  type MyVoteMap,
  type VoteMap,
} from "@/lib/slangtag-votes";

/** „Top Slang" mit getrennten Bereichen für Community und Firmen/Creator. */
export function TopSlangTags() {
  const { tags, user, loading } = useData();
  const [tab, setTab] = useState<"community" | "creator" | "company">("community");

  const communityTags = useMemo(() => tags.filter((t) => t.kind === "community"), [tags]);
  const creatorTags = useMemo(
    () =>
      tags
        .filter((t) => t.kind === "creator" && t.ownerType !== "company")
        .sort((a, b) => b.stats.plays - a.stats.plays)
        .slice(0, 8),
    [tags],
  );
  const companyTags = useMemo(
    () =>
      tags
        .filter((t) => t.ownerType === "company")
        .sort((a, b) => Number(b.sponsored) - Number(a.sponsored) || b.stats.plays - a.stats.plays)
        .slice(0, 8),
    [tags],
  );
  const followerCounts = useFollowerCounts(creatorTags.map((t) => t.ownerId));

  const communityIds = useMemo(() => communityTags.map((t) => t.id), [communityTags]);
  const { votes, myVotes, castVote } = useSlangTagVotes(communityIds, user?.id ?? null);
  const groups = useMemo(() => groupCommunityTags(communityTags, votes), [communityTags, votes]);

  const tabCls = (active: boolean, accent: "green" | "blue") =>
    `inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition-colors ${
      active
        ? accent === "green"
          ? "border-brand bg-brand/15 text-brand shadow-glow"
          : "border-brand-cyan bg-brand-cyan/15 text-brand-cyan"
        : "border-border bg-surface text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="px-6 py-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold">
          <span className="text-gradient-green">Top Slang</span>
        </h2>
        <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
          Die Community bestimmt die Standard-Aussprache{" "}
          <TrendingUp className="h-4 w-4 text-brand" />
        </p>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => setTab("community")}
          className={tabCls(tab === "community", "green")}
        >
          <span className="h-2 w-2 rounded-full bg-brand" /> Community
        </button>
        <button
          type="button"
          onClick={() => setTab("creator")}
          className={tabCls(tab === "creator", "blue")}
        >
          <span className="h-2 w-2 rounded-full bg-brand-cyan" /> Creator
        </button>
        <button
          type="button"
          onClick={() => setTab("company")}
          className={tabCls(tab === "company", "blue")}
        >
          <BuildingIcon className="h-3 w-3" /> Unternehmen
        </button>
      </div>

      {tab === "community" ? (
        <>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Community Pick ab {COMMUNITY_PICK_MIN_UP} positiven Stimmen,{" "}
            {Math.round(COMMUNITY_PICK_MIN_RATIO * 100)} % Zustimmung und {COMMUNITY_PICK_MIN_PLAYS}{" "}
            Wiedergaben.
          </p>
          {groups.length === 0 ? (
            <Empty>
              {loading ? "SlangTags werden geladen…" : "Noch keine Community-SlangTags."}
            </Empty>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {groups.slice(0, 9).map((group) => (
                <CommunityGroupCard
                  key={group.key}
                  group={group}
                  votes={votes}
                  myVotes={myVotes}
                  onVote={castVote}
                  myId={user?.id ?? null}
                />
              ))}
            </div>
          )}
        </>
      ) : tab === "creator" ? (
        creatorTags.length === 0 ? (
          <Empty>Noch keine offiziellen Creator-SlangTags.</Empty>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {creatorTags.map((tag) => (
              <CreatorTagCard
                key={tag.id}
                tag={tag}
                followers={followerCounts[tag.ownerId] ?? 0}
              />
            ))}
          </div>
        )
      ) : companyTags.length === 0 ? (
        <Empty>Noch keine Unternehmens-SlangTags.</Empty>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {companyTags.map((tag) => (
            <CompanySlangTagCard key={tag.id} tag={tag} />
          ))}
        </div>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-6 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function CommunityGroupCard({
  group,
  votes,
  myVotes,
  onVote,
  myId,
}: {
  group: ReturnType<typeof groupCommunityTags>[number];
  votes: VoteMap;
  myVotes: MyVoteMap;
  onVote: (tagId: string, value: 1 | -1) => Promise<void>;
  myId: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-w-0 rounded-xl border border-brand/25 bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-black text-brand">${group.name}</span>
        {group.pick ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-brand/50 bg-brand/15 px-2 py-0.5 text-[10px] font-bold text-brand">
            <Trophy className="h-3 w-3" /> Community Pick
          </span>
        ) : (
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {group.totalVariants} {group.totalVariants === 1 ? "Version" : "Versionen"}
          </span>
        )}
      </div>

      <div className="mt-2">
        <VariantRow
          tag={group.primary}
          votes={votes}
          myVotes={myVotes}
          onVote={onVote}
          myId={myId}
        />
      </div>

      {group.variants.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
            Weitere Varianten ({group.variants.length})
          </button>
          {open && (
            <div className="mt-2 space-y-2 border-t border-border pt-2">
              {group.variants.map((tag) => (
                <VariantRow
                  key={tag.id}
                  tag={tag}
                  votes={votes}
                  myVotes={myVotes}
                  onVote={onVote}
                  myId={myId}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function VariantRow({
  tag,
  votes,
  myVotes,
  onVote,
  myId,
}: {
  tag: SlangTag;
  votes: VoteMap;
  myVotes: MyVoteMap;
  onVote: (tagId: string, value: 1 | -1) => Promise<void>;
  myId: string | null;
}) {
  const navigate = useNavigate();
  const stats = votes[tag.id] ?? emptyStats;
  const mine = myVotes[tag.id];
  const own = myId !== null && (tag.ownerId === myId || tag.creatorId === myId);

  const btn = (active: boolean, positive: boolean) =>
    `inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold transition-colors ${
      own
        ? "cursor-not-allowed border-border text-muted-foreground opacity-50"
        : active
          ? positive
            ? "border-brand bg-brand/20 text-brand"
            : "border-destructive bg-destructive/15 text-destructive"
          : "border-border text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="min-w-0">
      <SlangTagChip
        tag={tag}
        variant="compact"
        showStats={false}
        onOpen={() => navigate({ to: "/slangtag/$name", params: { name: tag.name } })}
      />
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={own || !myId}
          onClick={() => void onVote(tag.id, 1)}
          aria-label="Positiv bewerten"
          className={btn(mine === 1, true)}
        >
          <ThumbsUp className="h-3 w-3" /> {stats.up}
        </button>
        <button
          type="button"
          disabled={own || !myId}
          onClick={() => void onVote(tag.id, -1)}
          aria-label="Negativ bewerten"
          className={btn(mine === -1, false)}
        >
          <ThumbsDown className="h-3 w-3" /> {stats.down}
        </button>
        <span className="text-[10px] text-muted-foreground">
          Score {voteScore(stats)} · <Play className="inline h-2.5 w-2.5" />{" "}
          {formatStat(tag.stats.plays)} · @{tag.creator}
        </span>
        {own && <span className="text-[10px] text-muted-foreground">Eigene Version</span>}
      </div>
    </div>
  );
}

/** Follower-Zahlen der Creator (Statistik ohne Voting-Bezug). */
function useFollowerCounts(ownerIds: string[]) {
  const key = useMemo(() => [...new Set(ownerIds)].sort().join(","), [ownerIds]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const ids = key ? key.split(",") : [];
    if (ids.length === 0) {
      setCounts({});
      return;
    }
    let active = true;
    void supabase
      .from("follows")
      .select("following_id")
      .in("following_id", ids)
      .then(({ data }) => {
        if (!active) return;
        const next: Record<string, number> = {};
        for (const row of data ?? []) {
          const id = row.following_id as string;
          next[id] = (next[id] ?? 0) + 1;
        }
        setCounts(next);
      });
    return () => {
      active = false;
    };
  }, [key]);

  return counts;
}

/** Creator-SlangTag: blaues Badge, keine Votes, keine Sponsor-Kennzeichnung. */
function CreatorTagCard({ tag, followers }: { tag: SlangTag; followers: number }) {
  const navigate = useNavigate();

  return (
    <div className="min-w-0 rounded-xl border border-brand-cyan/30 bg-surface p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full border border-brand-cyan/50 bg-brand-cyan/15 px-2 py-0.5 text-[10px] font-bold text-brand-cyan">
          <Star className="h-3 w-3" /> Creator
        </span>
        {tag.verificationStatus === "verified" && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            <BadgeCheck className="h-3 w-3 text-brand-cyan" /> Verifiziert
          </span>
        )}
      </div>

      <div className="mt-2">
        <SlangTagChip
          tag={tag}
          variant="compact"
          showStats={false}
          onOpen={() => navigate({ to: "/slangtag/$name", params: { name: tag.name } })}
        />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Play className="h-2.5 w-2.5" /> {formatStat(tag.stats.plays)} Wiedergaben
        </span>
        <span className="inline-flex items-center gap-1">
          <Heart className="h-2.5 w-2.5" /> {formatStat(tag.stats.likes)} Likes
        </span>
        <span className="inline-flex items-center gap-1">
          <Share2 className="h-2.5 w-2.5" /> {formatStat(tag.stats.shares)} Shares
        </span>
        <span className="inline-flex items-center gap-1">
          <Users className="h-2.5 w-2.5" /> {formatStat(followers)} Follower
        </span>
      </div>
    </div>
  );
}
