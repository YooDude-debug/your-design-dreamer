import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Sparkles, GripVertical } from "lucide-react";
import { Waveform } from "@/components/Waveform";
import { getAudio } from "@/lib/autoplay";
import { useData } from "@/lib/data";
import { useLang } from "@/lib/i18n";
import { formatStat, type SlangTag } from "@/lib/types";
import { SlangTagName } from "@/components/SlangTagName";
import { openUnlockPrompt } from "@/components/CreatorUnlockDialog";
import { slangTagPrefix } from "@/lib/slangtag-rules";

export const SLANGTAG_DND_TYPE = "application/x-ydude-slangtag";

function SlangBoxCard({ tag, onPick }: { tag: SlangTag; onPick?: (tag: SlangTag) => void }) {
  const { registerPlay, isTagLocked } = useData();
  const { t } = useLang();
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const locked = isTagLocked(tag);

  useEffect(() => () => audioRef.current?.pause(), []);

  const pick = () => (locked ? openUnlockPrompt(tag) : onPick?.(tag));

  const toggle = () => {
    if (!tag.audio) return;
    if (!audioRef.current) {
      audioRef.current = getAudio(tag.audio);
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      void audioRef.current.play();
      setPlaying(true);
      void registerPlay(tag.id);
    }
  };

  return (
    <div
      draggable={!locked}
      onDragStart={(e) => {
        if (locked) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData(SLANGTAG_DND_TYPE, tag.id);
        e.dataTransfer.setData("text/plain", `${slangTagPrefix(tag.kind)}${tag.name}`);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onDoubleClick={pick}
      title={locked ? t.unlockCreatorTag : t.slangBoxDragHint}
      className={`group w-full min-w-0 shrink-0 rounded-xl border border-white/20 bg-white/10 p-1.5 shadow-[0_0_18px_oklch(0.82_0.24_150/0.18)] backdrop-blur-xl ${
        locked ? "cursor-pointer opacity-60" : "cursor-grab active:cursor-grabbing"
      }`}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={toggle}
          aria-label={`${slangTagPrefix(tag.kind)}${tag.name} — ${playing ? t.pause : t.play}`}
          className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-transform hover:scale-105 ${
            playing ? "border-brand bg-brand/25 text-brand shadow-glow" : "border-brand/60 bg-black/40 text-brand"
          }`}
        >
          {playing ? <Pause className="h-2 w-2" /> : <Play className="h-2 w-2 fill-current" />}
        </button>
        <Waveform bars={10} className="h-2.5 min-w-0 flex-1" animated={playing} />
        <GripVertical className="h-2.5 w-2.5 shrink-0 text-white/30 group-hover:text-brand" />
      </div>
      <button
        type="button"
        onClick={pick}
        className="mt-0.5 block w-full text-left text-[10px] font-black tracking-tight hover:opacity-80"
      >
        <SlangTagName tag={tag} />
      </button>
      <div className="flex items-center gap-1.5 text-[9px] leading-tight text-white/70">
        <span className="truncate">{formatStat(tag.stats.plays)} {t.plays}</span>
        <span className="truncate">{formatStat(tag.stats.uses)} {t.uses}</span>
      </div>
    </div>

  );
}

/**
 * Slang Box – die persönliche Sammlung: selbst erstellte und freigeschaltete
 * (gespeicherte) SlangTags. Horizontal scrollbar, per Drag & Drop platzierbar.
 */
export function SlangBox({
  onPick,
  compact = false,
}: {
  onPick?: (tag: SlangTag) => void;
  compact?: boolean;
}) {
  const { me, tags, savedTags } = useData();
  const { t } = useLang();

  const mine = useMemo(
    () =>
      tags
        .filter((t) => t.creatorId === me?.id || savedTags.includes(t.id))
        .sort((a, b) => b.createdAt - a.createdAt),
    [tags, savedTags, me],
  );

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-foreground">
          <Sparkles className="h-3.5 w-3.5 text-brand" /> {t.slangBox}
        </h3>
        <span className="text-[10px] text-muted-foreground">{mine.length}</span>
      </div>

      {mine.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-3 text-[11px] text-muted-foreground">
          {t.slangBoxEmpty}
        </p>
      ) : (
        <div
          className={`grid grid-cols-2 gap-2 overflow-y-auto pb-1 pr-1 ${
            compact ? "max-h-[420px]" : "max-h-[520px]"
          }`}
        >
          {mine.map((t) => (
            <SlangBoxCard key={t.id} tag={t} onPick={onPick} />
          ))}
        </div>
      )}

      <p className="mt-1 text-[10px] text-muted-foreground">
        {t.slangBoxHint}
      </p>
    </div>
  );
}
