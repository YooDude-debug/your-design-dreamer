import { CloseButton } from "@/components/ui/nav-buttons";
import { useEffect, useRef, useState } from "react";
import {
  MapPin,
  Send,
  Camera,
  Users,
  ChevronDown,
  Video,
  Volume2,
  Pause,
  Trash2,
  Plus,
  Globe,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/lib/data-context";
import { useLang } from "@/lib/lang-context";
import { SlangTagName } from "@/components/SlangTagName";
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
import { VideoCaptureOverlay } from "@/components/VideoCaptureOverlay";
import { PhotoCaptureOverlay } from "@/components/PhotoCaptureOverlay";

import { extractShotAudio, shotTagName } from "@/lib/video/slangshot-audio";
import { useShotSync } from "@/lib/video/use-shot-sync";
import { ShotPlayButton } from "@/components/ShotPlayButton";
import { SLANGTAG_MAX_SECONDS, type ConvertedAudio } from "@/lib/audio-format";
import {
  SHORT_VIDEO_MAX_BYTES,
  SHORT_VIDEO_MAX_SECONDS,
  prepareSilentShort,
  shortVideoMs,
  shortVideoPoster,
  shortVideoSupported,
} from "@/lib/video/short-video";

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
  const {
    me,
    myTags,
    createPost,
    getTag,
    isDraftTag,
    addDraftTag,
    draftTags,
    commitDraftTags,
    discardDraftTags,
  } = useData();
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

  // SlangTag Video (Short): stumme Bildspur, max. 5 s. Der Ton bleibt der SlangTag.
  const [video, setVideo] = useState<{ blob: Blob; seconds: number } | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [videoBusy, setVideoBusy] = useState(false);
  /** true, solange aus der Aufnahme der SlangTag entsteht (keine Wiedergabe). */
  const [shotProcessing, setShotProcessing] = useState(false);
  const [capturing, setCapturing] = useState(false);
  /** Fotoaufnahme direkt im Composer-Medienbereich. */
  const [photoCapturing, setPhotoCapturing] = useState(false);
  /** true, solange Kamera oder SlangShot im Medienbereich läuft (Bereich rollt aus). */
  const captureActive = capturing || photoCapturing;
  /** Zähler, um das bestehende SlangTag-Feld gezielt zu öffnen. */
  const [focusTag, setFocusTag] = useState(0);
  /**
   * Die Vorschau-Wiedergabe des SlangTag-Tons läuft ausschließlich über
   * `useShotSync` (Video = Master). Ein eigener Audio-Kanal existiert hier
   * bewusst nicht mehr.
   */

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
  }, [effectiveOpen, captureActive]);

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

  // Beitrag verworfen (zugeklappt oder geschlossen): temporaere SlangTags
  // entfernen. Ein SlangShot-Entwurf bleibt erhalten – er wird lokal
  // gespeichert und nach einem Reload wiederhergestellt.
  const discardDraft = useRef(discardDraftTags);
  discardDraft.current = discardDraftTags;
  const hasShot = useRef(false);
  hasShot.current = !!video;
  useEffect(() => {
    if (!isOpen && !hasShot.current) discardDraft.current();
  }, [isOpen]);

  /** Autosave erst nach der Wiederherstellung, damit nichts ueberschrieben wird. */
  const [hydrated, setHydrated] = useState(false);
  const addDraftRef = useRef(addDraftTag);
  addDraftRef.current = addDraftTag;

  // Wiederherstellung: Video, SlangTag (Ton), Position und Eingaben zurueckholen.
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
      if (draft.video) setVideo(draft.video);
      setDescription(draft.description);
      setHashtags(draft.hashtags);
      setRegion(draft.region);
      setVisibility(draft.visibility);

      let placements = draft.placements;
      if (draft.shotTag) {
        // Der Ton des SlangShots wird als temporaerer SlangTag neu angelegt.
        const tag = addDraftRef.current({
          name: draft.shotTag.name,
          audioDataUrl: draft.shotTag.audioDataUrl,
          duration: draft.shotTag.duration,
          region: draft.shotTag.region,
        });
        if (tag)
          placements = placements.map((p) =>
            p.tagId.startsWith("draft_") ? { ...p, tagId: tag.id } : p,
          );
        else placements = placements.filter((p) => !p.tagId.startsWith("draft_"));
      } else {
        placements = placements.filter((p) => !p.tagId.startsWith("draft_"));
      }
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
    setVideo(null);
    const fr = new FileReader();
    fr.onload = () => setImage(String(fr.result));
    fr.readAsDataURL(file);
  };

  /**
   * SlangShot auswählen (Upload): wird auf 5 s gekürzt, die vorhandene
   * Tonspur wird zur Grundlage eines SlangTag-Drafts und danach vollständig
   * aus dem Video entfernt. Das erste Bild bleibt die Bildgrundlage.
   */
  const pickVideo = async (file?: File) => {
    if (!file) return;
    if (!shortVideoSupported()) {
      toast.error(t.videoUnsupported);
      return;
    }
    setVideoBusy(true);
    try {
      await applyShot(file);
    } finally {
      setVideoBusy(false);
    }
  };

  /**
   * Einstiegs-Upload für Bild, GIF und SlangShot-Video. Weiterleitung an die
   * jeweils passende bestehende Verarbeitung.
   */
  const handleUpload = (file?: File) => {
    if (!file) return;
    if (file.type.startsWith("video/")) {
      void pickVideo(file);
    } else if (file.type.startsWith("image/")) {
      void pickFile(file);
    } else {
      toast.error(t.shareTargetUnsupported);
    }
  };

  /**
   * Nach einer Videoaufnahme automatisch einen SlangTag auf das Video legen.
   * Vorhandener/ausgewählter SlangTag wird bevorzugt, sonst der neueste eigene
   * SlangTag – ist keiner vorhanden, öffnet sich die bestehende Auswahl.
   */
  const autoAttachTag = () => {
    if (placements.length > 0) return;
    const own = myTags.find((tag) => !!tag.audio) ?? myTags[0];
    if (own) {
      addPlacement(own.id);
      toast.success(t.videoTagAutoAdded);
      return;
    }
    toast.info(t.videoPickTag);
    setFocusTag((n) => n + 1);
  };

  /**
   * Aus der Tonspur der Aufnahme entsteht ein SlangTag-Draft (bestehende
   * Draft-Architektur). Dauerhaft gespeichert wird er erst beim
   * Veroeffentlichen des SlangShots.
   */
  const attachShotTag = (audio: ConvertedAudio) => {
    const tag = addDraftTag({
      name: shotTagName([...myTags, ...draftTags]),
      audioDataUrl: audio.dataUrl,
      duration: audio.duration,
      region: region || REGIONS[0],
    });
    if (!tag) {
      toast.info(t.videoPickTag);
      setFocusTag((n) => n + 1);
      return;
    }
    counter.current += 1;
    setPlacements([
      {
        id: `pl_${Date.now()}_${counter.current}`,
        tagId: tag.id,
        x: 50,
        y: 78,
        scale: 1,
        rotation: 0,
        variant: "compact",
      },
    ]);
    toast.success(t.shotAudioReady);
  };

  /**
   * Zentraler SlangShot-Ablauf (Kamera und Upload):
   * Tonspur extrahieren → SlangTag-Draft → Video stumm uebernehmen.
   */
  const applyShot = async (raw: Blob) => {
    setShotProcessing(true);
    try {
      const prepared = await prepareSilentShort(raw, SHORT_VIDEO_MAX_SECONDS);
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

      const result = await extractShotAudio(raw, SLANGTAG_MAX_SECONDS);
      if (result.status === "ok") {
        attachShotTag(result.audio);
        return;
      }
      if (result.status === "no-audio") toast.info(t.shotNoAudio);
      else toast.error(t.shotAudioFailed);
      autoAttachTag();
    } finally {
      setShotProcessing(false);
    }
  };

  /** Erster platzierter SlangTag – er ist der Ton des Videos. */
  const videoTag = placements[0] ? getTag(placements[0].tagId) : undefined;

  /**
   * Autosave: nach jeder relevanten Aenderung (Aufnahme, SlangTag erzeugt,
   * verschoben, ersetzt, geloescht, Text/Standort) wird der Entwurf lokal
   * gespeichert – nicht erst beim Veroeffentlichen.
   */
  useEffect(() => {
    if (!hydrated) return;
    const shotDraft =
      videoTag && isDraftTag(videoTag.id) && videoTag.audio
        ? {
            name: videoTag.name,
            audioDataUrl: videoTag.audio,
            duration: videoTag.duration,
            region: videoTag.region,
          }
        : null;
    const payload = {
      image,
      video,
      shotTag: shotDraft,
      shotTagId: videoTag && !isDraftTag(videoTag.id) ? videoTag.id : null,
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
  }, [
    hydrated,
    image,
    video,
    videoTag,
    isDraftTag,
    placements,
    description,
    hashtags,
    region,
    visibility,
  ]);

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
    setVideo(null);
    setPlacements([]);
    setDescription("");
    setHashtags([]);
    setRegion("");
    setVisibility("public");
    setChannel(null);
    setLocationOpen(false);
    setTagStatus(null);
    setShotProcessing(false);
    setVideoBusy(false);
    setDiscarding(false);
    setConfirmDiscard(false);
    toast.success(t.draftDiscarded);
  };

  /**
   * SlangShot-Vorschau: Video (Master) und SlangTag-Audio starten gemeinsam
   * bei 0. Solange der SlangTag erzeugt wird, ist keine Wiedergabe moeglich.
   */
  const shot = useShotSync({
    audioSrc: video ? (videoTag?.audio ?? null) : null,
    videoSrc: videoPreview,
    processing: shotProcessing || videoBusy,
    loop: false,
  });

  /** SlangTag löschen: Ton und sichtbares Element entfernen, Video bleibt. */
  const removeVideoTag = () => {
    const first = placements[0];
    // Ein automatisch erzeugter Draft wird nicht weiter verwendet.
    if (first && isDraftTag(first.tagId)) discardDraftTags([first.tagId]);
    setPlacements((prev) => prev.slice(1));
  };

  /** SlangTag ersetzen: bestehende Auswahl oeffnen, Video bleibt unveraendert. */
  const replaceVideoTag = () => {
    removeVideoTag();
    setFocusTag((n) => n + 1);
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

    // SlangTag Videos sind stumm – ohne SlangTag gaebe es keinen Ton.
    if (video && tagIds.length === 0) {
      setPublishing(false);
      setTagStatus(null);
      toast.error(t.needTagForVideo);
      return;
    }

    // Gewählter Bildausschnitt wird übernommen (Zoom + Position gehen nicht verloren).
    const crop = video ? null : cropRef.current;
    const imageDataUrl = image && crop ? await cropImageDataUrl(image, crop) : image;
    const croppedPlacements = crop
      ? finalPlacements.map((p) => ({ ...p, ...remapPercent(p.x, p.y, crop) }))
      : finalPlacements;

    const first = tagIds[0] ? getTag(tagIds[0]) : undefined;
    const ok = await createPost({
      title: first ? `$${first.name}` : description.trim() || t.post,
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
      videoBlob: video?.blob ?? null,
      videoDurationMs: video ? shortVideoMs(video.seconds) : null,
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
    setVideo(null);
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
          {shotProcessing && (
            <div className="absolute inset-0 z-50 grid place-items-center rounded-xl bg-black/90 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
                <span className="text-sm font-medium text-brand">{t.shotProcessing}</span>
              </div>
            </div>
          )}
          {image ? (
            <>
              <SlangTagCanvas
                image={image}
                video={videoPreview}
                videoRef={shot.videoRef}
                videoControlled
                videoLoop={false}
                overlay={
                  video && videoTag ? (
                    <ShotPlayButton
                      playing={shot.playing}
                      preparing={shot.preparing}
                      onToggle={shot.toggle}
                      label={t.play}
                      pauseLabel={t.pause}
                    />
                  ) : undefined
                }
                activeTagId={video && videoTag ? videoTag.id : null}
                activePlaying={shot.playing}
                activeMedia={shot.audioRef.current}
                onActiveToggle={video && videoTag ? shot.toggle : undefined}
                placements={placements}
                editable
                pannable
                onChange={setPlacements}
                onDropTag={(tagId, x, y) => addPlacement(tagId, x, y)}
                onCropChange={(c) => {
                  cropRef.current = c;
                }}
                className={
                  captureActive
                    ? "h-[62vh] min-h-[420px] lg:h-[520px]"
                    : "h-[30vh] min-h-[280px] lg:h-[320px]"
                }
              />
              {video && !captureActive && (
                <div className="mt-2 space-y-2 rounded-xl border border-border bg-black/60 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] text-muted-foreground">
                      {t.videoPost} · {video.seconds.toFixed(1)}s · {t.videoHint}
                    </span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setVideo(null)}
                        className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-brand/60 hover:text-brand"
                      >
                        {t.removeVideo}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDiscard(true)}
                        className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-destructive/60 hover:text-destructive"
                      >
                        {t.discardDraft}
                      </button>
                    </div>
                  </div>
                  {/* Ton des Videos = SlangTag: anhören, löschen oder austauschen. */}
                  <div className="flex flex-wrap items-center gap-2">
                    {videoTag ? (
                      <>
                        {/* Video + SlangTag starten gemeinsam bei 0 (Einheit). */}
                        <button
                          type="button"
                          onClick={shot.toggle}
                          disabled={shot.preparing}
                          className="inline-flex items-center gap-1.5 rounded-full border border-brand/50 bg-brand/10 px-2.5 py-1 text-[11px] font-semibold text-brand disabled:opacity-60"
                        >
                          {shot.preparing ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : shot.playing ? (
                            <Pause className="h-3 w-3" />
                          ) : (
                            <Volume2 className="h-3 w-3" />
                          )}
                          {shot.preparing ? (
                            <span>{t.shotPreparing}</span>
                          ) : (
                            <SlangTagName tag={videoTag} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={shot.restart}
                          disabled={shot.preparing}
                          className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:border-brand/60 hover:text-brand disabled:opacity-60"
                        >
                          <RotateCcw className="h-3 w-3" /> {t.shotPlayUnit}
                        </button>
                        <button
                          type="button"
                          onClick={removeVideoTag}
                          className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:border-brand/60 hover:text-brand"
                        >
                          <Trash2 className="h-3 w-3" /> {t.deleteSlangTagAudio}
                        </button>
                      </>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">{t.videoPickTag}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => (videoTag ? replaceVideoTag() : setFocusTag((n) => n + 1))}
                      className="inline-flex items-center gap-1 rounded-full border border-brand/50 px-2.5 py-1 text-[11px] font-semibold text-brand"
                    >
                      <Plus className="h-3 w-3" />{" "}
                      {videoTag ? t.replaceSlangTagAudio : t.addSlangTagAudio}
                    </button>
                  </div>
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
              className={`grid place-items-center rounded-xl border border-dashed border-border px-4 text-center ${
                captureActive
                  ? "h-[62vh] min-h-[420px] lg:h-[520px]"
                  : "h-[18vh] min-h-[160px] lg:h-[190px]"
              }`}
            >
              <div className="flex flex-col items-center gap-2">
                {/* Kamera und SlangShot – zentriert oberhalb des Uploads. */}
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    {...noKeyboardProps}
                    title={t.takePhoto}
                    aria-label={t.takePhoto}
                    onClick={() => setPhotoCapturing(true)}
                    disabled={shotProcessing}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/80 px-3 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-sm hover:border-brand/60 hover:text-brand disabled:opacity-40"
                  >
                    <Camera className="h-3.5 w-3.5" /> {t.takePhoto}
                  </button>
                  <button
                    type="button"
                    {...noKeyboardProps}
                    title={t.cameraVideo}
                    aria-label={t.cameraVideo}
                    onClick={() => setCapturing(true)}
                    disabled={shotProcessing}
                    className="inline-flex items-center gap-1.5 rounded-full border border-brand/50 bg-surface/80 px-3 py-1.5 text-xs font-semibold text-brand backdrop-blur-sm hover:border-brand hover:text-brand shadow-glow disabled:opacity-40"
                  >
                    <Video className="h-3.5 w-3.5" /> {t.cameraVideo}
                  </button>
                </div>

                <label
                  {...noKeyboardProps}
                  className={`inline-flex items-center gap-2 rounded-full bg-gradient-brand px-5 py-2 text-sm font-semibold text-primary-foreground shadow-glow ${shotProcessing ? "pointer-events-none opacity-40" : "cursor-pointer"}`}
                >
                  <Globe className="h-4 w-4" /> {t.uploadImage}
                  <input
                    type="file"
                    accept="image/*,image/gif,video/*"
                    className="hidden"
                    disabled={shotProcessing}
                    onChange={(e) => handleUpload(e.target.files?.[0])}
                  />
                </label>

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

          {/* Kamera-Aktionen im Vorschau-Zustand weiterhin oben rechts. */}
          {image && !captureActive && (
            <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
              <button
                type="button"
                {...noKeyboardProps}
                title={t.takePhoto}
                aria-label={t.takePhoto}
                onClick={() => setPhotoCapturing(true)}
                disabled={shotProcessing}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/80 px-3 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-sm hover:border-brand/60 hover:text-brand disabled:opacity-40"
              >
                <Camera className="h-3.5 w-3.5" /> {t.takePhoto}
              </button>
              <button
                type="button"
                {...noKeyboardProps}
                title={t.cameraVideo}
                aria-label={t.cameraVideo}
                onClick={() => setCapturing(true)}
                disabled={shotProcessing}
                className="inline-flex items-center gap-1.5 rounded-full border border-brand/50 bg-surface/80 px-3 py-1.5 text-xs font-semibold text-brand backdrop-blur-sm hover:border-brand hover:text-brand shadow-glow disabled:opacity-40"
              >
                <Video className="h-3.5 w-3.5" /> {t.cameraVideo}
              </button>
            </div>
          )}

          {capturing && (
            <VideoCaptureOverlay
              onClose={() => setCapturing(false)}
              onDenied={() => toast.error(t.videoUnsupported)}
              onCaptured={(result) => {
                setCapturing(false);
                setVideoBusy(true);
                void applyShot(result.blob).finally(() => setVideoBusy(false));
              }}
            />
          )}

          {photoCapturing && (
            <PhotoCaptureOverlay
              onClose={() => setPhotoCapturing(false)}
              onDenied={() => toast.error(t.videoUnsupported)}
              onCaptured={(dataUrl) => {
                setPhotoCapturing(false);
                setVideo(null);
                setImage(dataUrl);
              }}
            />
          )}
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

          <div className="flex items-stretch gap-2">
            {/* Entwurf verwerfen – bewusst neben "Veröffentlichen". */}
            <button
              {...noKeyboardProps}
              type="button"
              onClick={() => {
                closeKeyboard();
                setConfirmDiscard(true);
              }}
              disabled={publishing || discarding || shotProcessing}
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
              disabled={publishing || discarding || shotProcessing}
            />

            <button
              {...noKeyboardProps}
              onClick={() => {
                closeKeyboard();
                void publish();
              }}
              disabled={publishing || discarding || shotProcessing}
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
        <div className="space-y-4">{body}</div>
        {tagStatus && <TagCommitWidget status={tagStatus} />}
      </DraftTagModeContext.Provider>
    );
  }

  return (
    <DraftTagModeContext.Provider value={true}>
      <div className="space-y-4">
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
        <div className="mt-5">
          <PostComposer onDone={onClose} collapsible={false} />
        </div>
      </div>
    </div>
  );
}
