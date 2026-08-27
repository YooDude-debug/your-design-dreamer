/**
 * Y-Dude Market – Artikel-Detailseite (Phase 1).
 *
 * Kontakt zum Verkäufer läuft ausschließlich über den bestehenden Y-Dude
 * Messenger (`openMarketChat` + Messenger-Panel). Es gibt keinen eigenen
 * Market-Chat.
 */

import { BackButton } from "@/components/ui/nav-buttons";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  BadgeCheck,
  CreditCard,
  Heart,
  ImageOff,
  Loader2,
  MapPin,
  MessageSquare,
  Sparkles,
  Trash2,
} from "lucide-react";

import { goBackOr } from "@/lib/back-nav";
import { useLang } from "@/lib/lang-context";
import { formatMarketPrice, marketTexts } from "@/lib/i18n-market";
import { marketTxTexts } from "@/lib/i18n-market-tx";
import { startMarketTransaction } from "@/lib/market-tx.functions";
import {
  attachMarketContext,
  getMarketItem,
  trackMarketEvent,
  setMarketItemStatus,
  toggleMarketFavorite,
} from "@/lib/market.functions";
import { MarketSlangTagList } from "@/components/market/MarketSlangTagField";
import { signPaths, variantPath } from "@/lib/media";
import { useSocial } from "@/lib/social-context";
import { useSocialUI } from "@/lib/social-ui-context";
import { useData } from "@/lib/data-context";
import { MarketSimilarItems } from "@/components/market/MarketSimilarItems";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PromoteItemDialog } from "@/components/market/PromoteItemDialog";
import { formatDate } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/market/$itemId")({
  head: () => ({
    meta: [
      { title: "Artikel — Y-Dude Market" },
      {
        name: "description",
        content: "Artikeldetails bei Y-Dude Market: Preis, Zustand, Standort und Kontakt.",
      },
      { property: "og:title", content: "Artikel — Y-Dude Market" },
      { property: "og:description", content: "Lokal kaufen und verkaufen mit Y-Dude." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => <Notice kind="error" />,
  notFoundComponent: () => <Notice kind="notFound" />,
  component: MarketItemPage,
});

function Notice({ kind }: { kind: "error" | "notFound" }) {
  const { lang } = useLang();
  const m = marketTexts[lang];
  return (
    <div className="mx-auto max-w-2xl p-6 text-sm text-muted-foreground">
      {kind === "error" ? m.loadFailed : m.notFound}
    </div>
  );
}

function MarketItemPage() {
  const { itemId } = Route.useParams();
  const { lang } = useLang();
  const m = marketTexts[lang];
  const router = useRouter();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useData();
  const { openMarketChat } = useSocial();
  const { openMessenger } = useSocialUI();

  const load = useServerFn(getMarketItem);
  const setStatus = useServerFn(setMarketItemStatus);
  const toggleFav = useServerFn(toggleMarketFavorite);
  const attachContext = useServerFn(attachMarketContext);
  const startTx = useServerFn(startMarketTransaction);
  const tx = marketTxTexts[lang];
  const [fulfillmentOpen, setFulfillmentOpen] = useState(false);

  const [urls, setUrls] = useState<Record<string, string>>({});
  const [active, setActive] = useState(0);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const track = useServerFn(trackMarketEvent);

  const { data: item, isLoading } = useQuery({
    queryKey: ["market-item", itemId],
    queryFn: () => load({ data: { itemId } }),
    staleTime: 30_000,
  });

  // Produkt-Statistik: nur das Ereignis, keine Inhalte oder Standorte.
  useEffect(() => {
    if (!item) return;
    void track({
      data: {
        event: "market_item_view",
        itemId: item.id,
        meta: { promoted: !!item.promotedUntil },
      },
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  const paths = (item?.imagePaths ?? []).join("|");
  useEffect(() => {
    const list = item?.imagePaths ?? [];
    if (list.length === 0) {
      setUrls({});
      return;
    }
    let alive = true;
    const all = list.flatMap((p) => [variantPath(p, "medium"), p]);
    void signPaths(all).then((map) => {
      if (!alive) return;
      const next: Record<string, string> = {};
      for (const p of list) {
        const medium = variantPath(p, "medium");
        const url = (medium && map[medium]) ?? map[p];
        if (url) next[p] = url;
      }
      setUrls(next);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paths]);

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {m.loading}
      </p>
    );
  }
  if (!item) return <Notice kind="notFound" />;

  const isOwner = user?.id === item.sellerId;
  const conditionLabel =
    item.condition === "new"
      ? m.condNew
      : item.condition === "like_new"
        ? m.condLikeNew
        : item.condition === "good"
          ? m.condGood
          : m.condUsed;
  const deliveryLabel =
    item.delivery === "pickup"
      ? m.delPickup
      : item.delivery === "shipping"
        ? m.delShipping
        : m.delBoth;
  const statusLabel =
    item.status === "sold"
      ? m.statusSold
      : item.status === "reserved"
        ? m.statusReserved
        : item.status === "disabled"
          ? m.statusDisabled
          : m.statusActive;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["market-item", itemId] });

  const contact = async () => {
    if (isOwner) return;
    // Market-Gespraeche laufen in einer eigenen Unterhaltung je Artikel und
    // erscheinen nur in der Market-Kategorie des Messengers.
    const conversationId = await openMarketChat(item.sellerId, itemId);
    if (!conversationId) return;
    try {
      await attachContext({ data: { conversationId, itemId } });
    } catch (e) {
      console.error("[market] context failed", (e as Error).message);
    }
    void track({ data: { event: "market_contact_seller", itemId } }).catch(() => undefined);
    openMessenger(item.sellerId, conversationId);
  };

  const beginPurchase = async (fulfillment: "pickup" | "shipping") => {
    setFulfillmentOpen(false);
    setBusy(true);
    try {
      const res = await startTx({ data: { itemId, fulfillment } });
      if ("error" in res) throw new Error(res.error);
      void navigate({ to: "/market/checkout/$txId", params: { txId: res.transactionId } });
    } catch (e) {
      console.error("[market] buy failed", (e as Error).message);
      toast.error(m.updateFailed);
    } finally {
      setBusy(false);
    }
  };

  const startBuy = async () => {
    if (isOwner) return;
    if (item.delivery === "both") {
      setFulfillmentOpen(true);
      return;
    }
    await beginPurchase(item.delivery === "pickup" ? "pickup" : "shipping");
  };

  const changeStatus = async (status: "active" | "reserved" | "sold" | "deleted") => {
    setBusy(true);
    try {
      await setStatus({ data: { itemId, status } });
      if (status === "deleted") {
        toast.success(m.deleted);
        void queryClient.invalidateQueries({ queryKey: ["market-items"] });
        void navigate({ to: "/market", replace: true });
        return;
      }
      await refresh();
      void queryClient.invalidateQueries({ queryKey: ["market-items"] });
    } catch (e) {
      console.error("[market] status failed", (e as Error).message);
      toast.error(m.updateFailed);
    } finally {
      setBusy(false);
      setDeleteOpen(false);
    }
  };

  const favorite = async () => {
    try {
      await toggleFav({ data: { itemId } });
      await refresh();
    } catch (e) {
      console.error("[market] favorite failed", (e as Error).message);
      toast.error(m.updateFailed);
    }
  };

  const currentPath = item.imagePaths[active] ?? null;
  const currentUrl = currentPath ? urls[currentPath] : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-3 pb-28 pt-3 sm:px-4">
      <BackButton onClick={() => goBackOr(router, "/market")} label={m.back} className="mb-4" />

      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card/50">
        <div className="relative aspect-square w-full bg-muted/30 sm:aspect-[4/3]">
          {currentUrl ? (
            <img src={currentUrl} alt={item.title} className="h-full w-full object-contain" />
          ) : (
            <div className="grid h-full w-full place-items-center text-muted-foreground">
              <ImageOff className="h-8 w-8" />
            </div>
          )}
          <span className="absolute left-3 top-3 rounded-full bg-background/85 px-2.5 py-1 text-[11px] font-semibold text-foreground backdrop-blur">
            {statusLabel}
          </span>
        </div>

        {item.imagePaths.length > 1 && (
          <div className="flex gap-2 overflow-x-auto p-3">
            {item.imagePaths.map((p, i) => (
              <button
                key={p}
                onClick={() => setActive(i)}
                className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border ${
                  i === active ? "border-brand" : "border-border/60"
                }`}
              >
                {urls[p] ? (
                  <img src={urls[p]} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="block h-full w-full bg-muted/40" />
                )}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-foreground">{item.title}</h1>
              <p className="mt-1 text-xl font-bold text-brand">
                {formatMarketPrice(item.priceCents, lang)}
                {item.negotiable && item.priceCents > 0 && (
                  <span className="ml-2 text-[11px] font-medium text-muted-foreground">
                    {m.negotiable}
                  </span>
                )}
              </p>
            </div>
            {!isOwner && (
              <button
                onClick={() => void favorite()}
                aria-label={item.favorited ? m.favorited : m.favorite}
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border transition-colors ${
                  item.favorited
                    ? "border-brand/60 text-brand"
                    : "border-border text-muted-foreground hover:border-brand/60 hover:text-brand"
                }`}
              >
                <Heart className={`h-4 w-4 ${item.favorited ? "fill-current" : ""}`} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <span className="rounded-full border border-border/60 px-2.5 py-1">
              {conditionLabel}
            </span>
            <span className="rounded-full border border-border/60 px-2.5 py-1">
              {deliveryLabel}
            </span>
            {item.place && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2.5 py-1">
                <MapPin className="h-3 w-3" />
                {item.place}
              </span>
            )}
            <span className="rounded-full border border-border/60 px-2.5 py-1">
              {formatDate(item.createdAt)}
            </span>
          </div>

          {item.description && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {item.description}
            </p>
          )}

          <MarketSlangTagList tagIds={item.slangTagIds} />

          {item.seller && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-3 text-sm">
              <span className="text-xs text-muted-foreground">{m.seller}:</span>
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                {item.seller.displayName || `@${item.seller.username}`}
                {item.seller.verified && <BadgeCheck className="h-3.5 w-3.5 text-brand" />}
              </span>
              {item.sellerSince && (
                <span className="text-[11px] text-muted-foreground">
                  {m.memberSince} {new Date(item.sellerSince).getFullYear()}
                </span>
              )}
            </div>
          )}

          {isOwner ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {item.status !== "active" && (
                <button
                  onClick={() => void changeStatus("active")}
                  disabled={busy}
                  className="rounded-full border border-border px-4 py-2 text-xs text-muted-foreground hover:border-brand/50 hover:text-brand disabled:opacity-60"
                >
                  {m.markActive}
                </button>
              )}
              {item.status !== "reserved" && (
                <button
                  onClick={() => void changeStatus("reserved")}
                  disabled={busy}
                  className="rounded-full border border-border px-4 py-2 text-xs text-muted-foreground hover:border-brand/50 hover:text-brand disabled:opacity-60"
                >
                  {m.markReserved}
                </button>
              )}
              {item.status !== "sold" && (
                <button
                  onClick={() => void changeStatus("sold")}
                  disabled={busy}
                  className="rounded-full border border-border px-4 py-2 text-xs text-muted-foreground hover:border-brand/50 hover:text-brand disabled:opacity-60"
                >
                  {m.markSold}
                </button>
              )}
              {item.status === "active" && !item.promotedUntil && (
                <button
                  onClick={() => setPromoteOpen(true)}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-full border border-brand/50 px-4 py-2 text-xs text-brand hover:bg-brand/10 disabled:opacity-60"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {m.promoteItem}
                </button>
              )}
              <button
                onClick={() => setDeleteOpen(true)}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-full border border-destructive/50 px-4 py-2 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {m.deleteItem}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void contact()}
                className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-primary-foreground active:scale-[0.98]"
              >
                <MessageSquare className="h-4 w-4" />
                {m.contactSeller}
              </button>
              {item.status === "active" && (
                <button
                  onClick={() => void startBuy()}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-full border border-brand/60 px-5 py-2.5 text-sm font-semibold text-brand disabled:opacity-60"
                >
                  <CreditCard className="h-4 w-4" />
                  {tx.buy}
                  {item.delivery === "both"
                    ? ""
                    : ` · ${item.delivery === "pickup" ? tx.pickup : tx.shipping}`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {fulfillmentOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog">
          <div className="w-full max-w-xs rounded-2xl border border-border/60 bg-card p-4">
            <p className="text-sm font-semibold">{tx.chooseFulfillment}</p>
            <div className="mt-3 grid gap-2">
              <button
                onClick={() => void beginPurchase("pickup")}
                className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                {tx.pickup}
              </button>
              <button
                onClick={() => void beginPurchase("shipping")}
                className="rounded-xl border border-border/60 px-4 py-2 text-sm"
              >
                {tx.shipping}
              </button>
              <button
                onClick={() => setFulfillmentOpen(false)}
                className="px-4 py-1 text-xs text-muted-foreground"
              >
                {m.back}
              </button>
            </div>
          </div>
        </div>
      )}

      <PromoteItemDialog
        itemId={item.id}
        lang={lang}
        open={promoteOpen}
        onClose={() => setPromoteOpen(false)}
      />

      <MarketSimilarItems itemId={item.id} lang={lang} />

      <ConfirmDialog
        open={deleteOpen}
        title={m.deleteItem}
        message={m.deleteConfirm}
        confirmLabel={m.deleteItem}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => void changeStatus("deleted")}
      />
    </div>
  );
}
