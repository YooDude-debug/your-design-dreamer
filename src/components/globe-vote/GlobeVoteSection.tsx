import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  EMPTY_GLOBE_FILTERS,
  GlobeVoteFilterBar,
  type GlobeVoteFilters,
} from "@/components/globe-vote/GlobeVoteFilterBar";
import { GlobeVoteCard } from "@/components/globe-vote/GlobeVoteCard";
import { useData } from "@/lib/data-context";
import { emptyStats, useSlangTagVotes, voteScore } from "@/lib/slangtag-votes";
import type { SlangTag } from "@/lib/types";
import { useLang } from "@/lib/lang-context";
import { arenaTexts } from "@/lib/i18n-arena";

/** „Berlin, Germany“ → Stadt „Berlin“, Land „Germany“. */
function splitRegion(region: string) {
  const parts = region
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return { city: "", country: "" };
  if (parts.length === 1) return { city: "", country: parts[0]! };
  return { city: parts[0]!, country: parts[parts.length - 1]! };
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "de"));
}

/**
 * Globe Vote: offene Community-Auswahl für den späteren Slang Globe.
 * Kandidaten sind ausschließlich Varianten, die der Owner freigegeben hat
 * (`communityShared`). Kein Wettbewerb, keine Frist – das ist die Arena.
 */
export function GlobeVoteSection() {
  const { tags, profiles, user, me } = useData();
  const { lang } = useLang();
  const at = arenaTexts[lang];
  const [filters, setFilters] = useState<GlobeVoteFilters>(EMPTY_GLOBE_FILTERS);

  const candidates = useMemo(() => tags.filter((t) => t.communityShared), [tags]);

  const options = useMemo(() => {
    const parts = candidates.map((t) => splitRegion(t.region));
    return {
      countries: uniqueSorted(parts.map((p) => p.country)),
      regions: uniqueSorted(candidates.map((t) => t.region)),
      cities: uniqueSorted(parts.map((p) => p.city)),
      languages: uniqueSorted(candidates.map((t) => t.language)),
    };
  }, [candidates]);

  const filtered = useMemo(() => {
    const needle = filters.q.trim().toLowerCase().replace(/^\$+/, "");
    return candidates.filter((t) => {
      const { city, country } = splitRegion(t.region);
      if (needle && !t.name.toLowerCase().includes(needle)) return false;
      if (filters.country && country !== filters.country) return false;
      if (filters.region && t.region !== filters.region) return false;
      if (filters.city && city !== filters.city) return false;
      if (filters.language && t.language !== filters.language) return false;
      return true;
    });
  }, [candidates, filters]);

  const ids = useMemo(() => filtered.map((t) => t.id), [filtered]);
  const { votes, myVotes, castVote } = useSlangTagVotes(ids, user?.id ?? null);

  /** Nach Namen gruppiert; Varianten bleiben eigenständige `slang_tag.id`. */
  const groups = useMemo(() => {
    const map = new Map<string, SlangTag[]>();
    for (const tag of filtered) {
      const key = tag.name.toLowerCase();
      const list = map.get(key);
      if (list) list.push(tag);
      else map.set(key, [tag]);
    }
    return [...map.values()]
      .map((variants) => ({
        name: variants[0]!.name,
        variants: [...variants].sort(
          (a, b) =>
            voteScore(votes[b.id] ?? emptyStats) - voteScore(votes[a.id] ?? emptyStats) ||
            b.stats.plays - a.stats.plays,
        ),
      }))
      .sort(
        (a, b) =>
          voteScore(votes[b.variants[0]!.id] ?? emptyStats) -
          voteScore(votes[a.variants[0]!.id] ?? emptyStats),
      );
  }, [filtered, votes]);

  const ownerName = (tag: SlangTag) => {
    const p = profiles[tag.ownerId];
    if (tag.ownerType === "company" && tag.company) return tag.company;
    return p?.displayName || (p?.username ? `@${p.username}` : "Community");
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-background p-4">
        <h2 className="text-sm font-black">{at.globeVoteHeading}</h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {at.globeVoteSubtitle}
        </p>
        <div className="mt-3">
          <GlobeVoteFilterBar
            filters={filters}
            options={options}
            onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
          />
        </div>
      </section>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {candidates.length === 0 ? at.globeVoteEmptyNone : at.globeVoteEmptyFiltered}
          </p>
          <Link
            to="/arena"
            search={{ tab: "manager" }}
            className="tap-safe mt-3 inline-flex rounded-full border border-brand/50 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-brand"
          >
            {at.submitOwnVariantBtn}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <GlobeVoteCard
              key={group.name.toLowerCase()}
              name={group.name}
              variants={group.variants}
              votes={votes}
              myVotes={myVotes}
              myId={me?.id ?? null}
              onVote={(id, value) => void castVote(id, value)}
              ownerName={ownerName}
            />
          ))}
        </div>
      )}
    </div>
  );
}
