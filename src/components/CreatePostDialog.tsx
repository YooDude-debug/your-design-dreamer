import { useRef, useState } from "react";
import { X, Image as ImageIcon, Mic, Square, Hash, MapPin, Send, Play, Pause } from "lucide-react";
import { toast } from "sonner";
import { Waveform } from "@/components/Waveform";
import { useProfile } from "@/lib/profile";

const REGIONS = ["Berlin, Germany", "Rostock, Germany", "Athens, Greece", "Rio de Janeiro, Brazil", "Tokyo, Japan"];
const EXISTING_TAGS = ["$moin", "$ickditdit", "$refile", "$valeu", "$yabai"];

export function CreatePostDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, addPost } = useProfile();
  const [image, setImage] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [region, setRegion] = useState(REGIONS[0]);
  const [hashtagInput, setHashtagInput] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [slangTag, setSlangTag] = useState<string>(EXISTING_TAGS[0]);
  const [audio, setAudio] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [playing, setPlaying] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  if (!open) return null;

  const pickFile = (file?: File) => {
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => setImage(String(fr.result));
    fr.readAsDataURL(file);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const fr = new FileReader();
        fr.onload = () => setAudio(String(fr.result));
        fr.readAsDataURL(blob);
        stream.getTracks().forEach((tr) => tr.stop());
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

  const togglePlay = () => {
    if (!audio) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(audio);
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      void audioRef.current.play();
      setPlaying(true);
    }
  };

  const addHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#/, "");
    if (!tag) return;
    setHashtags((prev) => Array.from(new Set([...prev, tag])).slice(0, 8));
    setHashtagInput("");
  };

  const publish = () => {
    if (!description.trim() && !image && !audio) {
      toast.error("Bitte füge Inhalt hinzu.");
      return;
    }
    addPost({
      title: slangTag,
      description: description.trim(),
      region,
      hashtags,
      image,
      audio,
      duration: "00:02",
    });
    toast.success("Beitrag veröffentlicht");
    setImage(null);
    setDescription("");
    setHashtags([]);
    setAudio(null);
    onClose();
  };

  const field = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand";

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
      <div className="my-6 w-full max-w-3xl rounded-2xl border border-border bg-surface p-5 shadow-glow">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black tracking-tight">
            Beitrag <span className="text-gradient-green">erstellen</span>
          </h2>
          <button onClick={onClose} aria-label="Schließen" className="rounded-full p-1.5 text-muted-foreground hover:text-brand">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Editor */}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs hover:border-brand/60 hover:text-brand">
                <ImageIcon className="h-3.5 w-3.5" /> Bild / GIF
                <input type="file" accept="image/*,image/gif" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
              </label>
              {!recording ? (
                <button
                  onClick={startRecording}
                  className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs hover:border-brand/60 hover:text-brand"
                >
                  <Mic className="h-3.5 w-3.5" /> SlangTag aufnehmen
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="inline-flex items-center gap-2 rounded-full border border-destructive/50 px-3 py-1.5 text-xs text-destructive"
                >
                  <Square className="h-3.5 w-3.5" /> Aufnahme stoppen
                </button>
              )}
              {audio && (
                <button
                  onClick={togglePlay}
                  className="inline-flex items-center gap-2 rounded-full border border-brand/50 px-3 py-1.5 text-xs text-brand"
                >
                  {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} Anhören
                </button>
              )}
            </div>

            <label className="block text-xs text-muted-foreground">
              SlangTag auswählen
              <select className={`mt-1 ${field}`} value={slangTag} onChange={(e) => setSlangTag(e.target.value)}>
                {EXISTING_TAGS.map((tg) => (
                  <option key={tg} value={tg}>
                    {tg}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs text-muted-foreground">
              Beschreibung
              <textarea rows={3} className={`mt-1 resize-none ${field}`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Was ist dein Vibe heute?" />
            </label>

            <label className="block text-xs text-muted-foreground">
              Region
              <select className={`mt-1 ${field}`} value={region} onChange={(e) => setRegion(e.target.value)}>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>

            <div className="text-xs text-muted-foreground">
              Hashtags
              <div className="mt-1 flex gap-2">
                <input
                  className={field}
                  value={hashtagInput}
                  onChange={(e) => setHashtagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addHashtag();
                    }
                  }}
                  placeholder="#kiez"
                />
                <button onClick={addHashtag} className="rounded-full border border-border px-3 text-xs hover:border-brand/60 hover:text-brand">
                  <Hash className="h-3.5 w-3.5" />
                </button>
              </div>
              {hashtags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {hashtags.map((h) => (
                    <button
                      key={h}
                      onClick={() => setHashtags((prev) => prev.filter((x) => x !== h))}
                      className="rounded-full bg-brand/15 px-2 py-0.5 text-[11px] text-brand"
                    >
                      #{h} ✕
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-2xl border border-border bg-background/60 p-3">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Vorschau</div>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 overflow-hidden rounded-full border border-brand/50 bg-surface">
                {profile.avatar ? (
                  <img src={profile.avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-black text-brand">
                    {profile.displayName.slice(0, 1)}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{profile.displayName}</div>
                <div className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {region}
                </div>
              </div>
            </div>

            {image && (
              <div className="mt-3 overflow-hidden rounded-xl border border-border">
                <img src={image} alt="Vorschau" className="max-h-56 w-full object-cover" />
              </div>
            )}

            {description && <p className="mt-3 text-sm leading-relaxed">{description}</p>}

            <div className="mt-3 rounded-xl border border-border bg-surface/60 p-3">
              <div className="text-sm font-semibold text-brand">{slangTag}</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand/20 text-brand">
                  <Play className="h-3 w-3 fill-current" />
                </span>
                <Waveform bars={34} className="h-6 flex-1" animated={playing} />
              </div>
            </div>

            {hashtags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-brand-cyan">
                {hashtags.map((h) => (
                  <span key={h}>#{h}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-full border border-border px-5 py-2 text-sm text-muted-foreground hover:text-foreground">
            Abbrechen
          </button>
          <button
            onClick={publish}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-brand px-6 py-2 text-sm font-semibold text-primary-foreground shadow-glow"
          >
            <Send className="h-4 w-4" /> Veröffentlichen
          </button>
        </div>
      </div>
    </div>
  );
}
