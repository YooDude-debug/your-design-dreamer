/**
 * „Meine Market-Statistik“ und Verkäuferprofil (Phase 4).
 *
 * Die Zahlen kommen aus der Datenbankfunktion `market_seller_stats`; sie
 * liefert nur Werte für den eigenen Account (bzw. für Admins). Es entsteht
 * keine zweite Zählung im Frontend.
 */

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { BadgeCheck, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import {
  getMarketSellerProfile,
  getMarketSellerStats,
  listMyMarketPromotions,
  saveMarketSellerProfile,
} from "@/lib/market.functions";
import { formatMarketPrice, marketTexts } from "@/lib/i18n-market";
import type { Lang } from "@/lib/i18n-dict";
import { relativeTime } from "@/lib/types";

type SellerType = "private" | "business" | "professional";

export function MarketSellerDashboard({ lang }: { lang: Lang }) {
  const m = marketTexts[lang];
  const qc = useQueryClient();
  const loadStats = useServerFn(getMarketSellerStats);
  const loadProfile = useServerFn(getMarketSellerProfile);
  const loadPromotions = useServerFn(listMyMarketPromotions);
  const saveProfile = useServerFn(saveMarketSellerProfile);

  const statsQuery = useQuery({ queryKey: ["market-seller-stats"], queryFn: () => loadStats() });
  const profileQuery = useQuery({
    queryKey: ["market-seller-profile"],
    queryFn: () => loadProfile({ data: {} }),
  });
  const promoQuery = useQuery({
    queryKey: ["market-my-promotions"],
    queryFn: () => loadPromotions(),
  });

  const [sellerType, setSellerType] = useState<SellerType>("private");
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const p = profileQuery.data;
    if (!p) return;
    setSellerType(p.sellerType);
    setBusinessName(p.businessName ?? "");
    setDescription(p.description ?? "");
    setWebsite(p.website ?? "");
  }, [profileQuery.data]);

  const stats = statsQuery.data;
  const promotions = promoQuery.data ?? [];

  const statusLabel: Record<string, string> = {
    requested: m.promoStatusRequested,
    active: m.promoStatusActive,
    expired: m.promoStatusExpired,
    cancelled: m.promoStatusCancelled,
  };

  async function submit() {
    setSaving(true);
    try {
      await saveProfile({
        data: {
          sellerType,
          businessName: businessName || null,
          description: description || null,
          website: website || null,
          logoPath: profileQuery.data?.logoPath ?? null,
        },
      });
      toast.success(m.profileSaved);
      void qc.invalidateQueries({ queryKey: ["market-seller-profile"] });
    } catch {
      toast.error(m.updateFailed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <Link
        to="/business"
        className="flex items-center gap-2 rounded-2xl border border-brand/40 bg-brand/10 px-3 py-2 text-xs font-semibold text-brand"
      >
        <BadgeCheck className="h-4 w-4" />
        Y-Dude Business
      </Link>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">{m.myStats}</h2>
        {statsQuery.isLoading || !stats ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {m.loading}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCard label={m.statsActive} value={stats.activeItems} />
            <StatCard label={m.statsSold} value={stats.soldItems} />
            <StatCard label={m.statsViews} value={stats.views} />
            <StatCard label={m.statsFavorites} value={stats.favorites} />
            <StatCard label={m.statsContacts} value={stats.contacts} />
            <StatCard label={m.statsOffers} value={stats.offers} />
            <StatCard label={m.statsPromoted} value={stats.promotedItems} />
            <StatCard label={m.statusReserved} value={stats.reservedItems} />
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-brand" />
          {m.myPromotions}
        </h2>
        {promotions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{m.noPromotions}</p>
        ) : (
          <ul className="space-y-2">
            {promotions.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-card/60 p-3 text-sm"
              >
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {p.itemTitle ?? "—"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {p.durationDays} {m.promoteDays} · {formatMarketPrice(p.priceCents, lang)}
                </span>
                <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                  {statusLabel[p.status] ?? p.status}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {relativeTime(p.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border/60 bg-card/60 p-3">
        <h2 className="mb-2 text-sm font-semibold text-foreground">{m.sellerProfile}</h2>
        <div className="flex gap-2">
          {(["private", "business"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setSellerType(type)}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                sellerType === type
                  ? "border-brand/60 bg-brand/10 text-brand"
                  : "border-border text-muted-foreground hover:border-brand/50"
              }`}
            >
              {type === "private" ? m.sellerTypePrivate : m.sellerTypeBusiness}
            </button>
          ))}
          {profileQuery.data?.verifiedBusiness && (
            <span className="self-center rounded-full border border-brand/50 px-2 py-0.5 text-[11px] text-brand">
              {m.verifiedBusiness}
            </span>
          )}
        </div>

        {sellerType !== "private" && (
          <div className="mt-3 space-y-2">
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder={m.businessNameLabel}
              maxLength={80}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={m.businessDescLabel}
              maxLength={600}
              rows={3}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder={m.websiteLabel}
              maxLength={200}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        )}

        <button
          onClick={() => void submit()}
          disabled={saving}
          className="mt-3 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
        >
          {m.saveProfile}
        </button>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-3">
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
