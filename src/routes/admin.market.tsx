/**
 * Admin: Y-Dude Market – Hervorhebungen freigeben oder abschalten und die
 * wichtigsten Market-Kennzahlen sehen.
 *
 * Es gibt hier keine Bezahlung: eine Hervorhebung wird ausschliesslich
 * manuell freigegeben. Die Rechte kommen aus der bestehenden Adminrolle.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import {
  decideMarketPromotion,
  getMarketEventTotals,
  listMarketPromotionsAdmin,
} from "@/lib/market.functions";
import { AdminSection, AdminLoading } from "@/components/admin/AdminUI";
import { AdminMarketTransactions } from "@/components/admin/AdminMarketTransactions";

export const Route = createFileRoute("/admin/market")({
  head: () => ({
    meta: [
      { title: "Market-Moderation — Y-Dude Admin" },
      {
        name: "description",
        content:
          "Hervorgehobene Market-Artikel freigeben oder abschalten und Market-Kennzahlen einsehen.",
      },
      { property: "og:title", content: "Market-Moderation — Y-Dude Admin" },
      { property: "og:description", content: "Hervorhebungen und Kennzahlen im Y-Dude Market." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminMarket,
});

type Promotion = Awaited<ReturnType<typeof listMarketPromotionsAdmin>>[number];
type Totals = Awaited<ReturnType<typeof getMarketEventTotals>>;

const STATUS_LABEL: Record<string, string> = {
  requested: "In Prüfung",
  active: "Läuft",
  expired: "Abgelaufen",
  cancelled: "Abgebrochen",
};

function AdminMarket() {
  const loadPromotions = useServerFn(listMarketPromotionsAdmin);
  const loadTotals = useServerFn(getMarketEventTotals);
  const decide = useServerFn(decideMarketPromotion);

  const [promotions, setPromotions] = useState<Promotion[] | null>(null);
  const [totals, setTotals] = useState<Totals>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const [p, t] = await Promise.all([
        loadPromotions({ data: {} }),
        loadTotals({ data: { days: 7 } }),
      ]);
      setPromotions(p);
      setTotals(t);
    } catch {
      setPromotions([]);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(id: string, action: "activate" | "cancel") {
    setBusy(id);
    try {
      await decide({ data: { promotionId: id, action } });
      await refresh();
      toast.success(action === "activate" ? "Hervorhebung aktiv" : "Hervorhebung abgeschaltet");
    } catch {
      toast.error("Aktion fehlgeschlagen");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <h1 className="inline-flex items-center gap-2 text-xl font-bold tracking-tight">
        <Sparkles className="h-5 w-5 text-brand" />
        Market-Moderation
      </h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Hervorhebungen werden manuell freigegeben. Es findet keine Bezahlung im System statt.
      </p>

      <AdminSection
        title="Kennzahlen (7 Tage)"
        description="Produkt-Ereignisse ohne Standorte oder Inhalte."
      >
        {totals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Ereignisse.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {totals.map((t) => (
              <div key={t.event} className="rounded-2xl border border-border/60 bg-card/60 p-3">
                <p className="text-lg font-bold text-foreground">{t.count}</p>
                <p className="text-[11px] text-muted-foreground">{t.event}</p>
              </div>
            ))}
          </div>
        )}
      </AdminSection>

      <AdminSection title="Hervorhebungen">
        {promotions === null ? (
          <AdminLoading />
        ) : promotions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Anfragen vorhanden.</p>
        ) : (
          <ul className="space-y-2">
            {promotions.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-card/60 p-3 text-sm"
              >
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {p.itemTitle ?? p.itemId}
                </span>
                <span className="text-xs text-muted-foreground">
                  {p.durationDays} Tage · {(p.priceCents / 100).toFixed(2)} {p.currency}
                </span>
                <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                  {STATUS_LABEL[p.status] ?? p.status}
                </span>
                {p.status !== "active" && (
                  <button
                    onClick={() => void act(p.id, "activate")}
                    disabled={busy !== null}
                    className="rounded-full border border-brand/50 px-3 py-1 text-xs text-brand hover:bg-brand/10 disabled:opacity-60"
                  >
                    Freigeben
                  </button>
                )}
                <button
                  onClick={() => void act(p.id, "cancel")}
                  disabled={busy !== null}
                  className="rounded-full border border-destructive/50 px-3 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-60"
                >
                  Abschalten
                </button>
                {busy === p.id && <Loader2 className="h-4 w-4 animate-spin text-brand" />}
              </li>
            ))}
          </ul>
        )}
      </AdminSection>

      <AdminMarketTransactions />
    </div>
  );
}
