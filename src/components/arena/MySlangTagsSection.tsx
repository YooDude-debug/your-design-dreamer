import { useMemo, useRef, useState } from "react";
import { Pause, Play, Search } from "lucide-react";
import { SlangBox } from "@/components/SlangBox";
import { SlangTagName } from "@/components/SlangTagName";
import { StatusChip } from "@/components/arena/StatusChip";
import { useData } from "@/lib/data-context";
import { formatStat, type SlangTag } from "@/lib/types";

const OWNER_LABEL: Record<SlangTag["ownerType"], string> = {
  user: "User",
  creator: "Creator",
  company: "Business",
};

/** Kleiner Play/Pause-Knopf für eine konkrete Audio-Variante. */
export function TagPlayButton({ tag }: { tag: SlangTag }) {
  const { registerPlay } = useData();
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
      aria-label={playing ? "Pause" : "Abspielen"}
      className="tap-safe grid h-9 w-9 shrink-0 place-items-center rounded-full border border-brand/40 bg-brand/10 text-brand disabled:opacity-40"
    >
      {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
    </button>
  );
}

/**
 * Bereich „Meine SlangTags“: persönliche Sammlung (owner-scoped) mit Suche,
 * kompakten Zeilen und der bestehenden Slang Box.
 */
export function MySlangTagsSection() {
  const { myTags } = useData();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/^\$+/, "");
    const list = needle ? myTags.filter((t) => t.name.toLowerCase().includes(needle)) : myTags;
    return [...list].sort((a, b) => b.createdAt - a.createdAt);
  }, [myTags, q]);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-surface/50 p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-black">Meine SlangTags</h2>
            <p className="truncate text-[11px] text-muted-foreground">
              Deine persönlichen Varianten. Einreichen für den Globe im SlangTag Manager.
            </p>
          </div>
          <StatusChip label={`${myTags.length} Varianten`} />
        </div>

        <label className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Eigene SlangTags suchen …"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>

        {rows.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
            {myTags.length === 0
              ? "Noch keine eigenen SlangTags – nimm deinen ersten Sound auf."
              : "Keine Treffer."}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60">
            {rows.map((tag) => (
              <li
                key={tag.id}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 bg-background/40 px-2.5 py-2"
              >
                <TagPlayButton tag={tag} />
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <SlangTagName tag={tag} className="text-sm font-bold" />
                    <StatusChip label={OWNER_LABEL[tag.ownerType]} />
                  </div>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {[tag.region, tag.language].filter(Boolean).join(" · ") || "ohne Region"} ·{" "}
                    {formatStat(tag.stats.plays)} Plays
                  </p>
                </div>
                <StatusChip
                  label={tag.communityShared ? "für Globe vorgesehen" : "Eigene"}
                  tone={tag.communityShared ? "brand" : "muted"}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface/50 p-4">
        <h2 className="text-sm font-black">Slang Box</h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Sortieren, ablegen und in Beiträgen verwenden – per Drag &amp; Drop.
        </p>
        <div className="mt-3">
          <SlangBox />
        </div>
      </section>
    </div>
  );
}
