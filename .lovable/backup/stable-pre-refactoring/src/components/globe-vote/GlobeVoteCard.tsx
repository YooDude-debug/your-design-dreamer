import { Globe2, MapPin, ThumbsDown, ThumbsUp } from "lucide-react";
import { SlangTagName } from "@/components/SlangTagName";
import { StatusChip } from "@/components/arena/StatusChip";
import { TagPlayButton } from "@/components/arena/MySlangTagsSection";
import { emptyStats, voteScore, type MyVoteMap, type VoteMap } from "@/lib/slangtag-votes";
import { formatStat, type SlangTag } from "@/lib/types";

const OWNER_LABEL: Record<SlangTag["ownerType"], string> = {
  user: "User",
  creator: "Creator",
  company: "Business",
};

/**
 * Globe-Kandidat: ein SlangTag-Name mit allen eingereichten Audio-Varianten.
 * Abgestimmt wird immer auf die konkrete `slang_tag.id`.
 */
export function GlobeVoteCard({
  name,
  variants,
  votes,
  myVotes,
  myId,
  onVote,
  ownerName,
}: {
  name: string;
  variants: SlangTag[];
  votes: VoteMap;
  myVotes: MyVoteMap;
  myId: string | null;
  onVote: (tagId: string, value: 1 | -1) => void;
  ownerName: (tag: SlangTag) => string;
}) {
  const head = variants[0]!;
  return (
    <article className="rounded-2xl border border-border bg-surface/50 p-3">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <SlangTagName tag={head} className="text-sm font-black" />
          <StatusChip label={`${variants.length} Varianten`} />
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[10px] text-muted-foreground">
          {head.language && (
            <span className="inline-flex items-center gap-1">
              <Globe2 className="h-3 w-3" /> {head.language}
            </span>
          )}
          {head.region && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {head.region}
            </span>
          )}
        </div>
      </header>

      <ul className="mt-2 divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60">
        {variants.map((tag, i) => {
          const stats = votes[tag.id] ?? emptyStats;
          const mine = myVotes[tag.id];
          const own = tag.ownerId === myId;
          return (
            <li
              key={tag.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 bg-background/40 px-2.5 py-2"
            >
              <TagPlayButton tag={tag} />
              <div className="min-w-0">
                <p className="truncate text-xs font-bold">
                  Variante {String.fromCharCode(65 + i)}
                  <span className="ml-1.5 font-normal text-muted-foreground">
                    {ownerName(tag)} · {OWNER_LABEL[tag.ownerType]}
                  </span>
                </p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {formatStat(Math.max(0, voteScore(stats)))} Stimmen ·{" "}
                  {formatStat(tag.stats.plays)} Plays
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  disabled={own || !myId}
                  onClick={() => onVote(tag.id, 1)}
                  aria-label="Voten"
                  className={`tap-safe grid h-9 w-9 place-items-center rounded-full border transition-colors disabled:opacity-40 ${
                    mine === 1
                      ? "border-brand bg-brand/15 text-brand"
                      : "border-border text-muted-foreground hover:border-brand/50 hover:text-brand"
                  }`}
                >
                  <ThumbsUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={own || !myId}
                  onClick={() => onVote(tag.id, -1)}
                  aria-label="Ablehnen"
                  className={`tap-safe grid h-9 w-9 place-items-center rounded-full border transition-colors disabled:opacity-40 ${
                    mine === -1
                      ? "border-destructive bg-destructive/15 text-destructive"
                      : "border-border text-muted-foreground hover:border-destructive/50"
                  }`}
                >
                  <ThumbsDown className="h-4 w-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 px-1 text-[10px] text-muted-foreground">
        Du stimmst für die konkrete Audio-Variante, nicht für den Namen ${name}.
      </p>
    </article>
  );
}
