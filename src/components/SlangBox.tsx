import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Sparkles, GripVertical } from "lucide-react";
import { Waveform } from "@/components/Waveform";
import { useData } from "@/lib/data";
import { useLang } from "@/lib/i18n";
import { formatStat, type SlangTag } from "@/lib/types";

export const SLANGTAG_DND_TYPE = "application/x-ydude-slangtag";

function SlangBoxCard({ tag, onPick }: { tag: SlangTag; onPick?: (tag: SlangTag) => void }) {
  const { registerPlay } = useData();
  const { t: tr } = useLang();
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => audioRef.current?.pause(), []);

  const toggle = () => {
    if (!tag.audio) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(tag.audio);
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
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(SLANGTAG_DND_TYPE, tag.id);
        e.dataTransfer.setData("text/plain", `$${tag.name}`);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onDoubleClick={() => onPick?.(tag)}
      title={t.slangBoxDragHint}
      className="group w-[148px] shrink-0 cursor-grab rounded-xl border border-white/20 bg-white/10 p-2 shadow-[0_0_18px_oklch(0.82_0.24_150/0.18)] backdrop-blur-xl active:cursor-grabbing"
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={toggle}
          aria-label={`$${tag.name} — ${playing ? t.pause : t.play}`}
          className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-transform hover:scale-105 ${
            playing ? "border-brand bg-brand/25 text-brand shadow-glow" : "border-brand/60 bg-black/40 text-brand"
          }`}
        >
          {playing ? <Pause className="h-2.5 w-2.5" /> : <Play className="h-2.5 w-2.5 fill-current" />}
        </button>
        <Waveform bars={14} className="h-3 flex-1" animated={playing} />
        <GripVertical className="h-3 w-3 shrink-0 text-white/30 group-hover:text-brand" />
      </div>
      <button
        type="button"
        onClick={() => onPick?.(tag)}
        className="mt-1 block w-full truncate text-left text-[11px] font-black tracking-tight text-white hover:text-brand"
      >
        ${tag.name}
      </button>
      <div className="mt-0.5 flex items-center gap-2 text-[9px] text-white/70">
        <span>{formatStat(tag.stats.plays)} {t.plays}</span>
        <span>{formatStat(tag.stats.uses)} {t.uses}</span>
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
        <div className={`flex gap-2 overflow-x-auto pb-2 ${compact ? "" : "pr-1"}`}>
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
