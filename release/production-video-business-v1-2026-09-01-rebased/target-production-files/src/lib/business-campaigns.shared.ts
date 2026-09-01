/**
 * Business-Kampagnen V1 – geteilte Typen und Limits.
 *
 * Bewusst ohne Datenbank- oder UI-Abhängigkeit, damit Server, Client und Tests
 * dieselbe Wahrheit verwenden. Die Limits entsprechen exakt der
 * Datenbankfunktion `public.business_campaign_limit(text)`.
 */

import type { BillingTier } from "./billing-plans";

export type CampaignStatus = "draft" | "active" | "paused" | "ended" | "archived";

export const CAMPAIGN_STATUSES: CampaignStatus[] = [
  "draft",
  "active",
  "paused",
  "ended",
  "archived",
];

/** Maximal gleichzeitig AKTIVE Kampagnen je Business-Stufe. */
export const CAMPAIGN_LIMITS: Record<BillingTier, number> = {
  free: 0,
  business: 2,
  business_pro: 5,
};

export function campaignLimitFor(tier: BillingTier): number {
  return CAMPAIGN_LIMITS[tier] ?? 0;
}

/**
 * F6: Handlungsoption einer Kampagne. Jede Option führt ausschliesslich zu
 * einem BEREITS vorhandenen Y-Dude-Ziel – keine neue Routing-Architektur.
 * - `listen`   → bestehende Probeanhören-Funktion in der Werbekarte
 * - `slangtag` → bestehende Route `/slangtag/$name`
 * - `profile`  → bestehendes Unternehmensprofil `/profile/$username`
 */
export const CAMPAIGN_CTAS = ["listen", "slangtag", "profile"] as const;
export type CampaignCta = (typeof CAMPAIGN_CTAS)[number];

export function isCampaignCta(value: unknown): value is CampaignCta {
  return typeof value === "string" && (CAMPAIGN_CTAS as readonly string[]).includes(value);
}

export type CampaignCtaTarget =
  | { kind: "listen" }
  | { kind: "slangtag"; name: string }
  | { kind: "profile"; username: string };

/**
 * Ermittelt das konkrete Ziel eines CTA. Fehlt das nötige Asset (z. B. der
 * SlangTag wurde gelöscht), gibt es KEIN Ziel – niemals ein Fake-Link.
 */
export function campaignCtaTarget(view: {
  cta: CampaignCta | null;
  slangTagName: string | null;
  slangTagPreviewUrl: string | null;
  companyUsername: string | null;
}): CampaignCtaTarget | null {
  switch (view.cta) {
    case "listen":
      return view.slangTagPreviewUrl ? { kind: "listen" } : null;
    case "slangtag":
      return view.slangTagName ? { kind: "slangtag", name: view.slangTagName } : null;
    case "profile":
      return view.companyUsername ? { kind: "profile", username: view.companyUsername } : null;
    default:
      return null;
  }
}

/** Kampagne aus Sicht des Unternehmers (Business-Bereich). */
export type BusinessCampaign = {
  id: string;
  name: string;
  caption: string;
  status: CampaignStatus;
  region: string;
  hashtags: string[];
  slangTagId: string | null;
  slangTagName: string | null;
  /** F6: eigener Exclusive SlangDrop (Schlüssel ist die SlangTag-ID). */
  slangTagDropId: string | null;
  cta: CampaignCta | null;
  startsAt: number | null;
  endsAt: number | null;
  impressions: number;
  clicks: number;
  createdAt: number;
};

/** Antwort der Übersicht: Kampagnen plus serverseitig geprüfte Rechte. */
export type BusinessCampaignOverview = {
  /** Echte Unternehmerrolle (`user_roles`). */
  isBusiness: boolean;
  tier: BillingTier;
  /** Kampagnenlimit dieser Stufe (0 = keine Kampagnen erlaubt). */
  limit: number;
  /** Aktuell aktive Kampagnen. */
  activeCount: number;
  /** Darf jetzt eine weitere AKTIVE Kampagne erstellt werden? */
  canCreate: boolean;
  campaigns: BusinessCampaign[];
  /** Eigene SlangTags, die als Kampagnen-Werbemittel verwendet werden dürfen. */
  slangTags: { id: string; name: string; hasDrop: boolean }[];
};

/**
 * Zustand der Kampagnen-Sektion für die Oberfläche.
 *
 * Wichtig: das ist reine Darstellung. Die tatsächliche Berechtigung entsteht
 * ausschliesslich serverseitig (Rolle + aktives Business-Abo + Limit); ohne
 * Abo lehnt `saveCampaign` die Erstellung unabhängig von dieser Anzeige ab.
 *
 * - `no_role`            – kein Unternehmerkonto: Sektion bleibt verborgen.
 * - `needs_subscription` – Unternehmer ohne aktives Abo: Sektion sichtbar,
 *   aber ausgegraut; Handlungsaufruf führt zur Abo-Auswahl.
 * - `limit_reached`      – Abo aktiv, Limit der Stufe ausgeschöpft.
 * - `ready`              – Erstellung möglich.
 */
export type CampaignGate = "no_role" | "needs_subscription" | "limit_reached" | "ready";

export function campaignGate(
  overview: Pick<BusinessCampaignOverview, "isBusiness" | "limit" | "activeCount">,
): CampaignGate {
  if (!overview.isBusiness) return "no_role";
  if (overview.limit <= 0) return "needs_subscription";
  if (overview.activeCount >= overview.limit) return "limit_reached";
  return "ready";
}

export type CampaignInput = {
  id?: string;
  name: string;
  caption: string;
  status: CampaignStatus;
  region: string;
  hashtags: string[];
  slangTagId: string | null;
  slangTagDropId: string | null;
  cta: CampaignCta | null;
  startsAt: number | null;
  endsAt: number | null;
};

/** Fehlercodes, die die Oberfläche übersetzbar anzeigen kann. */
export type CampaignErrorCode =
  | "business_role_required"
  | "business_subscription_required"
  | "campaign_limit_reached"
  | "slang_tag_not_owned"
  | "slang_tag_drop_not_owned"
  | "invalid_time_range"
  | "not_found"
  | "invalid_input"
  | "failed";

export function campaignErrorFrom(message: string): CampaignErrorCode {
  const m = message.toLowerCase();
  if (m.includes("business_role_required")) return "business_role_required";
  if (m.includes("business_subscription_required")) return "business_subscription_required";
  if (m.includes("campaign_limit_reached")) return "campaign_limit_reached";
  if (m.includes("slang_tag_drop_not_owned")) return "slang_tag_drop_not_owned";
  if (m.includes("slang_tag_not_owned")) return "slang_tag_not_owned";
  if (m.includes("invalid_time_range") || m.includes("ad_campaigns_time_window_chk")) {
    return "invalid_time_range";
  }
  if (m.includes("invalid_input")) return "invalid_input";
  if (m.includes("not_found")) return "not_found";
  return "failed";
}

/** Gültige Kampagnen-Ereignisarten (F1: kein frei wählbarer Ereignistyp). */
export const CAMPAIGN_EVENT_KINDS = ["impression", "click"] as const;
export type CampaignEventKind = (typeof CAMPAIGN_EVENT_KINDS)[number];

export function isCampaignEventKind(value: unknown): value is CampaignEventKind {
  return typeof value === "string" && (CAMPAIGN_EVENT_KINDS as readonly string[]).includes(value);
}

/** Sieht der Wert wie eine UUID aus? (F1: keine beliebige Kampagnen-ID) */
export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

/**
 * F5: Plausibilität des Zeitfensters (UTC-Millisekunden).
 * `null` bedeutet „offen“ und ist erlaubt; ein Ende muss echt nach dem Start
 * liegen und beide Werte müssen gültige Zeitstempel sein.
 */
export function validateCampaignWindow(
  startsAt: number | null,
  endsAt: number | null,
): CampaignErrorCode | null {
  const valid = (v: number | null) =>
    v === null || (typeof v === "number" && Number.isFinite(v) && Number.isSafeInteger(v));
  if (!valid(startsAt) || !valid(endsAt)) return "invalid_input";
  if (startsAt !== null && endsAt !== null && endsAt <= startsAt) return "invalid_time_range";
  return null;
}

/** Normalisiert Hashtags: ohne „#“, klein, ohne Duplikate, maximal 8. */
export function normalizeHashtags(values: string[]): string[] {
  const out: string[] = [];
  for (const raw of values) {
    const tag = raw
      .trim()
      .replace(/^#+/, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}_]/gu, "");
    if (tag.length > 0 && !out.includes(tag)) out.push(tag);
    if (out.length >= 8) break;
  }
  return out;
}

/** Läuft die Kampagne zu diesem Zeitpunkt (Status und Zeitfenster)? */
export function isCampaignServable(
  c: { status: CampaignStatus | string; startsAt: number | null; endsAt: number | null },
  now = Date.now(),
): boolean {
  if (c.status !== "active") return false;
  if (c.startsAt !== null && c.startsAt > now) return false;
  if (c.endsAt !== null && c.endsAt <= now) return false;
  return true;
}
