import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  BadgeCheck,
  Building2,
  Clock,
  Eye,
  Heart,
  Megaphone,
  MapPin,
  MousePointerClick,
  Phone,
  Play,
  Share2,
  Target,
  Ticket,
  ExternalLink,
} from "lucide-react";
import { SlangTagChip } from "@/components/SlangTagChip";
import { supabase } from "@/integrations/supabase/client";
import { formatStat, type SlangTag, type SlangTagCtaType } from "@/lib/types";

/** Beschriftung der Call-to-Action-Buttons. */
const CTA_LABEL: Record<SlangTagCtaType, string> = {
  website: "Webseite besuchen",
  offer: "Angebot ansehen",
  booking: "Jetzt buchen",
  info: "Mehr erfahren",
  route: "Route öffnen",
};

export function ctaLabel(type: SlangTagCtaType | null): string {
  return type ? CTA_LABEL[type] : CTA_LABEL.info;
}

/**
 * Unternehmens-SlangTag als Werbekarte: blaues Unternehmens-Badge, optionales
 * „Gesponsert"-Label, Firmenlogo, Verifizierung, Audio, Beschreibung, CTA und
 * eigene Statistiken (inkl. Klicks, Conversions, Reichweite).
 *
 * Vollständig getrennt vom Community-Voting – diese Karte kennt keine Votes.
 */
export function CompanySlangTagCard({ tag }: { tag: SlangTag }) {
  const navigate = useNavigate();
  const info = tag.companyInfo;
  const counted = useRef(false);

  useEffect(() => {
    if (counted.current) return;
    counted.current = true;
    void supabase.rpc("track_slang_tag_reach", { _tag_id: tag.id });
  }, [tag.id]);

  if (!info) return null;

  const monogram =
    (info.name || tag.name)
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join("") || "Y";

  const openCta = () => {
    const url = info.ctaUrl || info.url;
    void supabase.rpc("track_slang_tag_click", { _tag_id: tag.id, _conversion: true });
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-brand-cyan/30 bg-surface p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full border border-brand-cyan/50 bg-brand-cyan/15 px-2 py-0.5 text-[10px] font-bold text-brand-cyan">
          <Building2 className="h-3 w-3" /> Unternehmen
        </span>
        {tag.sponsored && (
          <span className="inline-flex items-center gap-1 rounded-full border border-brand-cyan/60 bg-brand-cyan/25 px-2 py-0.5 text-[10px] font-bold text-brand-cyan">
            <Megaphone className="h-3 w-3" /> Gesponsert
          </span>
        )}
        {tag.verificationStatus === "verified" && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            <BadgeCheck className="h-3 w-3 text-brand-cyan" /> Verifiziert
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        {info.logo ? (
          <img
            src={info.logo}
            alt={`${info.name} Logo`}
            loading="lazy"
            className="h-9 w-9 shrink-0 rounded-lg border border-border object-cover"
          />
        ) : (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-brand-cyan/40 bg-brand-cyan/10 text-[11px] font-black text-brand-cyan">
            {monogram}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">{info.name || "Unternehmen"}</p>
          {info.url && (
            <a
              href={info.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                void supabase.rpc("track_slang_tag_click", { _tag_id: tag.id, _conversion: false })
              }
              className="inline-flex items-center gap-1 truncate text-[10px] text-brand-cyan hover:underline"
            >
              <ExternalLink className="h-2.5 w-2.5" /> Unternehmensseite
            </a>
          )}
        </div>
      </div>

      <div className="mt-2">
        <SlangTagChip
          tag={tag}
          variant="compact"
          showStats={false}
          onOpen={() => navigate({ to: "/slangtag/$name", params: { name: tag.name } })}
        />
      </div>

      {info.description && (
        <p className="mt-2 line-clamp-3 text-[11px] text-muted-foreground">{info.description}</p>
      )}

      {(info.discountCode || info.voucher) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {info.discountCode && (
            <span className="inline-flex items-center gap-1 rounded-md border border-dashed border-brand-cyan/60 px-2 py-0.5 text-[10px] font-bold text-brand-cyan">
              <Ticket className="h-3 w-3" /> Code {info.discountCode}
            </span>
          )}
          {info.voucher && (
            <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
              <Ticket className="h-3 w-3" /> {info.voucher}
            </span>
          )}
        </div>
      )}

      {(info.location || info.openingHours || info.phone) && (
        <div className="mt-2 space-y-0.5 text-[10px] text-muted-foreground">
          {info.location && (
            <p className="inline-flex items-center gap-1">
              <MapPin className="h-2.5 w-2.5" /> {info.location}
            </p>
          )}
          {info.openingHours && (
            <p className="inline-flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" /> {info.openingHours}
            </p>
          )}
          {info.phone && (
            <p>
              <a
                href={`tel:${info.phone}`}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <Phone className="h-2.5 w-2.5" /> {info.phone}
              </a>
            </p>
          )}
        </div>
      )}

      {(info.ctaUrl || info.url) && (
        <button
          type="button"
          onClick={openCta}
          className="mt-2.5 w-full rounded-full border border-brand-cyan bg-brand-cyan/15 px-3 py-2 text-xs font-bold text-brand-cyan transition-colors hover:bg-brand-cyan/25"
        >
          {ctaLabel(info.ctaType)}
        </button>
      )}

      <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Play className="h-2.5 w-2.5" /> {formatStat(tag.stats.plays)} Wiedergaben
        </span>
        <span className="inline-flex items-center gap-1">
          <Heart className="h-2.5 w-2.5" /> {formatStat(tag.stats.likes)} Likes
        </span>
        <span className="inline-flex items-center gap-1">
          <Share2 className="h-2.5 w-2.5" /> {formatStat(tag.stats.shares)} Shares
        </span>
        <span className="inline-flex items-center gap-1">
          <MousePointerClick className="h-2.5 w-2.5" /> {formatStat(tag.stats.clicks)} Klicks
        </span>
        <span className="inline-flex items-center gap-1">
          <Target className="h-2.5 w-2.5" /> {formatStat(tag.stats.conversions)} Conversions
        </span>
        <span className="inline-flex items-center gap-1">
          <Eye className="h-2.5 w-2.5" /> {formatStat(tag.stats.reach)} Reichweite
        </span>
      </div>
    </div>
  );
}
