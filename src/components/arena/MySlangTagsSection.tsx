import { useRef, useState } from "react";
import { Pause, Play, Settings, Sparkles } from "lucide-react";
import { SlangBox } from "@/components/SlangBox";
import { SlangTagManager } from "@/components/SlangTagManager";
import { useData } from "@/lib/data-context";
import { useLang } from "@/lib/lang-context";
import { arenaTexts } from "@/lib/i18n-arena";
import { type SlangTag } from "@/lib/types";

/** Kleiner Play/Pause-Knopf für eine konkrete Audio-Variante. */
export function TagPlayButton({ tag, compact }: { tag: SlangTag; compact?: boolean }) {
  const { registerPlay } = useData();
  const { lang } = useLang();
  const at = arenaTexts[lang];
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    if (!tag.audio) return;
    let el = ref.current;
    if (!el) {
      el = new Audio(tag.audio);
      el.onended = () => setPlaying(false);
      ref.current = el;
    }
    if (playing) {
      el.pause();
      setPlaying(false);
      return;
    }
    el.currentTime = 0;
    void el.play().then(() => {
      setPlaying(true);
      void registerPlay(tag.id);
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!tag.audio}
      aria-label={playing ? at.pauseAria : at.playAria}
      className="tap-safe grid h-9 w-9 shrink-0 place-items-center rounded-full border border-brand/40 bg-brand/10 text-brand disabled:opacity-40"
    >
      {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
    </button>
  );
}

/** Slang Box als eigener Bereich – wiederverwendete Komponente. */
export function SlangBoxSection() {
  const { lang, t } = useLang();
  const at = arenaTexts[lang];
  return (
    <section className="rounded-2xl border border-border bg-background p-4">
      <h2 className="text-sm font-black">{t.slangBox}</h2>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{at.slangBoxSectionSubtitle}</p>
      <div className="mt-3">
        <SlangBox />
      </div>
    </section>
  );
}

type SubTab = "box" | "manager";

/**
 * Hauptbereich „Meine SlangTags“ mit zwei Unterbereichen:
 * Slang Box (bestehende Komponente) und SlangTag Manager (bestehende Komponente).
 */
export function MySlangTagsSection({ defaultSub }: { defaultSub?: SubTab }) {
  const { lang, t } = useLang();
  const at = arenaTexts[lang];
  const [sub, setSub] = useState<SubTab>(defaultSub ?? "box");


  const subs: { id: SubTab; label: string; icon: typeof Sparkles }[] = [
    { id: "box", label: t.slangBox, icon: Sparkles },
    { id: "manager", label: at.tabManagerLabel, icon: Settings },
  ];

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label={at.tabMineLabel}
        className="control-bar flex items-center gap-1 rounded-2xl p-1.5"
      >
        {subs.map((entry) => {
          const Icon = entry.icon;
          const on = entry.id === sub;
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setSub(entry.id)}
              className={`control-chip tap-safe flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl px-2.5 py-2 ${
                on ? "control-chip-active" : ""
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate text-[10.5px] font-bold uppercase tracking-wide">
                {entry.label}
              </span>
            </button>
          );
        })}
      </div>

      {sub === "box" ? (
        <SlangBoxSection />
      ) : (
        <section className="rounded-2xl border border-border bg-background p-4">
          <SlangTagManager />
        </section>
      )}
    </div>
  );
}
