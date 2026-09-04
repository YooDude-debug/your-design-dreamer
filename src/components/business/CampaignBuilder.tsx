/**
 * Business-Kampagnen-Editor V1 (Staging).
 *
 * Der Editor ist bewusst vollständig ohne aktives Business-Abo nutzbar:
 * Erstellen, Bearbeiten, Speichern, Medien, SlangTag/Drop und Vorschau. Das
 * Abo entscheidet ausschliesslich über die tatsächliche Schaltung (Status
 * `active`) – geprüft wird das serverseitig in `saveMyCampaign`,
 * `setMyCampaignStatus`, in den RLS-Policies und im DB-Trigger.
 *
 * Es entsteht keine parallele Logik: Medien nutzen die bestehende
 * Media-/Video-V1-Pipeline, SlangTags und Drops die bestehenden Datensätze,
 * die Vorschau die echte Feed-Karte `FeedCampaignCard`.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart3,
  Gift,
  Image as ImageIcon,
  Loader2,
  Megaphone,
  Play,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useLang } from "@/lib/lang-context";
import { useData } from "@/lib/data-context";
import type { Lang } from "@/lib/i18n-dict";
import { signPath, uploadPostImage } from "@/lib/media";
import { uploadPostVideo } from "@/lib/video/video-upload-client";
import { MAX_VIDEO_BYTES } from "@/lib/video/video-file";
import {
  getMyCampaigns,
  saveMyCampaign,
  setMyCampaignStatus,
} from "@/lib/business-campaigns.functions";
import type {
  BusinessCampaign,
  CampaignCta,
  CampaignPhase,
  CampaignStatus,
} from "@/lib/business-campaigns.shared";
import { campaignPhase, isCampaignComplete, isCampaignCta } from "@/lib/business-campaigns.shared";
import { FeedCampaignCard } from "@/components/feed/FeedCampaignCard";
import { BusinessBackButton } from "@/components/business/BusinessBackButton";

type Text = Record<
  | "title"
  | "subtitle"
  | "new"
  | "none"
  | "basics"
  | "media"
  | "assets"
  | "preview"
  | "stats"
  | "name"
  | "caption"
  | "goal"
  | "region"
  | "hashtags"
  | "start"
  | "end"
  | "image"
  | "video"
  | "removeMedia"
  | "mediaHint"
  | "videoTooLarge"
  | "videoFailed"
  | "slangTag"
  | "noSlangTag"
  | "drop"
  | "noDrop"
  | "cta"
  | "noCta"
  | "ctaListen"
  | "ctaSlangTag"
  | "ctaProfile"
  | "save"
  | "saved"
  | "failed"
  | "invalidRange"
  | "assetFailed"
  | "mediaFailed"
  | "activate"
  | "pause"
  | "end2"
  | "readyTitle"
  | "readyText"
  | "choosePlan"
  | "impressions"
  | "clicks"
  | "noData"
  | "period"
  | "statusLabel"
  | "back"
  | "delete"
  | "phaseDraft"
  | "phaseReady"
  | "limit"
  | "uploading",
  string
>;

const copy: Record<Lang, Text> = {
  de: {
    title: "Kampagnen",
    subtitle: "Kampagnen anlegen, bearbeiten und in der Feed-Vorschau prüfen.",
    new: "Neue Kampagne",
    none: "Noch keine Kampagne angelegt.",
    basics: "Grunddaten",
    media: "Medien",
    assets: "SlangTag & Drops",
    preview: "Vorschau",
    stats: "Statistiken",
    name: "Kampagnenname",
    caption: "Beschreibung / Werbetext",
    goal: "Kampagnenziel",
    region: "Region / Zielgebiet",
    hashtags: "Hashtags (mit Komma trennen)",
    start: "Startdatum",
    end: "Enddatum",
    image: "Bild hochladen",
    video: "Video hochladen",
    removeMedia: "Medium entfernen",
    mediaHint: "Entweder ein Bild oder ein Video (max. 60 Sek.).",
    videoTooLarge: "Video ist zu groß.",
    videoFailed: "Video konnte nicht verarbeitet werden.",
    slangTag: "Eigener SlangTag",
    noSlangTag: "Kein SlangTag",
    drop: "Eigener SlangTag-Drop",
    noDrop: "Kein Drop",
    cta: "Handlungsoption",
    noCta: "Keine Handlungsoption",
    ctaListen: "SlangTag anhören",
    ctaSlangTag: "SlangTag entdecken",
    ctaProfile: "Zum Unternehmen",
    save: "Speichern",
    saved: "Kampagne gespeichert",
    failed: "Speichern fehlgeschlagen",
    invalidRange: "Das Ende muss nach dem Start liegen.",
    assetFailed: "SlangTag oder Drop gehört nicht zu diesem Konto.",
    mediaFailed: "Das Werbemittel gehört nicht zu diesem Konto.",
    activate: "Kampagne aktivieren",
    pause: "Pausieren",
    end2: "Beenden",
    readyTitle: "Deine Kampagne ist bereit.",
    readyText: "Für die Veröffentlichung benötigst du einen Business-Tarif.",
    choosePlan: "Business-Tarif auswählen",
    impressions: "Einblendungen",
    clicks: "Klicks",
    noData: "Noch keine Daten",
    period: "Kampagnenzeitraum",
    statusLabel: "Status",
    back: "Zurück zur Übersicht",
    delete: "Verwerfen",
    phaseDraft: "Entwurf",
    phaseReady: "Bereit",
    limit: "aktive Kampagnen",
    uploading: "Wird hochgeladen…",
  },
  en: {
    title: "Campaigns",
    subtitle: "Create, edit and preview campaigns as they appear in the feed.",
    new: "New campaign",
    none: "No campaign yet.",
    basics: "Basics",
    media: "Media",
    assets: "SlangTag & drops",
    preview: "Preview",
    stats: "Statistics",
    name: "Campaign name",
    caption: "Description / ad text",
    goal: "Campaign goal",
    region: "Region / target area",
    hashtags: "Hashtags (comma separated)",
    start: "Start date",
    end: "End date",
    image: "Upload image",
    video: "Upload video",
    removeMedia: "Remove media",
    mediaHint: "Either one image or one video (max. 60 sec.).",
    videoTooLarge: "Video is too large.",
    videoFailed: "Video could not be processed.",
    slangTag: "Own SlangTag",
    noSlangTag: "No SlangTag",
    drop: "Own SlangTag drop",
    noDrop: "No drop",
    cta: "Call to action",
    noCta: "No call to action",
    ctaListen: "Listen to SlangTag",
    ctaSlangTag: "Discover SlangTag",
    ctaProfile: "Visit business",
    save: "Save",
    saved: "Campaign saved",
    failed: "Saving failed",
    invalidRange: "The end must be after the start.",
    assetFailed: "SlangTag or drop does not belong to this account.",
    mediaFailed: "The media does not belong to this account.",
    activate: "Activate campaign",
    pause: "Pause",
    end2: "End",
    readyTitle: "Your campaign is ready.",
    readyText: "You need a business plan to publish it.",
    choosePlan: "Choose business plan",
    impressions: "Impressions",
    clicks: "Clicks",
    noData: "No data yet",
    period: "Campaign period",
    statusLabel: "Status",
    back: "Back to overview",
    delete: "Discard",
    phaseDraft: "Draft",
    phaseReady: "Ready",
    limit: "active campaigns",
    uploading: "Uploading…",
  },
  el: {
    title: "Καμπάνιες",
    subtitle: "Δημιούργησε, επεξεργάσου και δες προεπισκόπηση καμπανιών.",
    new: "Νέα καμπάνια",
    none: "Καμία καμπάνια ακόμη.",
    basics: "Βασικά",
    media: "Πολυμέσα",
    assets: "SlangTag & drops",
    preview: "Προεπισκόπηση",
    stats: "Στατιστικά",
    name: "Όνομα καμπάνιας",
    caption: "Περιγραφή / κείμενο",
    goal: "Στόχος καμπάνιας",
    region: "Περιοχή",
    hashtags: "Hashtags (με κόμμα)",
    start: "Έναρξη",
    end: "Λήξη",
    image: "Μεταφόρτωση εικόνας",
    video: "Μεταφόρτωση βίντεο",
    removeMedia: "Αφαίρεση πολυμέσου",
    mediaHint: "Είτε μία εικόνα είτε ένα βίντεο (έως 60 δευτ.).",
    videoTooLarge: "Το βίντεο είναι πολύ μεγάλο.",
    videoFailed: "Το βίντεο δεν μπόρεσε να επεξεργαστεί.",
    slangTag: "Δικό σου SlangTag",
    noSlangTag: "Χωρίς SlangTag",
    drop: "Δικό σου SlangTag drop",
    noDrop: "Χωρίς drop",
    cta: "Ενέργεια",
    noCta: "Χωρίς ενέργεια",
    ctaListen: "Άκου το SlangTag",
    ctaSlangTag: "Ανακάλυψε το SlangTag",
    ctaProfile: "Στην επιχείρηση",
    save: "Αποθήκευση",
    saved: "Η καμπάνια αποθηκεύτηκε",
    failed: "Η αποθήκευση απέτυχε",
    invalidRange: "Η λήξη πρέπει να είναι μετά την έναρξη.",
    assetFailed: "Το SlangTag ή το drop δεν ανήκει σε αυτόν τον λογαριασμό.",
    mediaFailed: "Το πολυμέσο δεν ανήκει σε αυτόν τον λογαριασμό.",
    activate: "Ενεργοποίηση καμπάνιας",
    pause: "Παύση",
    end2: "Τερματισμός",
    readyTitle: "Η καμπάνια σου είναι έτοιμη.",
    readyText: "Για δημοσίευση χρειάζεσαι επιχειρηματικό πακέτο.",
    choosePlan: "Επιλογή πακέτου",
    impressions: "Εμφανίσεις",
    clicks: "Κλικ",
    noData: "Χωρίς δεδομένα",
    period: "Διάστημα καμπάνιας",
    statusLabel: "Κατάσταση",
    back: "Πίσω στην επισκόπηση",
    delete: "Απόρριψη",
    phaseDraft: "Πρόχειρο",
    phaseReady: "Έτοιμη",
    limit: "ενεργές καμπάνιες",
    uploading: "Μεταφόρτωση…",
  },
};

type Draft = {
  id?: string;
  name: string;
  caption: string;
  goal: string;
  region: string;
  hashtags: string;
  slangTagId: string;
  slangTagDropId: string;
  cta: "" | CampaignCta;
  startsAt: string;
  endsAt: string;
  status: CampaignStatus;
  mediaImagePath: string | null;
  mediaVideoPath: string | null;
  mediaVideoThumbPath: string | null;
};

const EMPTY: Draft = {
  name: "",
  caption: "",
  goal: "",
  region: "",
  hashtags: "",
  slangTagId: "",
  slangTagDropId: "",
  cta: "",
  startsAt: "",
  endsAt: "",
  status: "draft",
  mediaImagePath: null,
  mediaVideoPath: null,
  mediaVideoThumbPath: null,
};

const toLocalInput = (ms: number | null) =>
  ms ? new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read_failed"));
    reader.readAsDataURL(file);
  });

function phaseLabel(phase: CampaignPhase, c: Text): string {
  if (phase === "draft") return c.phaseDraft;
  if (phase === "ready") return c.phaseReady;
  return phase;
}

export function CampaignBuilder({ onChoosePlan }: { onChoosePlan?: () => void } = {}) {
  const { lang } = useLang();
  const c = copy[lang];
  const qc = useQueryClient();
  const { me } = useData();
  const load = useServerFn(getMyCampaigns);
  const save = useServerFn(saveMyCampaign);
  const setStatus = useServerFn(setMyCampaignStatus);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [uploading, setUploading] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<{ image: string | null; video: string | null }>({
    image: null,
    video: null,
  });
  const imageInput = useRef<HTMLInputElement | null>(null);
  const videoInput = useRef<HTMLInputElement | null>(null);

  const { data } = useQuery({ queryKey: ["business-campaigns"], queryFn: () => load({}) });

  // Signierte Vorschau-URLs des Werbemittels (privater Bucket, keine Public-URL).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const image = draft?.mediaImagePath ? await signPath(draft.mediaImagePath) : null;
      const video = draft?.mediaVideoPath ? await signPath(draft.mediaVideoPath) : null;
      if (!cancelled) setMediaPreview({ image, video });
    })();
    return () => {
      cancelled = true;
    };
  }, [draft?.mediaImagePath, draft?.mediaVideoPath]);

  const saveMutation = useMutation({
    mutationFn: async (d: Draft) =>
      save({
        data: {
          id: d.id,
          name: d.name,
          // Das Ziel ist Teil des Werbetexts – keine neue Datenspalte.
          caption: d.goal.trim() ? `${d.caption}\n\n${d.goal.trim()}`.trim() : d.caption,
          region: d.region,
          hashtags: d.hashtags
            .split(",")
            .map((h) => h.trim())
            .filter(Boolean),
          slangTagId: d.slangTagId || null,
          slangTagDropId: d.slangTagDropId || null,
          cta: isCampaignCta(d.cta) ? d.cta : null,
          startsAt: d.startsAt ? new Date(d.startsAt).getTime() : null,
          endsAt: d.endsAt ? new Date(d.endsAt).getTime() : null,
          status: d.status,
          mediaImagePath: d.mediaImagePath,
          mediaVideoPath: d.mediaVideoPath,
          mediaVideoThumbPath: d.mediaVideoThumbPath,
        },
      }),
    onSuccess: (result) => {
      if (result && "error" in result) {
        toast.error(
          result.error === "invalid_time_range"
            ? c.invalidRange
            : result.error === "campaign_media_not_owned"
              ? c.mediaFailed
              : result.error === "slang_tag_not_owned" ||
                  result.error === "slang_tag_drop_not_owned"
                ? c.assetFailed
                : result.error === "business_subscription_required"
                  ? c.readyText
                  : c.failed,
        );
        return;
      }
      toast.success(c.saved);
      setDraft(null);
      void qc.invalidateQueries({ queryKey: ["business-campaigns"] });
    },
    onError: () => toast.error(c.failed),
  });

  const statusMutation = useMutation({
    mutationFn: async (v: { id: string; status: CampaignStatus }) => setStatus({ data: v }),
    onSuccess: (result) => {
      if (result && "error" in result) {
        toast.error(
          result.error === "business_subscription_required" ||
            result.error === "campaign_limit_reached"
            ? c.readyText
            : c.failed,
        );
        return;
      }
      void qc.invalidateQueries({ queryKey: ["business-campaigns"] });
    },
    onError: () => toast.error(c.failed),
  });

  const campaigns: BusinessCampaign[] = useMemo(() => data?.campaigns ?? [], [data]);
  const canPublish = (data?.limit ?? 0) > 0;

  const pickImage = async (file: File) => {
    if (!me) return;
    setUploading(true);
    try {
      const dataUrl = await readAsDataUrl(file);
      const { imagePath } = await uploadPostImage(me.id, dataUrl, []);
      if (!imagePath) throw new Error("upload_failed");
      setDraft((d) =>
        d
          ? { ...d, mediaImagePath: imagePath, mediaVideoPath: null, mediaVideoThumbPath: null }
          : d,
      );
    } catch {
      toast.error(c.failed);
    } finally {
      setUploading(false);
    }
  };

  const pickVideo = async (file: File) => {
    if (!me) return;
    if (file.size > MAX_VIDEO_BYTES) {
      toast.error(c.videoTooLarge);
      return;
    }
    setUploading(true);
    try {
      const result = await uploadPostVideo(me.id, file);
      if (!result.ok) {
        toast.error(result.code === "too_large" ? c.videoTooLarge : c.videoFailed);
        return;
      }
      setDraft((d) =>
        d
          ? {
              ...d,
              mediaImagePath: null,
              mediaVideoPath: result.path,
              mediaVideoThumbPath: result.thumbnailPath ?? null,
            }
          : d,
      );
    } catch {
      toast.error(c.videoFailed);
    } finally {
      setUploading(false);
    }
  };

  if (!data) return null;

  const previewTagName =
    (draft?.slangTagDropId || draft?.slangTagId
      ? data.slangTags.find((t) => t.id === (draft.slangTagDropId || draft.slangTagId))?.name
      : null) ?? null;

  const previewCard = draft ? (
    <FeedCampaignCard
      campaign={{
        id: draft.id ?? "preview",
        name: draft.name || c.name,
        caption: draft.goal.trim()
          ? `${draft.caption}\n\n${draft.goal.trim()}`.trim()
          : draft.caption,
        company: draft.name || c.title,
        companyLogo: null,
        companyUsername: null,
        region: draft.region,
        hashtags: draft.hashtags
          .split(",")
          .map((h) => h.trim().replace(/^#+/, ""))
          .filter(Boolean),
        slangTagName: previewTagName,
        slangTagPreviewUrl: null,
        slangTagDuration: null,
        ctaUrl: null,
        cta: isCampaignCta(draft.cta) ? draft.cta : null,
        mediaImageUrl: mediaPreview.image,
        mediaVideoUrl: mediaPreview.video,
        mediaVideoThumbUrl: null,
        isDrop: Boolean(draft.slangTagDropId),
        dropRemaining: null,
        dropEndsAt: null,
      }}
      position={0}
      lang={lang}
      onImpression={() => {}}
      onClick={() => {}}
      onDismiss={() => {}}
    />
  ) : null;

  const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
  const label = "text-[10px] uppercase tracking-widest text-muted-foreground";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <BusinessBackButton target="business" className="mb-3" />
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold text-foreground">
            <Megaphone className="h-5 w-5 text-brand" /> {c.title}
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">{c.subtitle}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          {data.activeCount} / {data.limit} {c.limit}
        </p>
      </header>

      {!draft ? (
        <>
          <button
            type="button"
            onClick={() => setDraft({ ...EMPTY })}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-xs font-semibold text-brand-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> {c.new}
          </button>

          {campaigns.length === 0 ? (
            <p className="mt-4 text-xs text-muted-foreground">{c.none}</p>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {campaigns.map((campaign) => {
                const phase = campaignPhase(campaign);
                return (
                  <li
                    key={campaign.id}
                    className="rounded-2xl border border-border/60 bg-card/60 p-3 text-xs text-muted-foreground"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">{campaign.name}</span>
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] uppercase tracking-widest text-accent-foreground">
                        {phaseLabel(phase, c)}
                      </span>
                    </div>
                    <p className="mt-1">
                      {campaign.region || "—"} · {c.impressions}: {campaign.impressions} ·{" "}
                      {c.clicks}: {campaign.clicks}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setDraft({
                            id: campaign.id,
                            name: campaign.name,
                            caption: campaign.caption,
                            goal: "",
                            region: campaign.region,
                            hashtags: campaign.hashtags.join(", "),
                            slangTagId: campaign.slangTagId ?? "",
                            slangTagDropId: campaign.slangTagDropId ?? "",
                            cta: campaign.cta ?? "",
                            startsAt: toLocalInput(campaign.startsAt),
                            endsAt: toLocalInput(campaign.endsAt),
                            status: campaign.status,
                            mediaImagePath: campaign.mediaImagePath,
                            mediaVideoPath: campaign.mediaVideoPath,
                            mediaVideoThumbPath: campaign.mediaVideoThumbPath,
                          })
                        }
                        className="rounded-lg border border-border px-2 py-1 text-[11px] text-foreground"
                      >
                        {c.basics}
                      </button>
                      {campaign.status === "active" ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              statusMutation.mutate({ id: campaign.id, status: "paused" })
                            }
                            className="rounded-lg border border-border px-2 py-1 text-[11px] text-foreground"
                          >
                            {c.pause}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              statusMutation.mutate({ id: campaign.id, status: "ended" })
                            }
                            className="rounded-lg border border-border px-2 py-1 text-[11px] text-foreground"
                          >
                            {c.end2}
                          </button>
                        </>
                      ) : campaign.status !== "ended" && campaign.status !== "archived" ? (
                        <button
                          type="button"
                          onClick={() =>
                            canPublish
                              ? statusMutation.mutate({ id: campaign.id, status: "active" })
                              : onChoosePlan?.()
                          }
                          className="rounded-lg border border-brand/50 bg-brand/10 px-2 py-1 text-[11px] font-semibold text-brand"
                        >
                          {c.activate}
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <section className="mt-6 rounded-2xl border border-border/60 bg-card/60 p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <BarChart3 className="h-4 w-4 text-brand" /> {c.stats}
            </h2>
            {campaigns.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">{c.noData}</p>
            ) : (
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {campaigns.map((campaign) => (
                  <li key={campaign.id} className="flex flex-wrap gap-x-3">
                    <span className="font-semibold text-foreground">{campaign.name}</span>
                    <span>
                      {c.impressions}: {campaign.impressions}
                    </span>
                    <span>
                      {c.clicks}: {campaign.clicks}
                    </span>
                    <span>
                      {c.period}:{" "}
                      {campaign.startsAt
                        ? new Date(campaign.startsAt).toLocaleDateString()
                        : c.noData}
                      {" – "}
                      {campaign.endsAt ? new Date(campaign.endsAt).toLocaleDateString() : c.noData}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-4">
            <section className="rounded-2xl border border-border/60 bg-card/60 p-4">
              <h2 className="text-sm font-semibold text-foreground">{c.basics}</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder={c.name}
                  className={field}
                />
                <input
                  value={draft.region}
                  onChange={(e) => setDraft({ ...draft, region: e.target.value })}
                  placeholder={c.region}
                  className={field}
                />
                <textarea
                  value={draft.caption}
                  onChange={(e) => setDraft({ ...draft, caption: e.target.value })}
                  placeholder={c.caption}
                  rows={3}
                  className={`${field} sm:col-span-2`}
                />
                <input
                  value={draft.goal}
                  onChange={(e) => setDraft({ ...draft, goal: e.target.value })}
                  placeholder={c.goal}
                  className={field}
                />
                <input
                  value={draft.hashtags}
                  onChange={(e) => setDraft({ ...draft, hashtags: e.target.value })}
                  placeholder={c.hashtags}
                  className={field}
                />
                <label className={label}>
                  {c.start}
                  <input
                    type="datetime-local"
                    value={draft.startsAt}
                    onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })}
                    className={`mt-1 ${field}`}
                  />
                </label>
                <label className={label}>
                  {c.end}
                  <input
                    type="datetime-local"
                    value={draft.endsAt}
                    onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })}
                    className={`mt-1 ${field}`}
                  />
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-border/60 bg-card/60 p-4">
              <h2 className="text-sm font-semibold text-foreground">{c.media}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{c.mediaHint}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => imageInput.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-50"
                >
                  <ImageIcon className="h-3.5 w-3.5" /> {c.image}
                </button>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => videoInput.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-50"
                >
                  <Play className="h-3.5 w-3.5" /> {c.video}
                </button>
                {draft.mediaImagePath || draft.mediaVideoPath ? (
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        mediaImagePath: null,
                        mediaVideoPath: null,
                        mediaVideoThumbPath: null,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> {c.removeMedia}
                  </button>
                ) : null}
                {uploading ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> {c.uploading}
                  </span>
                ) : null}
              </div>
              <input
                ref={imageInput}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void pickImage(file);
                }}
              />
              <input
                ref={videoInput}
                type="file"
                accept="video/mp4,video/quicktime,video/x-m4v"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void pickVideo(file);
                }}
              />
            </section>

            <section className="rounded-2xl border border-border/60 bg-card/60 p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Gift className="h-4 w-4 text-brand" /> {c.assets}
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <select
                  value={draft.slangTagId}
                  onChange={(e) => setDraft({ ...draft, slangTagId: e.target.value })}
                  className={field}
                >
                  <option value="">{c.noSlangTag}</option>
                  {data.slangTags.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <select
                  value={draft.slangTagDropId}
                  onChange={(e) => setDraft({ ...draft, slangTagDropId: e.target.value })}
                  className={field}
                >
                  <option value="">{c.noDrop}</option>
                  {data.slangTags
                    .filter((t) => t.hasDrop)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
                <select
                  value={draft.cta}
                  onChange={(e) =>
                    setDraft({ ...draft, cta: (e.target.value || "") as "" | CampaignCta })
                  }
                  className={field}
                >
                  <option value="">{c.noCta}</option>
                  {draft.slangTagId || draft.slangTagDropId ? (
                    <>
                      <option value="listen">{c.ctaListen}</option>
                      <option value="slangtag">{c.ctaSlangTag}</option>
                    </>
                  ) : null}
                  <option value="profile">{c.ctaProfile}</option>
                </select>
              </div>
            </section>

            {isCampaignComplete({
              name: draft.name,
              caption: draft.caption,
              region: draft.region,
              mediaImagePath: draft.mediaImagePath,
              mediaVideoPath: draft.mediaVideoPath,
              slangTagId: draft.slangTagId || null,
              slangTagDropId: draft.slangTagDropId || null,
            }) && !canPublish ? (
              <section className="rounded-2xl border border-brand/40 bg-brand/5 p-4">
                <p className="text-sm font-semibold text-foreground">{c.readyTitle}</p>
                <p className="mt-1 text-xs text-muted-foreground">{c.readyText}</p>
                {onChoosePlan ? (
                  <button
                    type="button"
                    onClick={onChoosePlan}
                    className="mt-2 rounded-xl border border-brand/50 bg-brand/10 px-3 py-2 text-xs font-semibold text-brand"
                  >
                    {c.choosePlan}
                  </button>
                ) : null}
              </section>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saveMutation.isPending || uploading}
                onClick={() => saveMutation.mutate({ ...draft, status: "draft" })}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-xs font-semibold text-brand-foreground disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" /> {c.save}
              </button>
              <button
                type="button"
                disabled={saveMutation.isPending || uploading}
                onClick={() =>
                  canPublish
                    ? saveMutation.mutate({ ...draft, status: "active" })
                    : onChoosePlan
                      ? onChoosePlan()
                      : toast.message(c.readyTitle, { description: c.readyText })
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-brand/50 bg-brand/10 px-3 py-2 text-xs font-semibold text-brand disabled:opacity-50"
              >
                <Megaphone className="h-3.5 w-3.5" /> {c.activate}
              </button>
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" /> {c.back}
              </button>
            </div>
          </div>

          <aside className="lg:sticky lg:top-4 lg:self-start">
            <p className={label}>{c.preview}</p>
            <div className="mt-1">{previewCard}</div>
          </aside>
        </div>
      )}
    </div>
  );
}
