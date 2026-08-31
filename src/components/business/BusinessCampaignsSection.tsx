/**
 * Business-Kampagnen V1 – Verwaltung im Unternehmerbereich.
 *
 * Die Oberfläche zeigt ausschliesslich an, was der Server erlaubt: Rolle,
 * Tarif, Limit und Status kommen aus `getMyCampaigns`. Es werden hier keine
 * Berechtigungen entschieden.
 */

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Megaphone, Plus, Save, X } from "lucide-react";
import { toast } from "sonner";

import { useLang } from "@/lib/lang-context";
import type { Lang } from "@/lib/i18n-dict";
import {
  getMyCampaigns,
  saveMyCampaign,
  setMyCampaignStatus,
} from "@/lib/business-campaigns.functions";
import type {
  BusinessCampaign,
  CampaignCta,
  CampaignStatus,
} from "@/lib/business-campaigns.shared";
import { isCampaignCta } from "@/lib/business-campaigns.shared";
import { FeedCampaignCard } from "@/components/feed/FeedCampaignCard";

const copy: Record<
  Lang,
  Record<
    | "title"
    | "subtitle"
    | "create"
    | "none"
    | "needsBusiness"
    | "limitReached"
    | "name"
    | "caption"
    | "region"
    | "hashtags"
    | "slangTag"
    | "noSlangTag"
    | "drop"
    | "noDrop"
    | "cta"
    | "noCta"
    | "ctaListen"
    | "ctaSlangTag"
    | "ctaProfile"
    | "preview"
    | "assetFailed"
    | "start"
    | "end"
    | "status"
    | "save"
    | "cancel"
    | "saved"
    | "failed"
    | "invalidRange"
    | "limit"
    | "metrics",
    string
  >
> = {
  de: {
    title: "Kampagnen",
    subtitle: "Werbung im Y-Dude Feed – klar als Kampagne gekennzeichnet.",
    create: "Kampagne erstellen",
    none: "Noch keine Kampagne angelegt.",
    needsBusiness: "Für Kampagnen wird ein Unternehmerkonto mit aktivem Business-Abo benötigt.",
    limitReached: "Das Limit aktiver Kampagnen ist erreicht.",
    name: "Name",
    caption: "Werbetext",
    region: "Region",
    hashtags: "Hashtags (mit Komma trennen)",
    slangTag: "Eigener SlangTag",
    noSlangTag: "Kein SlangTag",
    drop: "Eigener SlangTag-Drop",
    noDrop: "Kein Drop",
    cta: "Handlungsoption",
    noCta: "Keine Handlungsoption",
    ctaListen: "SlangTag anhören",
    ctaSlangTag: "SlangTag entdecken",
    ctaProfile: "Zum Unternehmen",
    preview: "Vorschau",
    assetFailed: "SlangTag oder Drop gehört nicht zu diesem Konto.",
    start: "Start",
    end: "Ende",
    status: "Status",
    save: "Speichern",
    cancel: "Abbrechen",
    saved: "Kampagne gespeichert",
    failed: "Speichern fehlgeschlagen",
    invalidRange: "Das Ende muss nach dem Start liegen.",
    limit: "aktive Kampagnen",
    metrics: "Einblendungen / Klicks",
  },
  en: {
    title: "Campaigns",
    subtitle: "Ads in the Y-Dude feed – always clearly labelled.",
    create: "Create campaign",
    none: "No campaign yet.",
    needsBusiness: "Campaigns require a business account with an active business plan.",
    limitReached: "You reached the limit of active campaigns.",
    name: "Name",
    caption: "Ad text",
    region: "Region",
    hashtags: "Hashtags (comma separated)",
    slangTag: "Own SlangTag",
    noSlangTag: "No SlangTag",
    drop: "Own SlangTag drop",
    noDrop: "No drop",
    cta: "Call to action",
    noCta: "No call to action",
    ctaListen: "Listen to SlangTag",
    ctaSlangTag: "Discover SlangTag",
    ctaProfile: "Visit business",
    preview: "Preview",
    assetFailed: "SlangTag or drop does not belong to this account.",
    start: "Start",
    end: "End",
    status: "Status",
    save: "Save",
    cancel: "Cancel",
    saved: "Campaign saved",
    failed: "Saving failed",
    invalidRange: "The end must be after the start.",
    limit: "active campaigns",
    metrics: "Impressions / clicks",
  },
  el: {
    title: "Καμπάνιες",
    subtitle: "Διαφημίσεις στο feed του Y-Dude – πάντα με σαφή σήμανση.",
    create: "Δημιουργία καμπάνιας",
    none: "Δεν υπάρχει καμπάνια ακόμη.",
    needsBusiness: "Οι καμπάνιες απαιτούν επαγγελματικό λογαριασμό με ενεργή συνδρομή.",
    limitReached: "Έφτασες το όριο ενεργών καμπανιών.",
    name: "Όνομα",
    caption: "Κείμενο",
    region: "Περιοχή",
    hashtags: "Hashtags (με κόμμα)",
    slangTag: "Δικό σου SlangTag",
    noSlangTag: "Χωρίς SlangTag",
    drop: "Δικό σου SlangTag drop",
    noDrop: "Χωρίς drop",
    cta: "Ενέργεια",
    noCta: "Χωρίς ενέργεια",
    ctaListen: "Άκου το SlangTag",
    ctaSlangTag: "Ανακάλυψε το SlangTag",
    ctaProfile: "Στην επιχείρηση",
    preview: "Προεπισκόπηση",
    assetFailed: "Το SlangTag ή το drop δεν ανήκει σε αυτόν τον λογαριασμό.",
    start: "Έναρξη",
    end: "Λήξη",
    status: "Κατάσταση",
    save: "Αποθήκευση",
    cancel: "Άκυρο",
    saved: "Η καμπάνια αποθηκεύτηκε",
    failed: "Η αποθήκευση απέτυχε",
    invalidRange: "Η λήξη πρέπει να είναι μετά την έναρξη.",
    limit: "ενεργές καμπάνιες",
    metrics: "Εμφανίσεις / κλικ",
  },
};

const STATUS_OPTIONS: CampaignStatus[] = ["draft", "active", "paused", "ended", "archived"];

type Draft = {
  id?: string;
  name: string;
  caption: string;
  region: string;
  hashtags: string;
  slangTagId: string;
  slangTagDropId: string;
  cta: "" | CampaignCta;
  startsAt: string;
  endsAt: string;
  status: CampaignStatus;
};

const EMPTY: Draft = {
  name: "",
  caption: "",
  region: "",
  hashtags: "",
  slangTagId: "",
  slangTagDropId: "",
  cta: "",
  startsAt: "",
  endsAt: "",
  status: "draft",
};

const toLocalInput = (ms: number | null) =>
  ms ? new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";

export function BusinessCampaignsSection() {
  const { lang } = useLang();
  const c = copy[lang];
  const qc = useQueryClient();
  const load = useServerFn(getMyCampaigns);
  const save = useServerFn(saveMyCampaign);
  const setStatus = useServerFn(setMyCampaignStatus);
  const [draft, setDraft] = useState<Draft | null>(null);

  const { data } = useQuery({ queryKey: ["business-campaigns"], queryFn: () => load({}) });

  const saveMutation = useMutation({
    mutationFn: async (d: Draft) =>
      save({
        data: {
          id: d.id,
          name: d.name,
          caption: d.caption,
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
        },
      }),
    onSuccess: (result) => {
      if (result && "error" in result) {
        toast.error(
          result.error === "invalid_time_range"
            ? c.invalidRange
            : result.error === "slang_tag_not_owned" || result.error === "slang_tag_drop_not_owned"
              ? c.assetFailed
              : c.failed,
        );
        return;
      }
      toast.success(c.saved);
      setDraft(null);
      void qc.invalidateQueries({ queryKey: ["business-campaigns"] });
    },
    onError: (err: unknown) =>
      toast.error(
        err instanceof Error && err.message.includes("invalid_time_range")
          ? c.invalidRange
          : c.failed,
      ),
  });

  const statusMutation = useMutation({
    mutationFn: async (v: { id: string; status: CampaignStatus }) => setStatus({ data: v }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["business-campaigns"] }),
    onError: () => toast.error(c.failed),
  });

  const campaigns: BusinessCampaign[] = useMemo(() => data?.campaigns ?? [], [data]);
  const previewTagName =
    (draft?.slangTagDropId || draft?.slangTagId
      ? data?.slangTags.find((t) => t.id === (draft.slangTagDropId || draft.slangTagId))?.name
      : null) ?? null;

  if (!data) return null;

  return (
    <section className="mt-4 rounded-2xl border border-border/60 bg-card/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Megaphone className="h-4 w-4 text-brand" /> {c.title}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{c.subtitle}</p>
        </div>
        {data.limit > 0 ? (
          <p className="text-xs text-muted-foreground">
            {data.activeCount} / {data.limit} {c.limit}
          </p>
        ) : null}
      </div>

      {!data.isBusiness || data.limit === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">{c.needsBusiness}</p>
      ) : (
        <>
          {!draft ? (
            <button
              type="button"
              disabled={!data.canCreate}
              onClick={() => setDraft({ ...EMPTY })}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-brand/50 bg-brand/10 px-3 py-2 text-xs font-semibold text-brand disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" /> {c.create}
            </button>
          ) : null}
          {!data.canCreate && !draft ? (
            <p className="mt-2 text-xs text-muted-foreground">{c.limitReached}</p>
          ) : null}

          {draft ? (
            <div className="mt-3 grid gap-2 rounded-xl border border-border/60 p-3 sm:grid-cols-2">
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder={c.name}
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
              />
              <input
                value={draft.region}
                onChange={(e) => setDraft({ ...draft, region: e.target.value })}
                placeholder={c.region}
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
              />
              <textarea
                value={draft.caption}
                onChange={(e) => setDraft({ ...draft, caption: e.target.value })}
                placeholder={c.caption}
                rows={3}
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs sm:col-span-2"
              />
              <input
                value={draft.hashtags}
                onChange={(e) => setDraft({ ...draft, hashtags: e.target.value })}
                placeholder={c.hashtags}
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
              />
              <select
                value={draft.slangTagId}
                onChange={(e) => setDraft({ ...draft, slangTagId: e.target.value })}
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
              >
                <option value="">{c.noSlangTag}</option>
                {data.slangTags.map((t) => (
                  <option key={t.id} value={t.id}>
                    $${t.name}
                  </option>
                ))}
              </select>
              <select
                value={draft.slangTagDropId}
                onChange={(e) => setDraft({ ...draft, slangTagDropId: e.target.value })}
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
              >
                <option value="">{c.noDrop}</option>
                {data.slangTags
                  .filter((t) => t.hasDrop)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      $${t.name}
                    </option>
                  ))}
              </select>
              <select
                value={draft.cta}
                onChange={(e) =>
                  setDraft({ ...draft, cta: (e.target.value || "") as "" | CampaignCta })
                }
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
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
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {c.start}
                <input
                  type="datetime-local"
                  value={draft.startsAt}
                  onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                />
              </label>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {c.end}
                <input
                  type="datetime-local"
                  value={draft.endsAt}
                  onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                />
              </label>
              <select
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value as CampaignStatus })}
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <div className="sm:col-span-2">
                <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {c.preview}
                </p>
                <FeedCampaignCard
                  campaign={{
                    id: draft.id ?? "preview",
                    name: draft.name || c.name,
                    caption: draft.caption,
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
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <button
                  type="button"
                  disabled={saveMutation.isPending}
                  onClick={() => saveMutation.mutate(draft)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-xs font-semibold text-brand-foreground disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" /> {c.save}
                </button>
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5" /> {c.cancel}
                </button>
              </div>
            </div>
          ) : null}

          {campaigns.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">{c.none}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {campaigns.map((campaign) => (
                <li
                  key={campaign.id}
                  className="rounded-xl border border-border/60 p-3 text-xs text-muted-foreground"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">{campaign.name}</span>
                    <select
                      value={campaign.status}
                      onChange={(e) =>
                        statusMutation.mutate({
                          id: campaign.id,
                          status: e.target.value as CampaignStatus,
                        })
                      }
                      className="rounded-lg border border-border bg-background px-2 py-1 text-[11px]"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="mt-1">
                    {campaign.region || "—"}
                    {campaign.slangTagName ? ` · $$${campaign.slangTagName}` : ""} · {c.metrics}:{" "}
                    {campaign.impressions} / {campaign.clicks}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({
                        id: campaign.id,
                        name: campaign.name,
                        caption: campaign.caption,
                        region: campaign.region,
                        hashtags: campaign.hashtags.join(", "),
                        slangTagId: campaign.slangTagId ?? "",
                        slangTagDropId: campaign.slangTagDropId ?? "",
                        cta: campaign.cta ?? "",
                        startsAt: toLocalInput(campaign.startsAt),
                        endsAt: toLocalInput(campaign.endsAt),
                        status: campaign.status,
                      })
                    }
                    className="mt-2 rounded-lg border border-border px-2 py-1 text-[11px] text-foreground"
                  >
                    {c.save === "Save" ? "Edit" : "Bearbeiten"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
