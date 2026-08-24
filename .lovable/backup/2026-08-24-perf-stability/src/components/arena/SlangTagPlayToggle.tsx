import { useEffect, useId, useState } from "react";
import { Pause, Play } from "lucide-react";
import { claimBus, getAudio, isOwnerPlaying, playExclusive, stopOwner } from "@/lib/autoplay";
import { useData } from "@/lib/data-context";
import { useLang } from "@/lib/lang-context";
import { slangTagPrefix } from "@/lib/slangtag-rules";
import { slangTagTheme } from "@/lib/slangtag-ui";
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
  const theme = slangTagTheme(tag.kind);

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
        playing ? theme.playActive : theme.playIdle
      }`}
    >
      {playing ? <Pause className="h-2.5 w-2.5" /> : <Play className="h-2.5 w-2.5 fill-current" />}
    </button>
  );
}
