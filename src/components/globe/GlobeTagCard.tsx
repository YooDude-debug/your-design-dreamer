import { CloseButton } from "@/components/ui/nav-buttons";
import { memo, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, MapPin, Pause, Play, X } from "lucide-react";
import type { GlobeRegion } from "@/lib/globe/types";
import type { SatelliteCandidate } from "@/lib/globe/satellites";
import { useLang } from "@/lib/lang-context";
import { arenaTexts } from "@/lib/i18n-arena";
import { profileLang, tagMeaning } from "@/lib/globe/tag-meanings";
import { useData } from "@/lib/data-context";
import { isOwnerPlaying, playExclusive, stopOwner } from "@/lib/autoplay";

const OWNER = "globe-tag-card";

/**
 * Slang Globe – kompakte Info-/Wiedergabekarte für einen auf dem Globe
 * angetippten SlangTag. Nutzt ausschließlich die bestehende Audio-Bus-Logik
 * (`playExclusive`) und die vorhandene SlangTag-Datenquelle (`getTag`).
 */
export const GlobeTagCard = memo(function GlobeTagCard({
  cand,
  region,
  onClose,
}: {
  cand: SatelliteCandidate;
  region: GlobeRegion | null;
  onClose: () => void;
}) {
  const { lang } = useLang();
  const at = arenaTexts[lang];
  const { me, getTag } = useData();
  const meaningLang = profileLang(me?.language, lang);
  const tag = getTag(cand.tag);
  const src = tag?.audio ?? null;
  const [playing, setPlaying] = useState(false);

  // Beim Wechsel auf einen anderen SlangTag automatisch abspielen.
  useEffect(() => {
    if (!src) {
      setPlaying(false);
      return;
    }
    playExclusive(OWNER, src, () => setPlaying(false));
    setPlaying(true);
    return () => stopOwner(OWNER);
  }, [src, cand.id]);

  const toggle = () => {
    if (!src) return;
    if (isOwnerPlaying(OWNER)) {
      stopOwner(OWNER);
      setPlaying(false);
      return;
    }
    playExclusive(OWNER, src, () => setPlaying(false));
    setPlaying(true);
  };

  const meaning = tagMeaning(cand.tag, meaningLang, tag?.meaning ?? undefined);

  return (
    <div className="pointer-events-auto w-full animate-[fade-in_180ms_ease-out] rounded-3xl border border-brand/40 bg-surface/90 p-3 shadow-2xl backdrop-blur-xl sm:w-80">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          disabled={!src}
          aria-label={playing ? at.pauseAria : at.playAria}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-brand/50 bg-brand/15 text-brand disabled:opacity-40"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black tracking-tight text-brand">${cand.tag}</p>
          <p className="truncate text-[11px] text-muted-foreground">{meaning ?? at.noMeaningYet}</p>
        </div>
        <CloseButton onClick={onClose} label={at.regionCloseAria} className="shrink-0" />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-background/50 px-2 py-1">
          <MapPin className="h-3 w-3" /> {cand.place}
        </span>
        {region?.language && (
          <span className="rounded-full border border-border/50 bg-background/50 px-2 py-1">
            {at.languageLabel}: {region.language}
          </span>
        )}
        {region?.category && (
          <span className="rounded-full border border-border/50 bg-background/50 px-2 py-1">
            {region.category}
          </span>
        )}
      </div>

      {!src && <p className="mt-2 text-[10px] text-muted-foreground/70">{at.tagUnavailable}</p>}

      <Link
        to="/arena"
        search={{ tab: "globe", q: cand.tag }}
        className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-brand hover:underline"
      >
        {at.openInArena} <ChevronRight className="h-3 w-3" />
      </Link>
    </div>
  );
});
