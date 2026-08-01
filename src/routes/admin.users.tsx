import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Search, ShieldCheck, Ban, Trash2, AlertTriangle, Unlock, BadgeCheck } from "lucide-react";
import { adminGetUsers, adminUserAction } from "@/lib/admin.functions";
import type { AdminUserRow } from "@/lib/admin.shared";
import {
  AdminButton,
  AdminEmpty,
  AdminInput,
  AdminLoading,
  AdminPanel,
  AdminSection,
  formatDateTime,
} from "@/components/admin/AdminUI";

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: "Nutzerverwaltung — Y-Dude Admin" },
      { name: "description", content: "Nutzer suchen, verwarnen, sperren, entsperren, löschen und Rollen verwalten." },
      { property: "og:title", content: "Nutzerverwaltung — Y-Dude Admin" },
      { property: "og:description", content: "Nutzer suchen, sperren und Rollen verwalten." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminUsers,
});

function AdminUsers() {
  const load = useServerFn(adminGetUsers);
  const act = useServerFn(adminUserAction);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<AdminUserRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(
    async (q: string) => {
      setRows(null);
      try {
        setRows(await load({ data: { query: q } }));
      } catch {
        setRows([]);
      }
    },
    [load],
  );

  useEffect(() => {
    void refresh("");
  }, [refresh]);

  const run = async (
    userId: string,
    action: string,
    label: string,
    opts: { reason?: string; days?: number } = {},
  ) => {
    setBusy(true);
    try {
      await act({ data: { userId, action, reason: opts.reason ?? "", days: opts.days ?? 0 } });
      toast.success(label);
      await refresh(query);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Aktion fehlgeschlagen");
    }
    setBusy(false);
  };

  const askReason = (title: string) => window.prompt(title, "") ?? "";

  return (
    <AdminSection
      title="Nutzerverwaltung"
      description="Nutzer suchen, Profile öffnen, verwarnen, sperren, entsperren, löschen und Rollen verwalten."
      actions={
        <>
          <AdminInput value={query} onChange={setQuery} placeholder="Nutzer suchen…" className="w-44" />
          <AdminButton onClick={() => void refresh(query)} disabled={busy}>
            <Search className="h-3.5 w-3.5" /> Suchen
          </AdminButton>
        </>
      }
    >
      {rows === null ? (
        <AdminLoading />
      ) : rows.length === 0 ? (
        <AdminEmpty>Keine Nutzer gefunden.</AdminEmpty>
      ) : (
        <div className="space-y-2">
          {rows.map((u) => (
            <AdminPanel key={u.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`/profile/${u.username}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-semibold text-foreground hover:text-brand"
                    >
                      @{u.username}
                    </a>
                    {u.isAdmin && (
                      <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold text-brand">
                        ADMIN
                      </span>
                    )}
                    {u.verified && <BadgeCheck className="h-3.5 w-3.5 text-brand-cyan" />}
                    {u.banned && (
                      <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">
                        GESPERRT
                      </span>
                    )}
                    {u.warnings > 0 && (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] text-accent-foreground">
                        {u.warnings} Verwarnung(en)
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {u.displayName} · {u.location || "—"} · {u.language} · Level {u.level}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Registriert {formatDateTime(u.createdAt)} · Zuletzt gesehen{" "}
                    {formatDateTime(u.lastSeenAt)}
                    {u.banned && u.banReason ? ` · Grund: ${u.banReason}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <AdminButton
                    disabled={busy}
                    onClick={() => {
                      const reason = askReason("Grund der Verwarnung");
                      if (reason) void run(u.id, "warn", "Verwarnung gespeichert", { reason });
                    }}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" /> Verwarnen
                  </AdminButton>
                  {u.banned ? (
                    <AdminButton disabled={busy} onClick={() => void run(u.id, "unban", "Nutzer entsperrt")}>
                      <Unlock className="h-3.5 w-3.5" /> Entsperren
                    </AdminButton>
                  ) : (
                    <AdminButton
                      variant="danger"
                      disabled={busy}
                      onClick={() => {
                        const reason = askReason("Grund der Sperre");
                        if (!reason) return;
                        const days = Number(window.prompt("Dauer in Tagen (0 = dauerhaft)", "7") ?? "0");
                        void run(u.id, "ban", "Nutzer gesperrt", { reason, days });
                      }}
                    >
                      <Ban className="h-3.5 w-3.5" /> Sperren
                    </AdminButton>
                  )}
                  <AdminButton
                    disabled={busy}
                    onClick={() =>
                      void run(
                        u.id,
                        u.isAdmin ? "revoke_admin" : "grant_admin",
                        u.isAdmin ? "Adminrolle entfernt" : "Adminrolle erteilt",
                      )
                    }
                  >
                    <ShieldCheck className="h-3.5 w-3.5" /> {u.isAdmin ? "Admin entziehen" : "Admin"}
                  </AdminButton>
                  <AdminButton
                    disabled={busy}
                    onClick={() =>
                      void run(
                        u.id,
                        u.verified ? "unverify" : "verify",
                        u.verified ? "Verifizierung entfernt" : "Nutzer verifiziert",
                      )
                    }
                  >
                    <BadgeCheck className="h-3.5 w-3.5" /> {u.verified ? "Unverifizieren" : "Verifizieren"}
                  </AdminButton>
                  <AdminButton
                    variant="danger"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`@${u.username} endgültig löschen?`))
                        void run(u.id, "delete", "Nutzer gelöscht");
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Löschen
                  </AdminButton>
                </div>
              </div>
            </AdminPanel>
          ))}
        </div>
      )}
    </AdminSection>
  );
}
