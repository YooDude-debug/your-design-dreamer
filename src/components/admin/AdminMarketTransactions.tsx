/**
 * Admin: Market-Vorgänge, offene Rückerstattungen und Konfliktfälle.
 *
 * Entscheidungen laufen ausschließlich über Server-Functions mit
 * Adminprüfung; hier werden nur Zustände angezeigt und weitergereicht.
 */

import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  adminDecideMarketDispute,
  adminDecideMarketRefund,
  adminListMarketCases,
  adminListMarketTransactions,
  adminSetMarketFeeSettings,
  getMarketFeeSettings,
} from "@/lib/market-tx.functions";
import { AdminSection } from "@/components/admin/AdminUI";

type Cases = Awaited<ReturnType<typeof adminListMarketCases>>;
type Txs = Awaited<ReturnType<typeof adminListMarketTransactions>>;

function euro(cents: number) {
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}

export function AdminMarketTransactions() {
  const loadTx = useServerFn(adminListMarketTransactions);
  const loadCases = useServerFn(adminListMarketCases);
  const decideRefund = useServerFn(adminDecideMarketRefund);
  const decideDispute = useServerFn(adminDecideMarketDispute);
  const loadFees = useServerFn(getMarketFeeSettings);
  const saveFees = useServerFn(adminSetMarketFeeSettings);

  const [txs, setTxs] = useState<Txs | null>(null);
  const [cases, setCases] = useState<Cases | null>(null);
  const [feeBps, setFeeBps] = useState(0);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const [t, c, f] = await Promise.all([
        loadTx({ data: { limit: 25, offset: 0 } }),
        loadCases({}),
        loadFees({}),
      ]);
      setTxs(t);
      setCases(c);
      setFeeBps(f.platformFeeBps);
    } catch {
      setTxs([]);
      setCases({ refunds: [], disputes: [] });
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      toast.success("Gespeichert.");
      await refresh();
    } catch {
      toast.error("Aktion fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AdminSection title="Gebührenmodell">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="text-muted-foreground">Plattformgebühr (Basispunkte)</label>
          <input
            type="number"
            min={0}
            max={2000}
            value={feeBps}
            onChange={(e) => setFeeBps(Number(e.target.value))}
            className="w-24 rounded-lg border border-border bg-background px-2 py-1"
          />
          <span className="text-xs text-muted-foreground">= {(feeBps / 100).toFixed(2)} %</span>
          <button
            disabled={busy}
            onClick={() =>
              void act(() =>
                saveFees({ data: { platformFeeBps: feeBps, platformFeeFixedCents: 0 } }),
              )
            }
            className="rounded-full border border-brand/60 px-3 py-1 text-xs text-brand"
          >
            Speichern
          </button>
        </div>
      </AdminSection>

      <AdminSection title="Rückerstattungen">
        {!cases ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : cases.refunds.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine offenen Anfragen.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {cases.refunds.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-2"
              >
                <Link
                  to="/market/tx/$txId"
                  params={{ txId: r.transactionId }}
                  className="text-brand"
                >
                  {euro(r.amountCents)}
                </Link>
                <span className="text-xs text-muted-foreground">{r.reason ?? "—"}</span>
                <span className="ml-auto flex gap-2">
                  <button
                    disabled={busy}
                    onClick={() =>
                      void act(() =>
                        decideRefund({ data: { refundId: r.id, status: "completed" } }),
                      )
                    }
                    className="rounded-full border border-brand/60 px-3 py-1 text-xs text-brand"
                  >
                    Erstatten
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void act(() => decideRefund({ data: { refundId: r.id, status: "failed" } }))
                    }
                    className="rounded-full border border-destructive/60 px-3 py-1 text-xs text-destructive"
                  >
                    Ablehnen
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </AdminSection>

      <AdminSection title="Konfliktfälle">
        {!cases ? null : cases.disputes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine offenen Fälle.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {cases.disputes.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-2"
              >
                <Link
                  to="/market/tx/$txId"
                  params={{ txId: d.transactionId }}
                  className="text-brand"
                >
                  {d.reasonCode}
                </Link>
                <span className="text-xs text-muted-foreground">{d.details ?? "—"}</span>
                <span className="ml-auto flex gap-2">
                  <button
                    disabled={busy}
                    onClick={() =>
                      void act(() =>
                        decideDispute({
                          data: { disputeId: d.id, status: "resolved", resolution: null },
                        }),
                      )
                    }
                    className="rounded-full border border-brand/60 px-3 py-1 text-xs text-brand"
                  >
                    Gelöst
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void act(() =>
                        decideDispute({
                          data: { disputeId: d.id, status: "rejected", resolution: null },
                        }),
                      )
                    }
                    className="rounded-full border border-destructive/60 px-3 py-1 text-xs text-destructive"
                  >
                    Abgelehnt
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </AdminSection>

      <AdminSection title="Letzte Vorgänge">
        {!txs ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : txs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Vorgänge.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {txs.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-2 rounded-xl border border-border p-2"
              >
                <Link
                  to="/market/tx/$txId"
                  params={{ txId: t.id }}
                  className="min-w-0 flex-1 truncate"
                >
                  {t.reference} · {t.itemTitle}
                </Link>
                <span className="text-xs text-muted-foreground">{t.status}</span>
                <span className="text-xs font-semibold text-brand">{euro(t.totalCents)}</span>
              </li>
            ))}
          </ul>
        )}
      </AdminSection>
    </>
  );
}
