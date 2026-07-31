import { useRef, useState } from "react";
import { X, Image as ImageIcon, Hash, MapPin, Send } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/lib/data";
import { useLang } from "@/lib/i18n";
import { SlangTagField, SlangText, extractTagIds } from "@/components/SlangTagInput";
import type { SlangTagPlacement, PostVisibility } from "@/lib/types";
import { VISIBILITY_META, visibilityLabel } from "@/components/VisibilityBadge";
import { SlangTagPicker } from "@/components/SlangTagPicker";
import { SlangTagCanvas } from "@/components/SlangTagCanvas";
import { SlangTagChip } from "@/components/SlangTagChip";
import { SlangBox } from "@/components/SlangBox";

export const REGIONS = ["Berlin, Germany", "Rostock, Germany", "Athens, Greece", "Rio de Janeiro, Brazil", "Tokyo, Japan"];

/** Maximal erlaubte SlangTags pro Beitrag. */
export const MAX_SLANGTAGS = 5;


/** Beitrags-Editor. Steht im mittleren Bereich dauerhaft zur Verfügung. */
export function PostComposer({ onDone }: { onDone?: () => void }) {
  const { me, createPost, getTag } = useData();
  const { t } = useLang();
  const [publishing, setPublishing] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [region, setRegion] = useState(REGIONS[0]);
  const [hashtagInput, setHashtagInput] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [placements, setPlacements] = useState<SlangTagPlacement[]>([]);
  const [visibility, setVisibility] = useState<PostVisibility>("public");
  const counter = useRef(0);

  const pickFile = (file?: File) => {
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => setImage(String(fr.result));
    fr.readAsDataURL(file);
  };

  const tagCount = placements.length;
  const maxReached = tagCount >= MAX_SLANGTAGS;

  const addPlacement = (tagId: string, x = 50, y = 50) => {
    if (placements.length >= MAX_SLANGTAGS) {
      toast.error(t.maxTagsReached);
      return;
    }
    counter.current += 1;
    setPlacements((prev) =>
      prev.length >= MAX_SLANGTAGS
        ? prev
        : [
            ...prev,
            {
              id: `pl_${Date.now()}_${counter.current}`,
              tagId,
              x,
              y,
              scale: 1,
              rotation: 0,
              variant: "compact",
            },
          ],
    );
  };


  const addHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#/, "");
    if (!tag) return;
    setHashtags((prev) => Array.from(new Set([...prev, tag])).slice(0, 8));
    setHashtagInput("");
  };

  const publish = async () => {
    if (!description.trim() && !image && placements.length === 0) {
      toast.error(t.addContentFirst);
      return;
    }
    const tagIds = Array.from(
      new Set([...placements.map((p) => p.tagId), ...extractTagIds(description, getTag)]),
    ).slice(0, MAX_SLANGTAGS);

    const first = tagIds[0] ? getTag(tagIds[0]) : undefined;
    setPublishing(true);
    const ok = await createPost({
      title: first ? `$${first.name}` : description.trim().slice(0, 40) || t.post,
      description: description.trim(),
      region,
      hashtags,
      imageDataUrl: image,
      audioPath: first?.audioPath ?? null,
      duration: first?.duration ?? "0:02",
      placements,
      slangTagIds: tagIds,
      visibility,
    });
    setPublishing(false);
    if (!ok) {
      toast.error(t.publishFailed);
      return;
    }
    toast.success(t.published);
    setImage(null);
    setDescription("");
    setHashtags([]);
    setPlacements([]);
    setVisibility("public");
    onDone?.();
  };

  const field = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand";

  return (
    <>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Editor */}
        <div className="space-y-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs hover:border-brand/60 hover:text-brand">
            <ImageIcon className="h-3.5 w-3.5" /> {t.uploadImage}
            <input type="file" accept="image/*,image/gif" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
          </label>

          <div>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{t.slangTagHint}</span>
              <span className={maxReached ? "font-bold text-brand" : ""}>
                {t.slangTagsCount}: {tagCount} / {MAX_SLANGTAGS}
              </span>
            </div>
            <SlangTagPicker
              region={region}
              disabled={maxReached}
              onSelect={(tag) => {
                addPlacement(tag.id);
                toast.success(`$${tag.name} ${t.tagPlaced}`);
              }}
            />
            {maxReached && (
              <p className="mt-1 text-[11px] font-semibold text-brand">{t.maxTagsReached}</p>
            )}
            {placements.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {placements.map((p) => {
                  const tag = getTag(p.tagId);
                  return tag ? (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-[11px] text-brand"
                    >
                      ${tag.name}
                      <button
                        type="button"
                        aria-label={`${t.removeTag}: $${tag.name}`}
                        onClick={() => setPlacements((prev) => prev.filter((x) => x.id !== p.id))}
                        className="grid h-3.5 w-3.5 place-items-center rounded-full hover:bg-brand/25"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ) : null;
                })}
              </div>
            )}
          </div>


          {/* Slang Box als Quelle für Drag & Drop */}
          <div className="rounded-xl border border-border bg-background/50 p-2.5">
            <SlangBox onPick={(t) => addPlacement(t.id)} />
          </div>

          <div className="block text-xs text-muted-foreground">
            {t.description}
            <div className={`mt-1 ${field}`}>
              <SlangTagField
                multiline
                rows={3}
                value={description}
                onChange={setDescription}
                region={region}
                placeholder={t.descriptionPh}
                aria-label={t.description}
                className="resize-none text-foreground"
              />
            </div>
          </div>

          <label className="block text-xs text-muted-foreground">
            {t.region}
            <select className={`mt-1 ${field}`} value={region} onChange={(e) => setRegion(e.target.value)}>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          <div className="text-xs text-muted-foreground">
            {t.visibility}
            <div className="mt-1 inline-flex w-full gap-1 rounded-xl border border-border bg-background p-1">
              {(["public", "connections", "private"] as PostVisibility[]).map((v) => {
                const Icon = VISIBILITY_META[v].icon;
                const active = visibility === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVisibility(v)}
                    aria-pressed={active}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] transition-colors ${
                      active ? "bg-brand/15 text-brand" : "text-muted-foreground hover:text-brand"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {visibilityLabel(v, t as unknown as Record<string, string>)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            {t.hashtags}
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
                placeholder={t.hashtagPh}
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

        {/* Vorschau */}
        <div className="rounded-2xl border border-border bg-background/60 p-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {t.preview}
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
              <div className="truncate text-sm font-semibold">{me?.displayName ?? t.me}</div>
              <div className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                <MapPin className="h-3 w-3" /> {region}
              </div>
            </div>
          </div>

          {image ? (
            <div className="mt-3">
              <SlangTagCanvas
                image={image}
                placements={placements}
                editable
                onChange={setPlacements}
                onDropTag={(tagId, x, y) => addPlacement(tagId, x, y)}
              />
            </div>
          ) : (
            <div className="mt-3 grid h-40 place-items-center rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
              {t.previewEmpty}
            </div>
          )}

          {description && (
            <p className="mt-3 text-sm leading-relaxed">
              <SlangText text={description} />
            </p>
          )}

          {!image && placements.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {placements.map((p) => {
                const tag = getTag(p.tagId);
                return tag ? <SlangTagChip key={p.id} tag={tag} variant="compact" /> : null;
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

      <div className="mt-5 flex justify-end">
        <button
          onClick={() => void publish()}
          disabled={publishing}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-brand px-6 py-2 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
        >
          <Send className="h-4 w-4" /> {publishing ? t.saving : t.publish}
        </button>
      </div>
    </>
  );
}

export function CreatePostDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLang();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
      <div className="my-6 w-full max-w-4xl rounded-2xl border border-border bg-surface p-5 shadow-glow">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black tracking-tight">
            {t.composerTitleA} <span className="text-gradient-green">{t.composerTitleB}</span> {t.composerTitleC}
          </h2>
          <button onClick={onClose} aria-label={t.close} className="rounded-full p-1.5 text-muted-foreground hover:text-brand">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5">
          <PostComposer onDone={onClose} />
        </div>
      </div>
    </div>
  );
}
