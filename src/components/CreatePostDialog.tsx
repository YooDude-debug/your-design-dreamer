import { CloseButton } from "@/components/ui/nav-buttons";
import { useEffect, useRef, useState } from "react";
import {
  MapPin,
  Send,
  Camera,
  Video,
  Users,
  ChevronDown,
  Trash2,
  Globe,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/lib/data-context";
import { useLang } from "@/lib/lang-context";
import { closeKeyboard, noKeyboardProps } from "@/lib/mobile-keyboard";
import { lockFeedMode } from "@/lib/feed-mode-lock";

import { consumeSharedContent, sharedDescription } from "@/lib/share-target";

import { SlangTagField, SlangText } from "@/components/SlangTagInput";
import { extractTagIds } from "@/lib/slangtag-ui";
import type { SlangTagPlacement, PostVisibility } from "@/lib/types";
import { VISIBILITY_META, visibilityLabel } from "@/lib/visibility";
import { TagComboField } from "@/components/TagComboField";
import { FeedChannelPicker, type ComposerChannel } from "@/components/composer/FeedChannelPicker";
import { SlangTagOrderStrip } from "@/components/SlangTagOrderStrip";
import { SlangTagCanvas } from "@/components/SlangTagCanvas";
import { cropImageDataUrl, remapPercent, type CropRect } from "@/lib/image-crop";
import { LocationPicker } from "@/components/LocationPicker";
import { DraftTagModeContext } from "@/lib/draft-tags";
import { TagCommitWidget } from "@/components/TagCommitWidget";
import type { TagCommitStatus } from "@/lib/tag-commit-status";

import { REGIONS } from "@/lib/regions";
import {
  clearComposerDraft,
  draftHasContent,
  loadComposerDraft,
  saveComposerDraft,
} from "@/lib/composer-draft";

import { uploadPostVideo } from "@/lib/video/video-upload-client";
import { pickVideoThumbnail } from "@/lib/video/video-thumbnail";
import { type VideoErrorCode } from "@/lib/video/video-file";

/** Maximal erlaubte SlangTags pro Beitrag. */
import { checkImageFile } from "@/lib/image-limits";

export const MAX_SLANGTAGS = 5;
const MAX_HASHTAGS = 5;

const COMPOSER_OPEN_KEY = "y-dude-composer-open";

/** Beitrags-Editor. Steht im mittleren Bereich dauerhaft zur Verfügung. */
export function PostComposer({
  onDone,
  collapsible = true,
  forceOpen = false,
}: {
  onDone?: () => void;
  collapsible?: boolean;
  forceOpen?: boolean;
}) {
  const { me, createPost, getTag, isDraftTag, commitDraftTags, discardDraftTags } = useData();
  const { t } = useLang();
  const [publishing, setPublishing] = useState(false);
  /** Sicherheitsabfrage vor dem endgueltigen Verwerfen des Entwurfs. */
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  /** Gewählter Bildausschnitt (Zoom/Position) aus der Arbeitsfläche. */
  const cropRef = useRef<CropRect | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const effectiveOpen = forceOpen || isOpen;

  const [tagStatus, setTagStatus] = useState<TagCommitStatus | null>(null);

  const [image, setImage] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [region, setRegion] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [placements, setPlacements] = useState<SlangTagPlacement[]>([]);
  /** Schloss der Abspielreihenfolge – Standard: der Ersteller bestimmt sie. */
  const [orderLocked, setOrderLocked] = useState(true);
  const [visibility, setVisibility] = useState<PostVisibility>("public");
  /** Channel-Auswahl: null = nur normaler Feed (Standard „Im Feed“). */
  const [channel, setChannel] = useState<ComposerChannel | null>(null);
  const [locationOpen, setLocationOpen] = useState(false);
  const counter = useRef(0);

  /**
   * Video-Beitrag V1: bereits hochgeladenes und serverseitig abgenommenes
   * Video (max. 60 s, eigener Ton).
   */
  const [postVideo, setPostVideo] = useState<{
    path: string;
    thumbnailPath: string | null;
    durationMs: number;
    width: number;
    height: number;
  } | null>(null);
  const [postVideoPreview, setPostVideoPreview] = useState<string | null>(null);
  const [postVideoBusy, setPostVideoBusy] = useState(false);
  /**
   * Kamera-Einstieg: native Geräte-Kamera über einen versteckten File-Input
   * mit `capture`. Erlaubt sind Foto UND Videoaufnahme – welcher Modus
   * zuerst erscheint, entscheidet das Betriebssystem.
   */
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const openNativeCamera = () => cameraInputRef.current?.click();
  /**
   * Getrennter Einstieg für die Videoaufnahme: eigener versteckter File-Input
   * mit `accept="video/*"` und `capture`. Der Browser kann damit den
   * Videomodus anfordern; ob er tatsächlich direkt startet, entscheidet das
   * Betriebssystem – erzwingen lässt sich das über die Web-API nicht.
   */
  const videoCameraInputRef = useRef<HTMLInputElement>(null);
  const openNativeVideoCamera = () => videoCameraInputRef.current?.click();
  /** Zähler, um das bestehende SlangTag-Feld gezielt zu öffnen. */
  const [focusTag] = useState(0);

  /**
   * Auf- und Zuklappen (sowie die Kameraansicht) verändern die Höhe oberhalb
   * des Feeds. Der Browser verschiebt dabei die Scrollposition selbst – dieser
   * unbeabsichtigte „Scroll nach unten“ darf den Werbefeed nicht andocken
   * lassen. Die Sperre gilt nur, bis das Layout ausgeschwungen ist.
   */
  // Onboarding-Karte ("erste Slang Challenge") kann den Composer öffnen.
  useEffect(() => {
    if (!collapsible) return;
    const onOpen = () => setIsOpen(true);
    window.addEventListener("y-dude:open-composer", onOpen);
    return () => window.removeEventListener("y-dude:open-composer", onOpen);
  }, [collapsible]);

  useEffect(() => {
    const release = lockFeedMode();
    const id = window.setTimeout(release, 800);
    return () => {
      window.clearTimeout(id);
      release();
    };
  }, [effectiveOpen]);

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

  // Beitrag verworfen (zugeklappt oder geschlossen): temporaere SlangTags
  // entfernen.
  const discardDraft = useRef(discardDraftTags);
  discardDraft.current = discardDraftTags;
  useEffect(() => {
    if (!isOpen) discardDraft.current();
  }, [isOpen]);

  /** Autosave erst nach der Wiederherstellung, damit nichts ueberschrieben wird. */
  const [hydrated, setHydrated] = useState(false);

  // Wiederherstellung: Bild, Position und Eingaben zurueckholen.
  useEffect(() => {
    if (hydrated || !me) return;
    let alive = true;
    void (async () => {
      const draft = await loadComposerDraft().catch(() => null);
      if (!alive) return;
      if (!draftHasContent(draft) || !draft) {
        setHydrated(true);
        return;
      }
      if (draft.image) setImage(draft.image);
      setDescription(draft.description);
      setHashtags(draft.hashtags);
      setRegion(draft.region);
      setVisibility(draft.visibility);

      // Temporaere SlangTags werden nicht wiederhergestellt.
      const placements = draft.placements.filter((p) => !p.tagId.startsWith("draft_"));
      setPlacements(placements);
      setIsOpen(true);
      setHydrated(true);
      toast.success(t.draftRestored);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, hydrated]);

  /**
   * Bild uebernehmen: erst Sicherheitspruefung (Dateigroesse, Auflösung,
   * Seitenverhaeltnis) aus dem Dateikopf, danach Verarbeitung. So wird ein
   * extrem grosses Bild nie vollstaendig geladen.
   */
  const pickFile = async (file?: File) => {
    if (!file) return;
    const check = await checkImageFile(file);
    if (!check.ok) {
      toast.error(
        check.reason === "bytes"
          ? t.imageTooBig
          : check.reason === "ratio"
            ? t.imageTooLong
            : t.imageTooLarge,
      );
      return;
    }
    clearPostVideo();
    const fr = new FileReader();
    fr.onload = () => setImage(String(fr.result));
    fr.readAsDataURL(file);
  };

  /** Fehlermeldung der Videoprüfung in die Sprache des Nutzers übersetzen. */
  const videoErrorText = (code: VideoErrorCode) =>
    code === "unsupported_format"
      ? t.postVideoErrUnsupported
      : code === "too_long"
        ? t.postVideoErrTooLong
        : code === "too_large"
          ? t.postVideoErrTooLarge
          : code === "invalid_file"
            ? t.postVideoErrInvalid
            : t.postVideoErrFailed;

  /** Bereits hochgeladenes Video aus dem Entwurf entfernen. */
  const clearPostVideo = () => {
    setPostVideo(null);
    setPostVideoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  /**
   * Video-Beitrag V1: Datei über die bestehende Video-Upload-Infrastruktur
   * hochladen und serverseitig abnehmen lassen (Dauer, Maße, Format). Das
   * Thumbnail wird dabei automatisch erzeugt und dient hier zugleich als
   * Standbild des Beitrags.
   */
  const pickPostVideo = async (file: File) => {
    if (!me) return;
    setPostVideoBusy(true);
    try {
      const result = await uploadPostVideo(me.id, file);
      if (!result.ok) {
        toast.error(videoErrorText(result.code));
        return;
      }
      const thumb = await pickVideoThumbnail(file).catch(() => null);
      if (thumb) {
        const dataUrl = await new Promise<string | null>((resolve) => {
          const fr = new FileReader();
          fr.onload = () => resolve(String(fr.result));
          fr.onerror = () => resolve(null);
          fr.readAsDataURL(thumb);
        });
        if (dataUrl) setImage(dataUrl);
      }
      clearPostVideo();
      setPostVideoPreview(URL.createObjectURL(file));
      setPostVideo({
        path: result.path,
        thumbnailPath: result.thumbnailPath,
        durationMs: result.durationMs,
        width: result.width,
        height: result.height,
      });
      toast.success(t.postVideoReady);
    } finally {
      setPostVideoBusy(false);
    }
  };

  /**
   * Einstiegs-Upload für Bild, GIF und Video (auch aus der Kamera).
   * Videodateien werden zum Video-Beitrag (V1, max. 60 s).
   */
  const handleUpload = (file?: File) => {
    if (!file) return;
    if (file.type.startsWith("video/")) {
      void pickPostVideo(file);
    } else if (file.type.startsWith("image/")) {
      void pickFile(file);
    } else {
      toast.error(t.shareTargetUnsupported);
    }
  };

  /**
   * Autosave: nach jeder relevanten Aenderung (SlangTag gesetzt, verschoben,
   * geloescht, Text/Standort) wird der Entwurf lokal gespeichert.
   */
  useEffect(() => {
    if (!hydrated) return;
    const payload = {
      image,
      video: null,
      shotTag: null,
      shotTagId: null,
      placements,
      description,
      hashtags,
      region,
      visibility,
    };
    const timer = window.setTimeout(() => {
      if (!draftHasContent({ ...payload, savedAt: 0 })) {
        void clearComposerDraft();
        return;
      }
      void saveComposerDraft(payload);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [hydrated, image, placements, description, hashtags, region, visibility]);

  /**
   * Entwurf ausdruecklich verwerfen.
   *
   * Es werden ausschliesslich die Daten dieses Entwurfs entfernt: lokal
   * gespeicherter Entwurf (IndexedDB), Bild/Video, der automatisch aus dem
   * Video erzeugte temporaere SlangTag inkl. Audio (Draft-SlangTags leben nur
   * im Speicher und wurden noch nicht hochgeladen), Platzierung, Zoom-/Crop-
   * Daten und die Eingabefelder. Bereits veroeffentlichte Beitraege, Medien
   * und SlangTags aus der Bibliothek bleiben unberuehrt – es entstehen dabei
   * keine Storage-Dateien, die zurueckbleiben koennten.
   */
  const discardComposerDraft = async () => {
    if (discarding) return;
    setDiscarding(true);
    try {
      // 1. Entwurf aus der lokalen Datenbank entfernen (keine Wiederherstellung).
      await clearComposerDraft();
    } catch {
      // Bestehende Fehlerbehandlung: Composer NICHT als geleert darstellen.
      setDiscarding(false);
      setConfirmDiscard(false);
      toast.error(t.draftDiscardFailed);
      return;
    }
    // 2. Wiedergabe stoppen und temporaere SlangTags dieses Entwurfs loeschen.
    discardDraftTags();
    // 3. Composer vollstaendig zuruecksetzen.
    cropRef.current = null;
    setImage(null);
    clearPostVideo();
    setPlacements([]);
    setDescription("");
    setHashtags([]);
    setRegion("");
    setVisibility("public");
    setChannel(null);
    setLocationOpen(false);
    setTagStatus(null);
    setDiscarding(false);
    setConfirmDiscard(false);
    toast.success(t.draftDiscarded);
  };

  const tagCount = placements.length;
  const maxReached = tagCount >= MAX_SLANGTAGS;

  /** SlangTags in der aktuellen Abspielreihenfolge (Reihenfolge der Platzierungen). */
  const orderedTags = placements
    .map((p) => getTag(p.tagId))
    .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag));

  /** Neue Abspielreihenfolge: nur die Platzierungen werden umsortiert. */
  const reorderPlacements = (ids: string[]) =>
    setPlacements((prev) =>
      ids
        .map((id) => prev.find((p) => p.tagId === id))
        .filter((p): p is SlangTagPlacement => Boolean(p))
        .concat(prev.filter((p) => !ids.includes(p.tagId))),
    );

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
    // Doppelte Veröffentlichung ausschließen (Doppelklick, Enter + Klick).
    if (publishing) return;
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

    // Video-Beiträge (V1) haben eine eigene Tonspur und brauchen keinen SlangTag.

    // Gewählter Bildausschnitt wird übernommen (Zoom + Position gehen nicht verloren).
    const crop = postVideo ? null : cropRef.current;
    const imageDataUrl = image && crop ? await cropImageDataUrl(image, crop) : image;
    const croppedPlacements = crop
      ? finalPlacements.map((p) => ({ ...p, ...remapPercent(p.x, p.y, crop) }))
      : finalPlacements;

    const first = tagIds[0] ? getTag(tagIds[0]) : undefined;
    const ok = await createPost({
      title: first ? `$${first.name}` : description.trim().slice(0, 40) || t.post,
      description: description.trim(),
      region,
      hashtags,
      // Channel zusätzlich zum normalen Feed (`posts.channel_id`).
      channelId: channel?.id ?? null,
      imageDataUrl: imageDataUrl,
      audioPath: first?.audioPath ?? null,
      duration: first?.duration ?? "0:02",
      placements: croppedPlacements,
      slangTagIds: tagIds,
      slangtagOrderLocked: orderLocked,
      visibility,
      videoBlob: null,
      // Video-Beitrag V1: bereits geprüfter Speicherpfad statt neuem Upload.
      videoPath: postVideo?.path ?? null,
      videoThumbnailPath: postVideo?.thumbnailPath ?? null,
      videoDurationMs: postVideo ? postVideo.durationMs : null,
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
    setChannel(null);
    void clearComposerDraft();
    setImage(null);

    clearPostVideo();
    setDescription("");
    setHashtags([]);
    setPlacements([]);
    setVisibility("public");
    setLocationOpen(false);
    setIsOpen(false);
    onDone?.();
  };

  const field =
    "w-full rounded-xl border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-brand";

  const title = (
    <h2 className="text-lg font-black tracking-tight">
      {t.composerTitleA} <span className="text-gradient-green">{t.composerTitleB}</span>{" "}
      {t.composerTitleC}
    </h2>
  );

  const body = (
    <div className="min-h-0 space-y-2 overflow-hidden">
      {/* 1. Bildbereich = Live-Vorschau (WYSIWYG) – immer sichtbar.
          Das SlangTag-Overlay erscheint automatisch, sobald Bild + SlangTag da sind. */}
      <div className="rounded-2xl border border-border bg-background/60 p-2">
        {/* kompakter Ersteller-Kopf wie im Feed */}
        <div className="mb-1.5 flex items-center gap-2">
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
            <>
              <SlangTagCanvas
                image={image}
                video={postVideoPreview}
                videoWithSound={!!postVideo}
                placements={placements}
                editable
                pannable
                onChange={setPlacements}
                onDropTag={(tagId, x, y) => addPlacement(tagId, x, y)}
                onCropChange={(c) => {
                  cropRef.current = c;
                }}
                className="h-[30vh] min-h-[280px] lg:h-[320px]"
              />
              {postVideo && (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-border bg-black/60 px-3 py-2">
                  <span className="truncate text-[11px] text-muted-foreground">
                    {t.postVideoLabel} · {(postVideo.durationMs / 1000).toFixed(1)}s ·{" "}
                    {postVideo.width}×{postVideo.height}
                  </span>
                  <button
                    type="button"
                    onClick={clearPostVideo}
                    className="shrink-0 rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-brand/60 hover:text-brand"
                  >
                    {t.postVideoRemove}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const file = e.dataTransfer?.files?.[0];
                if (!file) return;
                if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
                  e.preventDefault();
                  handleUpload(file);
                }
              }}
              className="grid h-[18vh] min-h-[160px] place-items-center rounded-xl border border-dashed border-border px-4 text-center lg:h-[190px]"
            >
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                  {/* Kamera (Foto) – unverändert. */}
                  <button
                    type="button"
                    {...noKeyboardProps}
                    title={t.takePhoto}
                    aria-label={t.takePhoto}
                    onClick={openNativeCamera}
                    disabled={postVideoBusy}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/80 px-3 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-sm hover:border-brand/60 hover:text-brand disabled:opacity-40"
                  >
                    <Camera className="h-3.5 w-3.5" /> {t.takePhoto}
                  </button>

                  {/* Videokamera – eigener Video-Capture-Input. */}
                  <button
                    type="button"
                    {...noKeyboardProps}
                    title={t.takeVideo}
                    aria-label={t.takeVideo}
                    onClick={openNativeVideoCamera}
                    disabled={postVideoBusy}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/80 px-3 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-sm hover:border-brand/60 hover:text-brand disabled:opacity-40"
                  >
                    <Video className="h-3.5 w-3.5" /> {t.takeVideo}
                  </button>
                </div>

                {/* Einziger Upload-Einstieg für Video, Bild und GIF. */}
                <label
                  {...noKeyboardProps}
                  className={`inline-flex items-center gap-2 rounded-full bg-gradient-brand px-5 py-2 text-sm font-semibold text-primary-foreground shadow-glow ${postVideoBusy ? "pointer-events-none opacity-40" : "cursor-pointer"}`}
                >
                  {postVideoBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Globe className="h-4 w-4" />
                  )}
                  {postVideoBusy ? t.postVideoBusy : t.uploadImage}
                  <input
                    type="file"
                    accept="image/*,image/gif,video/mp4,video/quicktime,video/x-m4v"
                    className="hidden"
                    disabled={postVideoBusy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      handleUpload(file);
                    }}
                  />
                </label>
                <p className="text-[11px] text-muted-foreground">{t.postVideoHint}</p>

                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
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
              </div>
            </div>
          )}

          {/* Kamera-Aktion im Vorschau-Zustand weiterhin oben rechts. */}
          {image && (
            <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
              <button
                type="button"
                {...noKeyboardProps}
                title={t.takePhoto}
                aria-label={t.takePhoto}
                onClick={openNativeCamera}
                disabled={postVideoBusy}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/80 px-3 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-sm hover:border-brand/60 hover:text-brand disabled:opacity-40"
              >
                <Camera className="h-3.5 w-3.5" /> {t.takePhoto}
              </button>
              <button
                type="button"
                {...noKeyboardProps}
                title={t.takeVideo}
                aria-label={t.takeVideo}
                onClick={openNativeVideoCamera}
                disabled={postVideoBusy}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/80 px-3 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-sm hover:border-brand/60 hover:text-brand disabled:opacity-40"
              >
                <Video className="h-3.5 w-3.5" /> {t.takeVideo}
              </button>
            </div>
          )}

          {/*
            Native Geräte-Kamera: Foto ODER Videoaufnahme. Der Startmodus lässt
            sich per Browser-API nicht erzwingen – das Betriebssystem
            entscheidet, welcher Modus zuerst erscheint.
          */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*,video/mp4,video/quicktime,video/x-m4v"
            capture="environment"
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              handleUpload(file);
            }}
          />

          {/*
            Separater Video-Capture-Input: fordert per `accept="video/*"` und
            `capture` die Videoaufnahme der Geräte-Kamera an. Das Ergebnis
            läuft durch denselben Video-V1-Flow (max. 60 s, max. 50 MB,
            MP4/MOV-Validierung, Ton bleibt erhalten).
          */}
          <input
            ref={videoCameraInputRef}
            type="file"
            accept="video/*,video/mp4,video/quicktime,video/x-m4v"
            capture="environment"
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              // Manche Geräte liefern einen leeren MIME-Typ – dann trotzdem
              // den Video-Pfad nutzen, die Validierung prüft die Datei selbst.
              if (file.type && !file.type.startsWith("video/")) {
                handleUpload(file);
                return;
              }
              void pickPostVideo(file);
            }}
          />
        </div>

        {/* Live-Text direkt unter dem Bild – wie im veröffentlichten Beitrag */}
        {(description.trim() || hashtags.length > 0) && (
          <div className="mt-2 space-y-1">
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
        {image && (
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
        )}

        <TagComboField
          region={region || REGIONS[0]}
          tagsDisabled={maxReached}
          onSelectTag={(tag) => addPlacement(tag.id)}
          hashtags={hashtags}
          onAddHashtag={addHashtag}
          onRemoveHashtag={(h) => setHashtags((prev) => prev.filter((x) => x !== h))}
          focusSignal={focusTag}
        />
        {maxReached && (
          <p className="mt-1 text-[11px] font-semibold text-brand">{t.maxTagsReached}</p>
        )}

        {/* Ausgewählte SlangTags erscheinen nur hier: sortieren, entfernen, Play All */}
        {orderedTags.length > 0 && (
          <SlangTagOrderStrip
            className="mt-2"
            owner="composer-order"
            tags={orderedTags}
            sortable={orderedTags.length > 1}
            onReorder={reorderPlacements}
            onRemove={(tagId) => setPlacements((prev) => prev.filter((p) => p.tagId !== tagId))}
            lock={{ locked: orderLocked, onToggle: () => setOrderLocked((v) => !v) }}
          />
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
      <div className="space-y-2">
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

          <div className="flex items-stretch gap-2">
            {/* Entwurf verwerfen – bewusst neben "Veröffentlichen". */}
            <button
              {...noKeyboardProps}
              type="button"
              onClick={() => {
                closeKeyboard();
                setConfirmDiscard(true);
              }}
              disabled={publishing || discarding || postVideoBusy}
              aria-label={t.discardDraft}
              title={t.discardDraft}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-destructive/60 bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4 shrink-0" />
            </button>

            {/* Im Feed (Standard) bzw. zusätzlich ein Channel */}
            <FeedChannelPicker
              value={channel}
              onChange={setChannel}
              disabled={publishing || discarding || postVideoBusy}
            />

            <button
              {...noKeyboardProps}
              onClick={() => {
                closeKeyboard();
                void publish();
              }}
              disabled={publishing || discarding || postVideoBusy}
              className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-gradient-brand px-4 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
            >
              <Send className="h-4 w-4 shrink-0" />{" "}
              <span className="truncate">{publishing ? t.saving : t.postNow}</span>
            </button>
          </div>
        </div>

        {/* Sicherheitsabfrage: erst nach Bestätigung wird endgültig gelöscht. */}
        {confirmDiscard && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-4 shadow-glow">
              <h3 className="text-base font-black">{t.discardDraftConfirmTitle}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t.discardDraftConfirmBody}</p>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDiscard(false)}
                  disabled={discarding}
                  className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={() => void discardComposerDraft()}
                  disabled={discarding}
                  className="inline-flex items-center gap-2 rounded-full bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
                >
                  {discarding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {t.discardDraftConfirmAction}
                </button>
              </div>
            </div>
          </div>
        )}

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
        <div className="space-y-3">{body}</div>
        {tagStatus && <TagCommitWidget status={tagStatus} />}
      </DraftTagModeContext.Provider>
    );
  }

  return (
    <DraftTagModeContext.Provider value={true}>
      <div className="space-y-3">
        {!forceOpen && (
          <button
            type="button"
            onClick={() => setIsOpen((o) => !o)}
            aria-expanded={effectiveOpen}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-background/60 px-4 py-3 text-left transition-colors hover:border-brand/60 hover:bg-background"
          >
            {title}
            <ChevronDown
              className={`h-5 w-5 shrink-0 text-brand transition-transform duration-300 ${
                effectiveOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        )}

        <div
          aria-hidden={!effectiveOpen}
          className={`grid transition-all duration-300 ease-out ${
            effectiveOpen
              ? "grid-rows-[1fr] opacity-100"
              : "pointer-events-none grid-rows-[0fr] opacity-0"
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
          <CloseButton onClick={onClose} label={t.close} />
        </div>
        <div className="mt-3">
          <PostComposer onDone={onClose} collapsible={false} />
        </div>
      </div>
    </div>
  );
}
