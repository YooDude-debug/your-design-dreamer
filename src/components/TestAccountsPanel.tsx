import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  Copy,
  Check,
  Loader2,
  ShieldCheck,
  Trash2,
  UserPlus,
  ChevronDown,
  ChevronUp,
  LayoutDashboard,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import {
  listTestAccounts,
  seedTestAccounts,
  deleteTestAccounts,
  type TestAccount,
} from "@/lib/test-accounts.functions";


function CopyButton({ value }: { value: string }) {
  const { t } = useLang();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setDone(true);
        window.setTimeout(() => setDone(false), 1200);
      }}
      title={done ? t.copied : t.copy}
      className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:border-brand/60 hover:text-brand"
    >
      {done ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

/** Nur für Administratoren sichtbare Übersicht der Testaccount-Zugangsdaten. */
export function TestAccountsPanel() {
  const { t, locale } = useLang();
  const load = useServerFn(listTestAccounts);
  const seed = useServerFn(seedTestAccounts);
  const wipe = useServerFn(deleteTestAccounts);

  const [isAdmin, setIsAdmin] = useState(false);
  const [accounts, setAccounts] = useState<TestAccount[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const res = await load({});
      setIsAdmin(res.isAdmin);
      setAccounts(res.accounts);
    } catch {
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isAdmin) return null;

  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
      toast.success(message);
    } catch {
      toast.error(t.actionFailed);
    }
    setBusy(false);
  };

  return (
    <section className="rounded-2xl border border-brand/30 bg-surface/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 text-xs font-bold tracking-widest text-brand">
          <ShieldCheck className="h-4 w-4" /> {t.devMode} · {t.testAccounts}
        </h2>
        {busy && <Loader2 className="h-4 w-4 animate-spin text-brand" />}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{t.testAccountsDesc}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => seed({}), t.testAccountsCreated)}
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          <UserPlus className="h-3.5 w-3.5" /> {busy ? t.creating : t.createTestAccounts}
        </button>
        {accounts.length > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => wipe({}), t.testAccountsDeleted)}
            className="inline-flex items-center gap-1.5 rounded-full border border-destructive/50 px-3 py-1.5 text-xs font-semibold text-destructive disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> {t.deleteTestAccounts}
          </button>
        )}
      </div>

      {accounts.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          {t.noTestAccounts}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {accounts.map((a) => (
            <li key={a.id} className="rounded-xl border border-border bg-background/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">@{a.username}</span>
                <span className="text-[10px] text-muted-foreground">
                  {t.registeredAt}: {new Date(a.registeredAt).toLocaleDateString(locale)}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="shrink-0 uppercase tracking-wider">{t.email}</span>
                <span className="truncate font-mono">{a.email}</span>
                <CopyButton value={a.email} />
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="shrink-0 uppercase tracking-wider">{t.initialPassword}</span>
                <span className="truncate font-mono">{a.initialPassword}</span>
                <CopyButton value={a.initialPassword} />
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                {a.region} · {a.language}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
