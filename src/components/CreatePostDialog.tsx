import { useEffect, useRef, useState } from "react";
import { X, Image as ImageIcon, MapPin, Send, Camera, Users, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/lib/data-context";
import { useLang } from "@/lib/lang-context";
import { SlangTagName } from "@/components/SlangTagName";
import { closeKeyboard, noKeyboardProps } from "@/lib/mobile-keyboard";
import { consumeSharedContent, sharedDescription } from "@/lib/share-target";

import { slangTagLabel } from "@/lib/slangtag-rules";
import { SlangTagField, SlangText } from "@/components/SlangTagInput";
import { extractTagIds } from "@/lib/slangtag-ui";
import type { SlangTagPlacement, PostVisibility } from "@/lib/types";
import { VISIBILITY_META, visibilityLabel } from "@/lib/visibility";
import { TagComboField } from "@/components/TagComboField";
import { SlangTagCanvas } from "@/components/SlangTagCanvas";
import { LocationPicker } from "@/components/LocationPicker";
import { DraftTagModeContext } from "@/lib/draft-tags";
import { TagCommitWidget } from "@/components/TagCommitWidget";
import type { TagCommitStatus } from "@/lib/tag-commit-status";

import { REGIONS } from "@/lib/regions";

/** Maximal erlaubte SlangTags pro Beitrag. */
export const MAX_SLANGTAGS = 5;
const MAX_HASHTAGS = 5;

const COMPOSER_OPEN_KEY = "y-dude-composer-open";

/** Beitrags-Editor. Steht im mittleren Bereich dauerhaft zur Verfügung. */
export function PostComposer({
  onDone,
  collapsible = true,
}: {
  onDone?: () => void;
  collapsible?: boolean;
}) {
  const { me, createPost, getTag, isDraftTag, commitDraftTags, discardDraftTags } = useData();
  const { t } = useLang();
  const [publishing, setPublishing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [tagStatus, setTagStatus] = useState<TagCommitStatus | null>(null);

  const [image, setImage] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [region, setRegion] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [placements, setPlacements] = useState<SlangTagPlacement[]>([]);
  const [visibility, setVisibility] = useState<PostVisibility>("public");
  const [locationOpen, setLocationOpen] = useState(false);
  const counter = useRef(0);

  // SlangTag Video (Short): stumme Bildspur, max. 5 s. Der Ton bleibt der SlangTag.
  const [video, setVideo] = useState<{ blob: Blob; seconds: number } | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [videoBusy, setVideoBusy] = useState(false);

  useEffect(() => {
    if (!video) {
      setVideoPreview(null);
      return;
    }
    const url = URL.createObjectURL(video.blob);
    setVideoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [video]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(COMPOSER_OPEN_KEY);
      if (stored === "true") setIsOpen(true);
    } catch {
      // ignore storage errors
    }
  }, []);

  // Andere Apps -> Y-Dude: geteilte Inhalte einmalig in diesen Composer uebernehmen.
  useEffect(() => {
    const shared = consumeSharedContent();
    if (!shared) return;
    if (shared.notice === "unsupported-type") toast.error(t.shareTargetUnsupported);
    else if (shared.notice === "too-large") toast.error(t.shareTargetTooLarge);
    const text = sharedDescription(shared);
    if (!shared.image && !text) return;
    if (shared.image) setImage(shared.image);
    if (text) setDescription((prev) => (prev.trim() ? prev : text));
    setIsOpen(true);
  }, [t]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(COMPOSER_OPEN_KEY, String(isOpen));
    } catch {
      // ignore storage errors
    }
  }, [isOpen]);

  // Beitrag verworfen (zugeklappt, geschlossen oder Seite verlassen):
  // temporaere SlangTags restlos entfernen.
  const discardDraft = useRef(discardDraftTags);
  discardDraft.current = discardDraftTags;
  useEffect(() => () => discardDraft.current(), []);
  useEffect(() => {
    if (!isOpen) discardDraft.current();
  }, [isOpen]);

  const pickFile = (file?: File) => {
    if (!file) return;
    setVideo(null);
    const fr = new FileReader();
    fr.onload = () => setImage(String(fr.result));
    fr.readAsDataURL(file);
  };

  /**
   * Video auswaehlen: wird auf 5 s gekuerzt, der Originalton wird vollstaendig
   * entfernt. Das erste Bild dient als Bildgrundlage (Vorschau, Thumbnail,
   * Teilen-Vorschau) – der Ton des Beitrags ist ausschliesslich der SlangTag.
   */
  const pickVideo = async (file?: File) => {
    if (!file) return;
    if (!shortVideoSupported()) {
      toast.error(t.videoUnsupported);
      return;
    }
    setVideoBusy(true);
    try {
      const prepared = await prepareSilentShort(file, SHORT_VIDEO_MAX_SECONDS);
      if (!prepared || prepared.blob.size > SHORT_VIDEO_MAX_BYTES) {
        toast.error(t.videoFailed);
        return;
      }
      const poster = await shortVideoPoster(prepared.blob);
      if (!poster) {
        toast.error(t.videoFailed);
        return;
      }
      setImage(poster);
      setVideo(prepared);
    } finally {
      setVideoBusy(false);
    }
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

  const addHashtag = (raw: string) => {
    const tag = raw.trim().replace(/^#+/, "");
    if (!tag) return;

    if (hashtags.length >= MAX_HASHTAGS) {
      toast.error(t.maxHashtagsAllowed);
      return;
    }

    const duplicate = hashtags.some(
      (existing) => existing.toLocaleLowerCase() === tag.toLocaleLowerCase(),
    );
    if (!duplicate) setHashtags((prev) => [...prev, tag]);
  };

  const publish = async () => {
    if (!description.trim() && !image && placements.length === 0) {
      toast.error(t.addContentFirst);
      return;
    }
    const draftIds = Array.from(
      new Set([...placements.map((p) => p.tagId), ...extractTagIds(description, getTag)]),
    ).filter(isDraftTag);

    setPublishing(true);
    // Erst jetzt werden neu aufgenommene SlangTags dauerhaft gespeichert.
    // Waehrend Upload und KI-Pruefung fuehrt das Status-Widget durch den
    // Ablauf – Fehlermeldungen erscheinen nur bei echten Fehlern.
    const hasDrafts = draftIds.length > 0;
    if (hasDrafts) setTagStatus({ phase: "upload" });
    const idMap = hasDrafts
      ? await commitDraftTags(draftIds, { silent: true, onStatus: setTagStatus })
      : {};
    if (!idMap) {
      setPublishing(false);
      setTagStatus((prev) =>
        prev && (prev.phase === "error" || prev.phase === "rejected")
          ? prev
          : { phase: "error" as const },
      );
      window.setTimeout(() => setTagStatus(null), 6000);
      return;
    }
    const resolve = (id: string) => idMap[id] ?? id;
    const finalPlacements = placements.map((p) => ({ ...p, tagId: resolve(p.tagId) }));
    const tagIds = Array.from(
      new Set([
        ...finalPlacements.map((p) => p.tagId),
        ...extractTagIds(description, getTag).map(resolve),
      ]),
    ).slice(0, MAX_SLANGTAGS);

    const first = tagIds[0] ? getTag(tagIds[0]) : undefined;
    const ok = await createPost({
      title: first ? `$${first.name}` : description.trim().slice(0, 40) || t.post,
      description: description.trim(),
      region,
      hashtags,
      imageDataUrl: image,
      audioPath: first?.audioPath ?? null,
      duration: first?.duration ?? "0:02",
      placements: finalPlacements,
      slangTagIds: tagIds,
      visibility,
    });
    setPublishing(false);
    if (!ok) {
      setTagStatus(null);
      toast.error(t.publishFailed);
      return;
    }
    if (hasDrafts) {
      setTagStatus({ phase: "success" });
      window.setTimeout(() => setTagStatus(null), 1800);
    }
    toast.success(t.published);
    setImage(null);
    setDescription("");
    setHashtags([]);
    setPlacements([]);
    setVisibility("public");
    setLocationOpen(false);
    setIsOpen(false);
    onDone?.();
  };

  const field =
    "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand";

  const title = (
    <h2 className="text-lg font-black tracking-tight">
      {t.composerTitleA} <span className="text-gradient-green">{t.composerTitleB}</span>{" "}
      {t.composerTitleC}
    </h2>
  );

  const body = (
    <div className="min-h-0 space-y-3 overflow-hidden">
      {/* 1. Bildbereich = Live-Vorschau (WYSIWYG) – immer sichtbar.
          Das SlangTag-Overlay erscheint automatisch, sobald Bild + SlangTag da sind. */}
      <div className="rounded-2xl border border-border bg-background/60 p-3">
        {/* kompakter Ersteller-Kopf wie im Feed */}
        <div className="mb-2 flex items-center gap-2">
          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-brand/50 bg-surface">
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
              <MapPin className="h-3 w-3 shrink-0" /> {region || "—"}
            </div>
          </div>
        </div>

        <div className="relative">
          {image ? (
            <SlangTagCanvas
              image={image}
              placements={placements}
              editable
              pannable
              onChange={setPlacements}
              onDropTag={(tagId, x, y) => addPlacement(tagId, x, y)}
              className="h-[30vh] min-h-[280px] lg:h-[320px]"
            />
          ) : (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const file = e.dataTransfer?.files?.[0];
                if (file && file.type.startsWith("image/")) {
                  e.preventDefault();
                  pickFile(file);
                }
              }}
              className="grid h-[30vh] min-h-[280px] place-items-center rounded-xl border border-dashed border-border px-6 text-center lg:h-[320px]"
            >
              <div className="flex flex-col items-center gap-3">
                <label
                  {...noKeyboardProps}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-gradient-brand px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow"
                >
                  <ImageIcon className="h-4 w-4" /> {t.uploadImage}
                  <input
                    type="file"
                    accept="image/*,image/gif"
                    className="hidden"
                    onChange={(e) => pickFile(e.target.files?.[0])}
                  />
                </label>
                <p className="text-xs text-muted-foreground">{t.dropHint}</p>
                <p className="max-w-xs text-[11px] text-muted-foreground/80">{t.previewEmpty}</p>
              </div>
            </div>
          )}

          {/* Kamera schwebt über dem Bildbereich */}
          <label
            title={t.takePhoto}
            aria-label={t.takePhoto}
            {...noKeyboardProps}
            className="absolute right-3 top-3 z-20 grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-border bg-surface/80 text-muted-foreground backdrop-blur-sm hover:border-brand/60 hover:text-brand"
          >
            <Camera className="h-4 w-4" />
            <input
              type="file"
              accept="image/*,image/gif"
              capture="environment"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
          </label>
        </div>

        {/* Live-Text direkt unter dem Bild – wie im veröffentlichten Beitrag */}
        {(description.trim() || hashtags.length > 0) && (
          <div className="mt-3 space-y-1.5">
            {description.trim() && (
              <p className="text-sm leading-relaxed">
                <SlangText text={description} />
              </p>
            )}
            {hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 text-[11px] text-hashtag">
                {hashtags.map((h) => (
                  <span key={h}>#{h}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Gemeinsames Tag-Feld: # → Hashtag, $ → SlangTag */}
      <div>
        <div className="mb-1 flex flex-wrap items-center justify-end gap-2 text-xs text-muted-foreground">
          <span className={maxReached ? "font-bold text-brand" : ""}>
            {t.slangTagsCount}: {tagCount} / {MAX_SLANGTAGS}
          </span>
          <span aria-hidden="true" className="opacity-40">
            |
          </span>
          <span className={hashtags.length >= MAX_HASHTAGS ? "font-bold text-hashtag" : ""}>
            {t.hashtags}: {hashtags.length} / {MAX_HASHTAGS}
          </span>
        </div>

        <TagComboField
          region={region || REGIONS[0]}
          tagsDisabled={maxReached}
          onSelectTag={(tag) => addPlacement(tag.id)}
          hashtags={hashtags}
          onAddHashtag={addHashtag}
          onRemoveHashtag={(h) => setHashtags((prev) => prev.filter((x) => x !== h))}
        >
          {placements.map((p) => {
            const tag = getTag(p.tagId);
            return tag ? (
              <span
                key={p.id}
                className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-[11px] text-brand"
              >
                <SlangTagName tag={tag} />
                <button
                  type="button"
                  aria-label={`${t.removeTag}: ${slangTagLabel(tag)}`}
                  onClick={() => setPlacements((prev) => prev.filter((x) => x.id !== p.id))}
                  className="grid h-3.5 w-3.5 place-items-center rounded-full hover:bg-brand/25"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ) : null;
          })}
        </TagComboField>
        {maxReached && (
          <p className="mt-1 text-[11px] font-semibold text-brand">{t.maxTagsReached}</p>
        )}
      </div>

      {/* 3. Beschreibung */}
      <div className={field}>
        <SlangTagField
          multiline
          rows={2}
          value={description}
          onChange={setDescription}
          region={region || REGIONS[0]}
          placeholder={t.descriptionPh}
          aria-label={t.description}
          className="resize-none text-foreground"
        />
      </div>

      {/* 4. Standort + Sichtbarkeit + Veröffentlichen */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setLocationOpen((o) => !o)}
              aria-label={t.region}
              aria-expanded={locationOpen}
              title={region || t.region}
              className={`grid h-9 w-9 place-items-center rounded-full border transition-colors ${
                region
                  ? "border-brand bg-brand/15 text-brand shadow-glow"
                  : "border-border bg-background text-muted-foreground hover:border-brand/60 hover:text-brand"
              }`}
            >
              <MapPin className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-0.5 rounded-xl border border-border bg-background p-0.5">
              {(["public", "following", "private"] as PostVisibility[]).map((v) => {
                const Icon = v === "following" ? Users : VISIBILITY_META[v].icon;
                const active = visibility === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVisibility(v)}
                    aria-pressed={active}
                    title={visibilityLabel(v, t as unknown as Record<string, string>)}
                    className={`flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1 text-[10px] transition-colors ${
                      active ? "bg-brand/15 text-brand" : "text-muted-foreground hover:text-brand"
                    }`}
                  >
                    <Icon className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {visibilityLabel(v, t as unknown as Record<string, string>)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            {...noKeyboardProps}
            onClick={() => {
              closeKeyboard();
              void publish();
            }}
            disabled={publishing}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-brand px-6 py-2 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> {publishing ? t.saving : t.publish}
          </button>
        </div>

        <div
          className={`rounded-xl border border-border bg-background p-3 ${locationOpen ? "" : "hidden"}`}
        >
          <LocationPicker
            value={region}
            onChange={(v) => {
              setRegion(v);
              if (v) setLocationOpen(false);
            }}
            manualOptions={REGIONS}
          />
        </div>
      </div>
      {/* Der Editor endet nach Sichtbarkeit + Veröffentlichen.
          SlangBox und SlangTag Manager leben in der Arena. */}
    </div>
  );

  if (!collapsible) {
    return (
      <DraftTagModeContext.Provider value={true}>
        <div className="space-y-4">{body}</div>
        {tagStatus && <TagCommitWidget status={tagStatus} />}
      </DraftTagModeContext.Provider>
    );
  }

  return (
    <DraftTagModeContext.Provider value={true}>
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setIsOpen((o) => !o)}
          aria-expanded={isOpen}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-background/60 px-4 py-3 text-left transition-colors hover:border-brand/60 hover:bg-background"
        >
          {title}
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-brand transition-transform duration-300 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        <div
          aria-hidden={!isOpen}
          className={`grid transition-all duration-300 ease-out ${
            isOpen ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0"
          }`}
        >
          {body}
        </div>
        {tagStatus && <TagCommitWidget status={tagStatus} />}
      </div>
    </DraftTagModeContext.Provider>
  );
}

export function CreatePostDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLang();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto overscroll-contain bg-black/80 p-2 backdrop-blur-sm sm:p-4">
      <div className="my-3 w-full max-w-4xl rounded-2xl border border-border bg-surface p-3 shadow-glow sm:my-6 sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black tracking-tight">
            {t.composerTitleA} <span className="text-gradient-green">{t.composerTitleB}</span>{" "}
            {t.composerTitleC}
          </h2>
          <button
            onClick={onClose}
            aria-label={t.close}
            className="rounded-full p-1.5 text-muted-foreground hover:text-brand"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5">
          <PostComposer onDone={onClose} collapsible={false} />
        </div>
      </div>
    </div>
  );
}
