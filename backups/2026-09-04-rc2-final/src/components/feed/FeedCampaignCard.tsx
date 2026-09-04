/**
 * Werbekarte einer Business-Kampagne im Hauptfeed.
 *
 * Die Karte ist IMMER eindeutig als Kampagne/Werbung gekennzeichnet – es gibt
 * keine Darstellung, die wie ein organischer Beitrag aussieht. Für das
 * Probeanhören des Kampagnen-SlangTags wird der bestehende Audio-Bus
 * (`autoplay`) verwendet; es entsteht keine zweite Audio-Infrastruktur.
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ExternalLink, Gift, Megaphone, Pause, Play } from "lucide-react";
import { CloseButton } from "@/components/ui/nav-buttons";
import type { CampaignAdView } from "@/lib/ad-catalog.shared";
import type { Lang } from "@/lib/i18n-dict";
import { isOwnerPlaying, playExclusive, stopOwner } from "@/lib/autoplay";
import { campaignCtaTarget } from "@/lib/business-campaigns.shared";

const copy: Record<
  Lang,
  {
    label: string;
    sponsored: string;
    listen: string;
    open: string;
    ctaListen: string;
    ctaSlangTag: string;
    ctaProfile: string;
    drop: string;
    dropLeft: string;
  }
> = {
  de: {
    label: "Kampagne",
    sponsored: "Werbung",
    listen: "Probehören",
    open: "Mehr erfahren",
    ctaListen: "SlangTag anhören",
    ctaSlangTag: "SlangTag entdecken",
    ctaProfile: "Zum Unternehmen",
    drop: "Exclusive Drop",
    dropLeft: "Exemplare übrig",
  },
  en: {
    label: "Campaign",
    sponsored: "Ad",
    listen: "Preview",
    open: "Learn more",
    ctaListen: "Listen to SlangTag",
    ctaSlangTag: "Discover SlangTag",
    ctaProfile: "Visit business",
    drop: "Exclusive drop",
    dropLeft: "copies left",
  },
  el: {
    label: "Καμπάνια",
    sponsored: "Διαφήμιση",
    listen: "Ακρόαση",
    open: "Μάθε περισσότερα",
    ctaListen: "Άκου το SlangTag",
    ctaSlangTag: "Ανακάλυψε το SlangTag",
    ctaProfile: "Στην επιχείρηση",
    drop: "Exclusive drop",
    dropLeft: "αντίτυπα διαθέσιμα",
  },
};

export function FeedCampaignCard({
  campaign,
  position,
  lang,
  onImpression,
  onClick,
  onDismiss,
}: {
  campaign: CampaignAdView;
  position: number;
  lang: Lang;
  onImpression: () => void;
  onClick: () => void;
  onDismiss: () => void;
}) {
  const c = copy[lang];
  const cardRef = useRef<HTMLElement | null>(null);
  const reported = useRef(false);
  const [playing, setPlaying] = useState(false);
  const owner = `campaign:${campaign.id}`;

  useEffect(() => {
    const el = cardRef.current;
    if (!el || reported.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5 && !reported.current) {
            reported.current = true;
            onImpression();
            io.disconnect();
          }
        }
      },
      { threshold: [0.5] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [onImpression]);

  useEffect(() => () => stopOwner(owner), [owner]);

  const toggleAudio = () => {
    if (!campaign.slangTagPreviewUrl) return;
    if (isOwnerPlaying(owner)) {
      stopOwner(owner);
      setPlaying(false);
      return;
    }
    playExclusive(owner, campaign.slangTagPreviewUrl, () => setPlaying(false));
    setPlaying(true);
  };

  // F6: Ziel ausschliesslich aus bestehenden Y-Dude-Routen; fehlt das Asset,
  // gibt es keinen CTA (kein Fake-Link).
  const target = campaignCtaTarget(campaign);
  const ctaLabel =
    target?.kind === "listen"
      ? c.ctaListen
      : target?.kind === "slangtag"
        ? c.ctaSlangTag
        : c.ctaProfile;
  const ctaClass =
    "inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground";

  return (
    <article
      ref={cardRef}
      data-testid="feed-campaign"
      data-campaign-id={campaign.id}
      data-position={position}
      className="relative overflow-hidden rounded-2xl border border-brand/40 bg-card p-4 shadow-sm"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-brand">
          <Megaphone className="h-3 w-3" /> {c.sponsored}
        </span>
        <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] uppercase tracking-widest text-accent-foreground">
          {c.label}
        </span>
        <div className="ml-auto">
          <CloseButton onClick={onDismiss} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {campaign.companyLogo ? (
          <img
            src={campaign.companyLogo}
            alt={campaign.company}
            className="h-9 w-9 rounded-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
            {campaign.company.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{campaign.company}</p>
          {campaign.region ? (
            <p className="truncate text-[11px] text-muted-foreground">{campaign.region}</p>
          ) : null}
        </div>
      </div>

      <h3 className="mt-3 text-base font-bold text-foreground">{campaign.name}</h3>
      {campaign.caption ? (
        <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{campaign.caption}</p>
      ) : null}

      {campaign.hashtags.length > 0 ? (
        <p className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-brand">
          {campaign.hashtags.map((t) => (
            <span key={t}>#{t}</span>
          ))}
        </p>
      ) : null}

      {campaign.isDrop ? (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
          <Gift className="h-3 w-3" /> {c.drop}
          {campaign.dropRemaining != null ? (
            <span className="text-muted-foreground">
              {campaign.dropRemaining} {c.dropLeft}
            </span>
          ) : null}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {campaign.slangTagName ? (
          <button
            type="button"
            onClick={toggleAudio}
            disabled={!campaign.slangTagPreviewUrl}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground disabled:opacity-50"
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            $${campaign.slangTagName}
            <span className="text-muted-foreground">{c.listen}</span>
          </button>
        ) : null}
        {target?.kind === "listen" ? (
          <button
            type="button"
            onClick={() => {
              onClick();
              toggleAudio();
            }}
            className={ctaClass}
          >
            <Play className="h-3.5 w-3.5" /> {ctaLabel}
          </button>
        ) : null}
        {target?.kind === "slangtag" ? (
          <Link
            to="/slangtag/$name"
            params={{ name: target.name }}
            onClick={onClick}
            className={ctaClass}
          >
            {ctaLabel}
          </Link>
        ) : null}
        {target?.kind === "profile" ? (
          <Link
            to="/profile/$username"
            params={{ username: target.username }}
            onClick={onClick}
            className={ctaClass}
          >
            {ctaLabel}
          </Link>
        ) : null}
        {!target && campaign.ctaUrl ? (
          <a
            href={campaign.ctaUrl}
            target="_blank"
            rel="noopener noreferrer nofollow sponsored"
            onClick={onClick}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground"
          >
            {c.open} <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>
    </article>
  );
}
