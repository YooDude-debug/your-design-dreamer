import { useEffect, useMemo, useState } from "react";
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
import { useSlangDefinitions } from "@/lib/slang-definitions";
import { toast } from "sonner";


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
export function GlobeVoteSection({ initialQuery = "" }: { initialQuery?: string }) {
  const { tags, profiles, user, me } = useData();
  const { lang } = useLang();
  const at = arenaTexts[lang];
  const [filters, setFilters] = useState<GlobeVoteFilters>({
    ...EMPTY_GLOBE_FILTERS,
    q: initialQuery,
  });

  /** Vorauswahl aus dem Slang Globe („In der Arena öffnen“). */
  useEffect(() => {
    if (initialQuery) setFilters((f) => ({ ...f, q: initialQuery }));
  }, [initialQuery]);

  const candidates = useMemo(() => tags.filter((t) => t.communityShared), [tags]);

  /** Abhängige Filteroptionen: jede Ebene respektiert die gröberen Ebenen. */
  const options = useMemo(() => {
    const rows = candidates.map((t) => ({ ...splitRegion(t.region), tag: t }));
    const byCountry = filters.country
      ? rows.filter((r) => r.country === filters.country)
      : rows;
    const byRegion = filters.region
      ? byCountry.filter((r) => r.tag.region === filters.region)
      : byCountry;
    const byCity = filters.city ? byRegion.filter((r) => r.city === filters.city) : byRegion;
    return {
      countries: uniqueSorted(rows.map((r) => r.country)),
      regions: uniqueSorted(byCountry.map((r) => r.tag.region)),
      cities: uniqueSorted(byRegion.map((r) => r.city)),
      languages: uniqueSorted(byCity.map((r) => r.tag.language)),
    };
  }, [candidates, filters.country, filters.region, filters.city]);

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
  /** Bedeutungen liegen auf Namensebene und werden pro Sprache aufgelöst. */
  const { definitions, saveDefinition, saveGeo } = useSlangDefinitions(ids, lang);


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
            onReset={() => setFilters((f) => ({ ...EMPTY_GLOBE_FILTERS, q: f.q }))}
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
              definition={
                group.variants.map((v) => definitions[v.id]).find(Boolean) ?? null
              }
              onSaveGeo={async (geo) => {
                const own =
                  group.variants.find((v) => v.ownerId === (me?.id ?? "")) ?? group.variants[0]!;
                try {
                  await saveGeo(own.id, geo);
                  toast.success(at.geoSavedToast);
                } catch {
                  toast.error(at.geoSaveErrorToast);
                }
              }}
              onSaveDefinition={async (meaning, example) => {
                const own =
                  group.variants.find((v) => v.ownerId === (me?.id ?? "")) ?? group.variants[0]!;
                try {
                  await saveDefinition(own.id, meaning, example);
                  toast.success(at.meaningSavedToast);
                } catch {
                  toast.error(at.meaningSaveErrorToast);
                }
              }}
            />

          ))}
        </div>
      )}
    </div>
  );
}
