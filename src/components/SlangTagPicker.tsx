import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Mic, Square, MapPin, Play, Pause, Users, Repeat2, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSlangTags, formatStat, type SlangTag } from "@/lib/slangtags";

type Props = {
  creator: string;
  region: string;
  onSelect: (tag: SlangTag) => void;
  placeholder?: string;
};

function PreviewPlay({ src }: { src: string | null }) {
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => ref.current?.pause(), []);
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation();
        if (!src) return;
        if (!ref.current) {
          ref.current = new Audio(src);
          ref.current.onended = () => setPlaying(false);
        }
        if (playing) {
          ref.current.pause();
          setPlaying(false);
        } else {
          void ref.current.play();
          setPlaying(true);
        }
      }}
      aria-label="Vorhören"
      className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-brand/60 bg-black/40 text-brand"
    >
      {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 fill-current" />}
    </button>
  );
}

/**
 * SlangTag-Eingabe über "$":
 * Sobald "$" getippt wird, öffnet sich direkt unter dem Feld ein Popup mit
 * Live-Suche. Ohne Treffer erscheint "Neuen SlangTag erstellen" (Mikro, 1–5 Sek.).
 */
export function SlangTagPicker({ creator, region, onSelect, placeholder = "$ tippen für SlangTag" }: Props) {
  const { search, createTag } = useSlangTags();
  const [query, setQuery] = useState("");
  const [audio, setAudio] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** SlangTag-Modus ist aktiv, sobald der Text mit $ beginnt */
  const active = query.trim().startsWith("$");
  const cleanName = query.trim().replace(/^\$/, "").replace(/\s+/g, "");
  const results = useMemo(() => (active ? search(cleanName) : []), [active, cleanName, search]);
  const noMatch = active && cleanName.length >= 2 && results.length === 0;

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    recorderRef.current?.stop();
    setRecording(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        const fr = new FileReader();
        fr.onload = () => setAudio(String(fr.result));
        fr.readAsDataURL(new Blob(chunks, { type: "audio/webm" }));
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= 5) stopRecording();
          return s + 1;
        });
      }, 1000);
    } catch {
      toast.error("Mikrofon-Zugriff nicht möglich.");
    }
  };

  const reset = () => {
    setQuery("");
    setAudio(null);
    setSeconds(0);
  };

  const create = () => {
    if (!cleanName) return toast.error("Bitte einen $Namen eingeben.");
    if (!audio) return toast.error("Bitte zuerst 1–5 Sekunden Audio aufnehmen.");
    const tag = createTag({ name: cleanName, audio, region, creator, duration: `0:0${Math.max(1, seconds)}` });
    onSelect(tag);
    reset();
    toast.success(`$${tag.name} erstellt und platziert`);
  };

  return (
    <div className="relative">
      <div
        className={`flex items-center gap-2 rounded-xl border bg-background px-3 py-2 ${
          active ? "border-brand shadow-glow" : "border-border focus-within:border-brand"
        }`}
      >
        <Search className="h-4 w-4 shrink-0 text-brand" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm outline-none"
        />
        {active && <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-brand">SlangTag</span>}
      </div>

      {active && (
        <div className="absolute z-50 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-brand/30 bg-surface/95 p-1 shadow-glow backdrop-blur-xl">
          {results.map((t) => (
            <button
              key={t.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(t);
                reset();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-brand/10"
            >
              <PreviewPlay src={t.audio} />
              <span className="shrink-0 text-sm font-bold text-brand">${t.name}</span>
              <span className="inline-flex min-w-0 items-center gap-1 truncate text-[11px] text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" /> {t.region.split(",")[0]}
              </span>
              <span className="ml-auto inline-flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Repeat2 className="h-3 w-3" /> {formatStat(t.stats.uses)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" /> @{t.creator}
                </span>
              </span>
            </button>
          ))}

          {noMatch && (
            <div className="rounded-lg border border-dashed border-brand/40 bg-brand/5 p-2.5">
              <div className="text-xs font-semibold text-brand">🎤 Neuen SlangTag erstellen</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                ${cleanName} existiert noch nicht — 1–5 Sekunden aufnehmen.
              </div>
              <div className="mt-2 flex items-center gap-2">
                {!recording ? (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={startRecording}
                    className="inline-flex items-center gap-1.5 rounded-full border border-brand/60 px-3 py-1 text-xs font-semibold text-brand"
                  >
                    <Mic className="h-3 w-3" /> {audio ? "Neu aufnehmen" : "Aufnehmen"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={stopRecording}
                    className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-3 py-1 text-xs font-semibold text-white"
                  >
                    <Square className="h-3 w-3" /> Stop {seconds}s
                  </button>
                )}
                {audio && !recording && (
                  <>
                    <PreviewPlay src={audio} />
                    <span className="inline-flex items-center gap-1 text-[11px] text-brand">
                      <Check className="h-3 w-3" /> Audio bereit
                    </span>
                  </>
                )}
                {recording && <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />}
              </div>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={create}
                disabled={!audio || recording}
                className="mt-2 w-full rounded-full bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
              >
                ${cleanName} speichern &amp; platzieren
              </button>
            </div>
          )}

          {!noMatch && results.length === 0 && (
            <div className="px-2.5 py-2 text-[11px] text-muted-foreground">Weiter tippen, z. B. $Moin …</div>
          )}
        </div>
      )}
    </div>
  );
}
