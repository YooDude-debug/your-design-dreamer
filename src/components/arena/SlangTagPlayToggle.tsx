import { useEffect, useId, useState } from "react";
import { Pause, Play } from "lucide-react";
import { claimBus, getAudio, isOwnerPlaying, playExclusive, stopOwner } from "@/lib/autoplay";
import { useData } from "@/lib/data-context";
import { useLang } from "@/lib/lang-context";
import { slangTagPrefix } from "@/lib/slangtag-rules";
import { type SlangTag } from "@/lib/types";

/**
 * Kleiner Play/Pause-Knopf fuer einen SlangTag – nutzt den bestehenden
 * globalen Audio-Bus (`playExclusive`), damit immer nur eine Wiedergabe
 * laeuft, und zaehlt Plays ueber die vorhandene `registerPlay`-Statistik.
 */
export function SlangTagPlayToggle({ tag }: { tag: SlangTag }) {
  const { registerPlay } = useData();
  const { t } = useLang();
  const owner = `slangtag:${tag.id}:${useId()}`;
  const [playing, setPlaying] = useState(false);
  const business = tag.kind === "creator";

  useEffect(() => () => stopOwner(owner), [owner]);

  const toggle = () => {
    if (!tag.audio) return;
    if (playing || isOwnerPlaying(owner)) {
      stopOwner(owner);
      setPlaying(false);
      return;
    }
    playExclusive(owner, tag.audio, () => setPlaying(false));
    claimBus(owner, getAudio(tag.audio), () => setPlaying(false));
    setPlaying(true);
    void registerPlay(tag.id);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!tag.audio}
      aria-label={`${slangTagPrefix(tag.kind)}${tag.name} — ${playing ? t.pause : t.play}`}
      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-transform hover:scale-105 disabled:opacity-40 ${
        playing
          ? business
            ? "border-brand-cyan bg-brand-cyan/25 text-brand-cyan shadow-[0_0_10px_oklch(0.78_0.16_210/0.4)]"
            : "border-brand bg-brand/25 text-brand shadow-glow"
          : business
            ? "border-brand-cyan/60 bg-black/40 text-brand-cyan"
            : "border-brand/60 bg-black/40 text-brand"
      }`}
    >
      {playing ? <Pause className="h-2.5 w-2.5" /> : <Play className="h-2.5 w-2.5 fill-current" />}
    </button>
  );
}
