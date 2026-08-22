import { Globe2, MapPin, MoreHorizontal, ThumbsDown, ThumbsUp } from "lucide-react";
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
    <article className="rounded-2xl border border-border bg-background p-2">
      {/* Mobil: Name in eigener Zeile (nicht abschneiden), Meta darunter. */}
      <header className="grid grid-cols-1 items-center gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <SlangTagName tag={head} className="min-w-0 text-sm font-black" />
          <StatusChip label={at.variantsCountLabel(variants.length)} />
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[9px] text-muted-foreground sm:shrink-0 sm:flex-nowrap">
          {head.language && (
            <span className="inline-flex items-center gap-0.5">
              <Globe2 className="h-2.5 w-2.5" /> {head.language}
            </span>
          )}
          {head.region && (
            <span className="inline-flex min-w-0 max-w-[60%] items-center gap-0.5 truncate sm:max-w-[90px]">
              <MapPin className="h-2.5 w-2.5" /> {head.region}
            </span>
          )}

          <span
            aria-hidden="true"
            className="grid h-5 w-5 place-items-center text-muted-foreground"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </span>
        </div>
      </header>

      <section className="mt-1.5 rounded-xl border border-border/60 bg-background/40 p-1.5">
        <div role="tablist" className="flex items-center gap-1">
          {(["meaning", "geo"] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={infoTab === id}
              onClick={() => setInfoTab(id)}
              className={`tap-safe rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider transition-colors ${
                infoTab === id
                  ? "border-brand/60 bg-brand/10 text-brand"
                  : "border-border text-muted-foreground hover:border-brand/40 hover:text-brand"
              }`}
            >
              {id === "meaning" ? at.tabMeaningLabel : at.tabGeoLabel}
            </button>
          ))}
        </div>

        <div className="mt-1">
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

      <ul className="mt-1.5 overflow-hidden rounded-xl border border-border/60">
        {variants.map((tag, i) => {
          const stats = votes[tag.id] ?? emptyStats;
          const mine = myVotes[tag.id];
          const own = tag.ownerId === myId;
          return (
            <li
              key={tag.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1.5 bg-background/40 px-2 py-1.5"
            >
              <TagPlayButton tag={tag} compact />
              <div className="min-w-0">
                <p className="truncate text-[11px] font-bold">
                  {at.variantLetter(String.fromCharCode(65 + i))}
                  <span className="ml-1 font-normal text-muted-foreground">
                    {ownerName(tag)} · {ownerLabel(at, tag.ownerType)}
                  </span>
                </p>
                <p className="truncate text-[9px] text-muted-foreground">
                  {formatStat(Math.max(0, voteScore(stats)))} {at.votesSuffix} ·{" "}
                  {formatStat(tag.stats.plays)} {at.playsSuffix}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  disabled={own || !myId}
                  onClick={() => onVote(tag.id, 1)}
                  aria-label={at.voteAria}
                  className={`tap-safe grid h-7 w-7 place-items-center rounded-full border transition-colors disabled:opacity-40 ${
                    mine === 1
                      ? "border-brand bg-brand/15 text-brand"
                      : "border-border text-muted-foreground hover:border-brand/50 hover:text-brand"
                  }`}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={own || !myId}
                  onClick={() => onVote(tag.id, -1)}
                  aria-label={at.rejectAria}
                  className={`tap-safe grid h-7 w-7 place-items-center rounded-full border transition-colors disabled:opacity-40 ${
                    mine === -1
                      ? "border-destructive bg-destructive/15 text-destructive"
                      : "border-border text-muted-foreground hover:border-destructive/50"
                  }`}
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-1 px-1 text-[9px] text-muted-foreground">{at.voteNotNameHint(name)}</p>
    </article>
  );
}
