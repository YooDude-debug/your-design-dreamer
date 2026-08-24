/**
 * Hervorhebung anfragen (Phase 4).
 *
 * Ganz bewusst ohne Bezahlung: der Verkäufer wählt ein Paket, die Anfrage
 * geht in die Moderation. Preise sind reine Anzeige.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { listMarketPromotionPlans, requestMarketPromotion } from "@/lib/market.functions";
import { formatMarketPrice, marketTexts } from "@/lib/i18n-market";
import type { Lang } from "@/lib/i18n-dict";

export function PromoteItemDialog({
  itemId,
  lang,
  open,
  onClose,
}: {
  itemId: string;
  lang: Lang;
  open: boolean;
  onClose: () => void;
}) {
  const m = marketTexts[lang];
  const loadPlans = useServerFn(listMarketPromotionPlans);
  const request = useServerFn(requestMarketPromotion);
  const [busy, setBusy] = useState<string | null>(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["market-promotion-plans"],
    queryFn: () => loadPlans(),
    enabled: open,
    staleTime: 300_000,
  });

  if (!open) return null;

  async function pick(code: string) {
    setBusy(code);
    try {
      await request({ data: { itemId, planCode: code, radiusKm: null } });
      toast.success(m.promoteRequested);
      onClose();
    } catch {
      toast.error(m.promoteFailed);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand" />
          <h2 className="text-sm font-semibold text-foreground">{m.promoteHeading}</h2>
          <button
            onClick={onClose}
            aria-label={m.cancel}
            className="ml-auto grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground hover:text-brand"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">{m.promoteHint}</p>

        {isLoading ? (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {m.loading}
          </p>
        ) : (
          <ul className="space-y-2">
            {plans.map((plan) => (
              <li key={plan.code}>
                <button
                  onClick={() => void pick(plan.code)}
                  disabled={busy !== null}
                  className="flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2 text-left transition-colors hover:border-brand/60 disabled:opacity-60"
                >
                  <span className="text-sm font-medium text-foreground">
                    {plan.durationDays} {m.promoteDays}
                  </span>
                  <span className="ml-auto text-sm font-bold text-brand">
                    {formatMarketPrice(plan.priceCents, lang)}
                  </span>
                  {busy === plan.code && <Loader2 className="h-4 w-4 animate-spin text-brand" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
