import { useMemo, useRef, useState } from "react";
import { Search, Mic, Square, Plus, MapPin, Play } from "lucide-react";
import { toast } from "sonner";
import { useSlangTags, formatStat, type SlangTag } from "@/lib/slangtags";

type Props = {
  creator: string;
  region: string;
  onSelect: (tag: SlangTag) => void;
  placeholder?: string;
};

/** Tippt der Nutzer "$", öffnet sich sofort die SlangTag-Suchliste. */
export function SlangTagPicker({ creator, region, onSelect, placeholder = "$ tippen für SlangTag-Suche" }: Props) {
  const { search, createTag } = useSlangTags();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [audio, setAudio] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const results = useMemo(() => (open ? search(query) : []), [open, query, search]);
  const cleanName = query.replace(/^\$/, "").trim();

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
    } catch {
      toast.error("Mikrofon-Zugriff nicht möglich.");
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const create = () => {
    if (!cleanName) return toast.error("Bitte einen $Namen eingeben.");
    if (!audio) return toast.error("Bitte zuerst 1–5 Sekunden Audio aufnehmen.");
    const tag = createTag({ name: cleanName, audio, region, creator });
    onSelect(tag);
    setQuery("");
    setAudio(null);
    setOpen(false);
    toast.success(`$${tag.name} erstellt`);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-brand">
        <Search className="h-4 w-4 shrink-0 text-brand" />
        <input
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm outline-none"
        />
        {!recording ? (
          <button
            type="button"
            onClick={startRecording}
            title="Neues SlangTag aufnehmen"
            className="shrink-0 text-muted-foreground hover:text-brand"
          >
            <Mic className="h-4 w-4" />
          </button>
        ) : (
          <button type="button" onClick={stopRecording} className="shrink-0 text-destructive">
            <Square className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-glow">
          {results.map((t) => (
            <button
              key={t.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(t);
                setQuery("");
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-brand/10"
            >
              <span className="text-sm font-bold text-brand">${t.name}</span>
              <span className="inline-flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                <MapPin className="h-3 w-3" /> {t.region} · {t.language}
              </span>
              <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                <Play className="h-3 w-3" /> {formatStat(t.stats.plays)}
              </span>
            </button>
          ))}

          <div className="mt-1 border-t border-border px-2.5 py-2">
            <div className="text-[11px] text-muted-foreground">
              {audio ? "Audio aufgenommen ✓" : "Neu: Namen eintippen + Mikro-Button für 1–5 Sek. Audio"}
            </div>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={create}
              className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-3 py-1 text-xs font-semibold text-primary-foreground"
            >
              <Plus className="h-3 w-3" /> ${cleanName || "name"} erstellen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
