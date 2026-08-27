/**
 * Dialog „Angebot machen“ – mobil vollstaendig sichtbar (scrollbar, safe-area).
 */

import { CloseButton } from "@/components/ui/nav-buttons";
import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { formatMarketPrice, marketTexts } from "@/lib/i18n-market";

export function MarketOfferDialog({
  open,
  itemTitle,
  itemPriceCents,
  busy,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  itemTitle: string;
  itemPriceCents: number;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (amountCents: number) => void;
}) {
  const { lang } = useLang();
  const m = marketTexts[lang];
  const [amount, setAmount] = useState("");
  if (!open) return null;

  const cents = Math.max(0, Math.round(Number(amount.replace(",", ".")) * 100) || 0);

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-3 sm:items-center">
      <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-3xl border border-border/60 bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-foreground">{m.offerHeading}</h2>
            <p className="truncate text-xs text-muted-foreground">{itemTitle}</p>
          </div>
          <CloseButton onClick={onCancel} label={m.cancel} className="shrink-0" />
        </div>

        <p className="text-xs text-muted-foreground">
          {m.offerItemPrice}: {formatMarketPrice(itemPriceCents, lang)}
        </p>

        <label className="mt-3 block text-xs font-medium text-muted-foreground">
          {m.offerYours}
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            className="mt-1 w-full rounded-2xl border border-border bg-background px-3 py-3 text-base text-foreground outline-none focus:border-brand/60"
          />
        </label>

        <button
          type="button"
          disabled={busy || cents <= 0}
          onClick={() => onSubmit(cents)}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-brand px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? m.offerSending : m.offerSend}
        </button>
      </div>
    </div>
  );
}
