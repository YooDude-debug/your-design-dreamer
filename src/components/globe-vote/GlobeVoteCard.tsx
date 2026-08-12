import { Globe2, MapPin, ThumbsDown, ThumbsUp } from "lucide-react";
import { SlangTagName } from "@/components/SlangTagName";
import { StatusChip } from "@/components/arena/StatusChip";
import { TagPlayButton } from "@/components/arena/MySlangTagsSection";
import { emptyStats, voteScore, type MyVoteMap, type VoteMap } from "@/lib/slangtag-votes";
import { formatStat, type SlangTag } from "@/lib/types";
import { useLang } from "@/lib/lang-context";
import { arenaTexts, type ArenaDict } from "@/lib/i18n-arena";
import { GlobeVoteMeaning } from "@/components/globe-vote/GlobeVoteMeaning";
import { GlobeVoteGeo, type GlobeGeoInput } from "@/components/globe-vote/GlobeVoteGeo";
import { useState } from "react";
import type { SlangDefinition } from "@/lib/slang-definitions";


function ownerLabel(at: ArenaDict, ownerType: SlangTag["ownerType"]): string {
  const map: Record<SlangTag["ownerType"], string> = {
    user: at.ownerUser,
    creator: at.ownerCreator,
    company: at.ownerCompany,
  };
  return map[ownerType];
}

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
  definition,
  onSaveDefinition,
  onSaveGeo,
}: {
  name: string;
  variants: SlangTag[];
  votes: VoteMap;
  myVotes: MyVoteMap;
  myId: string | null;
  onVote: (tagId: string, value: 1 | -1) => void;
  ownerName: (tag: SlangTag) => string;
  /** Bedeutung des SlangTag-Namens (nicht der Variante). */
  definition?: SlangDefinition | null;
  onSaveDefinition?: (meaning: string, example: string) => Promise<void>;
  /** Globe-Standort des SlangTag-Namens – bewusst getrennt vom Audio-Vote. */
  onSaveGeo?: (geo: GlobeGeoInput) => Promise<void>;
}) {
  const { lang } = useLang();
  const at = arenaTexts[lang];
  const head = variants[0]!;
  const canEditMeaning = Boolean(myId) && variants.some((t) => t.ownerId === myId);
  const [infoTab, setInfoTab] = useState<"meaning" | "geo">("meaning");

  return (
    <article className="rounded-2xl border border-border bg-background p-3">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <SlangTagName tag={head} className="text-sm font-black" />
          <StatusChip label={at.variantsCountLabel(variants.length)} />
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

      <section className="mt-2 rounded-xl border border-border/60 bg-background/40 p-2.5">
        <div role="tablist" className="flex items-center gap-1.5">
          {(["meaning", "geo"] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={infoTab === id}
              onClick={() => setInfoTab(id)}
              className={`tap-safe rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition-colors ${
                infoTab === id
                  ? "border-brand/60 bg-brand/10 text-brand"
                  : "border-border text-muted-foreground hover:border-brand/40 hover:text-brand"
              }`}
            >
              {id === "meaning" ? at.tabMeaningLabel : at.tabGeoLabel}
            </button>
          ))}
        </div>

        <div className="mt-2">
          {infoTab === "meaning" ? (
            <GlobeVoteMeaning
              definition={definition ?? null}
              canEdit={canEditMeaning && Boolean(onSaveDefinition)}
              onSave={async (m, ex) => {
                await onSaveDefinition?.(m, ex);
              }}
            />
          ) : (
            <GlobeVoteGeo
              definition={definition ?? null}
              canEdit={canEditMeaning && Boolean(onSaveGeo)}
              fallbackLanguage={head.language || ""}
              onSave={async (geo) => {
                await onSaveGeo?.(geo);
              }}
            />
          )}
        </div>
      </section>



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
                  {at.variantLetter(String.fromCharCode(65 + i))}
                  <span className="ml-1.5 font-normal text-muted-foreground">
                    {ownerName(tag)} · {ownerLabel(at, tag.ownerType)}
                  </span>
                </p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {formatStat(Math.max(0, voteScore(stats)))} {at.votesSuffix} ·{" "}
                  {formatStat(tag.stats.plays)} {at.playsSuffix}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  disabled={own || !myId}
                  onClick={() => onVote(tag.id, 1)}
                  aria-label={at.voteAria}
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
                  aria-label={at.rejectAria}
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
        {at.voteNotNameHint(name)}
      </p>
    </article>
  );
}
