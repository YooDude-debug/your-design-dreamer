import { useEffect, useRef, useState } from "react";
import { X, Image as ImageIcon, Hash, Save } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/lib/data";
import { useLang } from "@/lib/i18n";
import { SlangTagField, extractTagIds } from "@/components/SlangTagInput";
import type { Post, SlangTagPlacement, PostVisibility } from "@/lib/types";
import { VISIBILITY_META, visibilityLabel } from "@/components/VisibilityBadge";
import { SlangTagPicker } from "@/components/SlangTagPicker";
import { SlangTagCanvas } from "@/components/SlangTagCanvas";
import { MAX_SLANGTAGS, REGIONS } from "@/components/CreatePostDialog";

/** Editor für einen bereits veröffentlichten eigenen Beitrag. */
export function PostEditDialog({ post, onClose }: { post: Post | null; onClose: () => void }) {
  const { t } = useLang();
  const { getTag, updatePost } = useData();
  const [saving, setSaving] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [imageChanged, setImageChanged] = useState(false);
  const [description, setDescription] = useState("");
  const [region, setRegion] = useState(REGIONS[0]);
  const [hashtagInput, setHashtagInput] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [placements, setPlacements] = useState<SlangTagPlacement[]>([]);
  const [visibility, setVisibility] = useState<PostVisibility>("public");
  const counter = useRef(0);

  useEffect(() => {
    if (!post) return;
    setImage(post.image);
    setImageChanged(false);
    setDescription(post.description);
    setRegion(post.region || REGIONS[0]);
    setHashtags(post.hashtags);
    setPlacements(post.placements.slice(0, MAX_SLANGTAGS));
    setVisibility(post.visibility);
    setHashtagInput("");
  }, [post]);

  if (!post) return null;

  const tagCount = placements.length;
  const maxReached = tagCount >= MAX_SLANGTAGS;

  const pickFile = (file?: File) => {
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => {
      setImage(String(fr.result));
      setImageChanged(true);
    };
    fr.readAsDataURL(file);
  };

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
            { id: `pl_${Date.now()}_${counter.current}`, tagId, x, y, scale: 1, rotation: 0, variant: "compact" },
          ],
    );
  };

  const addHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#/, "");
    if (!tag) return;
    setHashtags((prev) => Array.from(new Set([...prev, tag])).slice(0, 8));
    setHashtagInput("");
  };

  const save = async () => {
    const tagIds = Array.from(
      new Set([...placements.map((p) => p.tagId), ...extractTagIds(description, getTag)]),
    ).slice(0, MAX_SLANGTAGS);
    const first = tagIds[0] ? getTag(tagIds[0]) : undefined;
    setSaving(true);
    const ok = await updatePost(post.id, {
      title: first ? `$${first.name}` : description.trim().slice(0, 40) || t.post,
      description: description.trim(),
      region,
      hashtags,
      placements,
      slangTagIds: tagIds,
      visibility,
      ...(imageChanged ? { imageDataUrl: image } : {}),
    });
    setSaving(false);
    if (!ok) {
      toast.error(t.updateFailed);
      return;
    }
    toast.success(t.postUpdated);
    onClose();
  };

  const field = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand";

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
      <div className="my-6 w-full max-w-3xl rounded-2xl border border-border bg-surface p-5 shadow-glow">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black tracking-tight">{t.editPostTitle}</h2>
          <button onClick={onClose} aria-label={t.close} className="rounded-full p-1.5 text-muted-foreground hover:text-brand">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="space-y-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs hover:border-brand/60 hover:text-brand">
              <ImageIcon className="h-3.5 w-3.5" /> {t.replaceImage}
              <input type="file" accept="image/*,image/gif" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
            </label>

            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{t.slangTagHint}</span>
                <span className={maxReached ? "font-bold text-brand" : ""}>
                  {t.slangTagsCount}: {tagCount} / {MAX_SLANGTAGS}
                </span>
              </div>
              <SlangTagPicker region={region} disabled={maxReached} onSelect={(tag) => addPlacement(tag.id)} />
              {maxReached && <p className="mt-1 text-[11px] font-semibold text-brand">{t.maxTagsReached}</p>}
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
                {Array.from(new Set([region, ...REGIONS])).map((r) => (
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
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t.preview}</div>
            {image ? (
              <SlangTagCanvas
                image={image}
                placements={placements}
                editable
                onChange={setPlacements}
                onDropTag={(tagId, x, y) => addPlacement(tagId, x, y)}
              />
            ) : (
              <div className="grid h-40 place-items-center rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
                {t.previewEmpty}
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border px-5 py-2 text-sm text-muted-foreground hover:text-foreground">
            {t.cancel}
          </button>
          <button
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-brand px-6 py-2 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {saving ? t.saving : t.save}
          </button>
        </div>
      </div>
    </div>
  );
}
