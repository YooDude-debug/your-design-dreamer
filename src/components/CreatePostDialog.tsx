import { useRef, useState } from "react";
import { X, Image as ImageIcon, Hash, MapPin, Send } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/lib/data";
import type { SlangTagPlacement } from "@/lib/types";
import { SlangTagPicker } from "@/components/SlangTagPicker";
import { SlangTagCanvas } from "@/components/SlangTagCanvas";
import { SlangTagChip } from "@/components/SlangTagChip";

const REGIONS = ["Berlin, Germany", "Rostock, Germany", "Athens, Greece", "Rio de Janeiro, Brazil", "Tokyo, Japan"];

export function CreatePostDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me, createPost, getTag } = useData();
  const [publishing, setPublishing] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [region, setRegion] = useState(REGIONS[0]);
  const [hashtagInput, setHashtagInput] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [placements, setPlacements] = useState<SlangTagPlacement[]>([]);
  const counter = useRef(0);

  if (!open) return null;

  const pickFile = (file?: File) => {
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => setImage(String(fr.result));
    fr.readAsDataURL(file);
  };

  const addPlacement = (tagId: string) => {
    counter.current += 1;
    setPlacements((prev) => [
      ...prev,
      {
        id: `pl_${Date.now()}_${counter.current}`,
        tagId,
        // startet mittig auf dem Bild, danach frei verschiebbar
        x: 50,
        y: 50,
        scale: 1,
        rotation: 0,
        variant: "compact",
      },
    ]);
  };

  const addHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#/, "");
    if (!tag) return;
    setHashtags((prev) => Array.from(new Set([...prev, tag])).slice(0, 8));
    setHashtagInput("");
  };

  const publish = async () => {
    if (!description.trim() && !image && placements.length === 0) {
      toast.error("Bitte füge Inhalt hinzu.");
      return;
    }
    const tagIds = Array.from(new Set(placements.map((p) => p.tagId)));
    const first = tagIds[0] ? getTag(tagIds[0]) : undefined;
    setPublishing(true);
    const ok = await createPost({
      title: first ? `$${first.name}` : description.trim().slice(0, 40) || "Beitrag",
      description: description.trim(),
      region,
      hashtags,
      imageDataUrl: image,
      audioPath: first?.audioPath ?? null,
      duration: first?.duration ?? "0:02",
      placements,
      slangTagIds: tagIds,
    });
    setPublishing(false);
    if (!ok) {
      toast.error("Beitrag konnte nicht gespeichert werden.");
      return;
    }
    toast.success("Beitrag veröffentlicht");
    setImage(null);
    setDescription("");
    setHashtags([]);
    setPlacements([]);
    onClose();
  };

  const field = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand";

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
      <div className="my-6 w-full max-w-4xl rounded-2xl border border-border bg-surface p-5 shadow-glow">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black tracking-tight">
            Beitrag mit <span className="text-gradient-green">SlangTags</span> erstellen
          </h2>
          <button onClick={onClose} aria-label="Schließen" className="rounded-full p-1.5 text-muted-foreground hover:text-brand">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Editor */}
          <div className="space-y-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs hover:border-brand/60 hover:text-brand">
              <ImageIcon className="h-3.5 w-3.5" /> Bild / GIF hochladen
              <input type="file" accept="image/*,image/gif" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
            </label>

            <div>
              <div className="mb-1 text-xs text-muted-foreground">$ tippen — SlangTag suchen oder neu aufnehmen</div>
              <SlangTagPicker
                region={region}
                onSelect={(t) => {
                  addPlacement(t.id);
                  toast.success(`$${t.name} platziert – frei verschiebbar`);
                }}
              />
              {placements.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {placements.map((p) => {
                    const t = getTag(p.tagId);
                    return t ? (
                      <button
                        key={p.id}
                        onClick={() => setPlacements((prev) => prev.filter((x) => x.id !== p.id))}
                        className="rounded-full bg-brand/15 px-2 py-0.5 text-[11px] text-brand"
                      >
                        ${t.name} ✕
                      </button>
                    ) : null;
                  })}
                </div>
              )}
            </div>

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
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Vorschau — SlangTags ziehen, skalieren, drehen
            </div>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 overflow-hidden rounded-full border border-brand/50 bg-surface">
                {me?.avatar ? (
                  <img src={me.avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-black text-brand">
                    {(me?.displayName ?? "?").slice(0, 1)}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{me?.displayName ?? "Ich"}</div>
                <div className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {region}
                </div>
              </div>
            </div>

            {image ? (
              <div className="mt-3">
                <SlangTagCanvas image={image} placements={placements} editable onChange={setPlacements} />
              </div>
            ) : (
              <div className="mt-3 grid h-40 place-items-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
                Bild oder GIF hochladen, um SlangTags zu platzieren
              </div>
            )}

            {description && <p className="mt-3 text-sm leading-relaxed">{description}</p>}

            {!image && placements.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {placements.map((p) => {
                  const t = getTag(p.tagId);
                  return t ? <SlangTagChip key={p.id} tag={t} variant="compact" /> : null;
                })}
              </div>
            )}

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
            onClick={() => void publish()}
            disabled={publishing}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-brand px-6 py-2 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> {publishing ? "Speichern …" : "Veröffentlichen"}
          </button>
        </div>
      </div>
    </div>
  );
}
