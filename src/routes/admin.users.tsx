import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Search,
  ShieldCheck,
  Ban,
  Trash2,
  AlertTriangle,
  Unlock,
  BadgeCheck,
  Sparkles,
  BriefcaseBusiness,
  ChevronDown,
  Eye,
} from "lucide-react";
import { adminGetUsers, adminUserAction } from "@/lib/admin.functions";
import type { AdminUserRow, AdminUserSort } from "@/lib/admin.shared";
import {
  AdminButton,
  AdminEmpty,
  AdminInput,
  AdminLoading,
  AdminPanel,
  AdminSection,
  AdminSelect,
} from "@/components/admin/AdminUI";
import {
  AdminConfirmDialog,
  type AdminConfirmRequest,
} from "@/components/admin/AdminConfirmDialog";
import { AdminUserDetailDialog } from "@/components/admin/AdminUserDetailDialog";
import { formatDateTime } from "@/lib/format-date";
import { describeLastSeen } from "@/lib/last-seen";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/lang-context";

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: "Nutzerverwaltung — Y-Dude Admin" },
      {
        name: "description",
        content: "Nutzer suchen, verwarnen, sperren, entsperren, löschen und Rollen verwalten.",
      },
      { property: "og:title", content: "Nutzerverwaltung — Y-Dude Admin" },
      { property: "og:description", content: "Nutzer suchen, sperren und Rollen verwalten." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminUsers,
});

function AdminUsers() {
  const { t } = useLang();
  const load = useServerFn(adminGetUsers);
  const act = useServerFn(adminUserAction);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<AdminUserSort>("recent_activity");
  /** Tickt jede Minute, damit relative Zeiten („vor 5 Minuten“) mitlaufen. */
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [rows, setRows] = useState<AdminUserRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [selfId, setSelfId] = useState<string | null>(null);
  /** Geoeffnetes Rollen-Untermenue (pro Nutzerzeile). */
  const [rolesOpen, setRolesOpen] = useState<string | null>(null);
  /** Aktuell in der Detailansicht geöffneter Nutzer. */
  const [detailUser, setDetailUser] = useState<AdminUserRow | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setSelfId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const refresh = useCallback(
    async (q: string, s: AdminUserSort = sort) => {
      setRows(null);
      try {
        setRows(await load({ data: { query: q, sort: s } }));
        setNowTs(Date.now());
      } catch {
        setRows([]);
      }
    },
    [load, sort],
  );

  useEffect(() => {
    void refresh("", sort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  const run = async (
    userId: string,
    action: string,
    label: string,
    opts: { reason?: string; days?: number; masterPassword?: string } = {},
  ) => {
    setBusy(true);
    try {
      await act({
        data: {
          userId,
          action,
          reason: opts.reason ?? "",
          days: opts.days ?? 0,
          masterPassword: opts.masterPassword ?? "",
        },
      });
      toast.success(label);
      await refresh(query);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Aktion fehlgeschlagen");
    }
    setBusy(false);
  };

  /**
   * Rollenwechsel „admin“: das Master-Passwort wird nur für diesen einen
   * Request abgefragt und nirgends im Browser gespeichert. Die eigentliche
   * Berechtigungsprüfung erfolgt ausschließlich serverseitig.
   */
  const runAdminRoleChange = (userId: string, grant: boolean) => {
    const pw = window.prompt(
      grant
        ? "Master-Passwort zur Bestätigung der Adminrechte-Vergabe"
        : "Master-Passwort zur Bestätigung des Adminrechte-Entzugs",
      "",
    );
    if (!pw) return;
    void run(
      userId,
      grant ? "grant_admin" : "revoke_admin",
      grant ? "Adminrolle erteilt" : "Adminrolle entfernt",
      { masterPassword: pw },
    );
  };

  /**
   * Creator-/Unternehmerrechte: reine Ja/Nein-Bestaetigung. Die Berechtigung
   * des Administrators wurde bereits serverseitig geprueft (assertAdmin), eine
   * zusaetzliche Passwortabfrage ist daher nicht vorgesehen.
   */
  const runSimpleRoleChange = (userId: string, role: "creator" | "business", grant: boolean) => {
    const name = role === "creator" ? "Creator" : "Unternehmer";
    const question = grant
      ? `${name}-Rechte für diesen Benutzer vergeben?`
      : `${name}-Rechte für diesen Benutzer entfernen?`;
    if (!window.confirm(question)) return;
    void run(
      userId,
      `${grant ? "grant" : "revoke"}_${role === "creator" ? "creator" : "business"}`,
      grant ? `${name}-Rechte vergeben` : `${name}-Rechte entfernt`,
    );
  };

  /**
   * Kritische Aktionen laufen ausschließlich über den Bestätigungsdialog:
   * Button → Dialog → Bestätigen → Backend-Call. Beim Schließen passiert nichts.
   */
  const [confirmReq, setConfirmReq] = useState<AdminConfirmRequest | null>(null);

  return (
    <AdminSection
      title="Nutzerverwaltung"
      description="Nutzer suchen, Profile öffnen, verwarnen, sperren, entsperren, löschen und Rollen verwalten."
      actions={
        <>
          <AdminInput
            value={query}
            onChange={setQuery}
            placeholder="Nutzer suchen…"
            className="w-44"
          />
          <AdminSelect
            value={sort}
            onChange={(v) => setSort(v)}
            options={[
              { value: "recent_activity", label: "Zuletzt aktiv" },
              { value: "oldest_activity", label: "Älteste Aktivität" },
              { value: "newest_signup", label: "Neueste Registrierung" },
              { value: "oldest_signup", label: "Älteste Registrierung" },
            ]}
          />
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
                <div
                  className="min-w-0 cursor-pointer rounded-xl transition-colors hover:bg-accent/30"
                  onClick={() => setDetailUser(u)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {u.pendingProfile ? (
                      <span className="text-sm font-semibold text-foreground">@{u.username}</span>
                    ) : (
                      <a
                        href={`/profile/${u.username}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold text-foreground hover:text-brand"
                        onClick={(e) => e.stopPropagation()}
                        title="Profil in neuem Tab öffnen"
                      >
                        @{u.username}
                      </a>
                    )}
                    {u.pendingProfile && (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">
                        NOCH KEIN LOGIN
                      </span>
                    )}
                    {u.isAdmin && (
                      <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold text-brand">
                        ADMIN
                      </span>
                    )}
                    {u.isCreator && (
                      <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold text-brand">
                        CREATOR
                      </span>
                    )}
                    {u.isBusiness && (
                      <span className="rounded-full bg-brand-cyan/15 px-2 py-0.5 text-[10px] font-bold text-brand-cyan">
                        UNTERNEHMER
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
                  {(() => {
                    const ls = describeLastSeen(u.lastSeenAt, nowTs);
                    return (
                      <p
                        className={`mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[13px] font-semibold leading-tight sm:text-sm ${ls.toneClass}`}
                      >
                        <span aria-hidden>{ls.dot}</span>
                        <span>Zuletzt online: {ls.time}</span>
                        <span className="text-[10px] font-medium uppercase tracking-wide opacity-70">
                          {ls.status}
                        </span>
                      </p>
                    );
                  })()}
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Registriert {formatDateTime(u.createdAt)}
                    {u.banned && u.banReason ? ` · Grund: ${u.banReason}` : ""}
                  </p>
                </div>
                {u.id === selfId ? (
                  <span className="rounded-full bg-brand/15 px-2.5 py-1 text-[10px] font-bold text-brand">
                    MEIN ADMIN-KONTO — SELBSTVERWALTUNG GESPERRT
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    <AdminButton disabled={busy} onClick={() => setDetailUser(u)}>
                      <Eye className="h-3.5 w-3.5" /> Details
                    </AdminButton>
                    <AdminButton
                      disabled={busy}
                      onClick={() =>
                        setConfirmReq({
                          title: "Benutzer verwarnen?",
                          message: `Möchtest du @${u.username} wirklich verwarnen?`,
                          confirmLabel: "Verwarnen",
                          reason: { label: "Grund der Verwarnung", placeholder: "Grund…" },
                          onConfirm: ({ reason }) =>
                            void run(u.id, "warn", "Verwarnung gespeichert", { reason }),
                        })
                      }
                    >
                      <AlertTriangle className="h-3.5 w-3.5" /> Verwarnen
                    </AdminButton>
                    {u.banned ? (
                      <AdminButton
                        disabled={busy}
                        onClick={() => void run(u.id, "unban", "Nutzer entsperrt")}
                      >
                        <Unlock className="h-3.5 w-3.5" /> Entsperren
                      </AdminButton>
                    ) : (
                      <AdminButton
                        variant="danger"
                        disabled={busy}
                        onClick={() =>
                          setConfirmReq({
                            title: "Benutzer sperren?",
                            message: `Möchtest du @${u.username} wirklich sperren?`,
                            confirmLabel: "Sperren",
                            variant: "danger",
                            reason: { label: "Grund der Sperre", placeholder: "Grund…" },
                            days: { label: "Dauer in Tagen (0 = dauerhaft)", initial: "7" },
                            onConfirm: ({ reason, days }) =>
                              void run(u.id, "ban", "Nutzer gesperrt", { reason, days }),
                          })
                        }
                      >
                        <Ban className="h-3.5 w-3.5" /> Sperren
                      </AdminButton>
                    )}
                    <AdminButton
                      disabled={busy}
                      onClick={() => setRolesOpen((v) => (v === u.id ? null : u.id))}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" /> Admin
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${rolesOpen === u.id ? "rotate-180" : ""}`}
                      />
                    </AdminButton>
                    <AdminButton
                      disabled={busy}
                      onClick={() =>
                        setConfirmReq(
                          u.verified
                            ? {
                                title: "Verifizierung entfernen?",
                                message: `Möchtest du @${u.username} wirklich unverifizieren?`,
                                confirmLabel: "Unverifizieren",
                                onConfirm: () =>
                                  void run(u.id, "unverify", "Verifizierung entfernt"),
                              }
                            : {
                                title: "Benutzer verifizieren?",
                                message: `Möchtest du @${u.username} wirklich verifizieren?`,
                                confirmLabel: "Verifizieren",
                                onConfirm: () => void run(u.id, "verify", "Nutzer verifiziert"),
                              },
                        )
                      }
                    >
                      <BadgeCheck className="h-3.5 w-3.5" />{" "}
                      {u.verified ? "Unverifizieren" : "Verifizieren"}
                    </AdminButton>
                    <AdminButton
                      variant="danger"
                      disabled={busy}
                      onClick={() =>
                        setConfirmReq({
                          title: "Benutzer endgültig löschen?",
                          message: `Möchtest du @${u.username} wirklich löschen?`,
                          warning: "Diese Aktion kann nicht rückgängig gemacht werden.",
                          confirmLabel: "Endgültig löschen",
                          variant: "danger",
                          requireText: `@${u.username}`,
                          onConfirm: () => void run(u.id, "delete", "Nutzer gelöscht"),
                        })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Löschen
                    </AdminButton>
                  </div>
                )}
              </div>

              {rolesOpen === u.id && u.id !== selfId && (
                <div className="mt-3 rounded-xl border border-border bg-background p-3">
                  <p className="text-[10px] uppercase tracking-widest text-brand">
                    Berechtigungen verwalten
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Admin, Creator und Unternehmer sind unabhängig voneinander kombinierbar.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <AdminButton
                      disabled={busy}
                      onClick={() => runAdminRoleChange(u.id, !u.isAdmin)}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />{" "}
                      {u.isAdmin ? "Admin entfernen" : "Admin"}
                    </AdminButton>
                    <AdminButton
                      disabled={busy}
                      onClick={() => runSimpleRoleChange(u.id, "creator", !u.isCreator)}
                    >
                      <Sparkles className="h-3.5 w-3.5" />{" "}
                      {u.isCreator ? "Creator entfernen" : "Creator"}
                    </AdminButton>
                    <AdminButton
                      disabled={busy}
                      onClick={() => runSimpleRoleChange(u.id, "business", !u.isBusiness)}
                    >
                      <BriefcaseBusiness className="h-3.5 w-3.5" />{" "}
                      {u.isBusiness ? "Unternehmer entfernen" : "Unternehmer"}
                    </AdminButton>
                  </div>
                </div>
              )}
            </AdminPanel>
          ))}
        </div>
      )}
      <AdminConfirmDialog request={confirmReq} onClose={() => setConfirmReq(null)} />
      <AdminUserDetailDialog
        user={detailUser}
        onClose={() => setDetailUser(null)}
        labels={{
          title: t.userDetails,
          emailAddress: t.emailAddress,
          noEmail: t.noEmail,
          registered: t.registeredAt,
          lastSeen: t.lastSeen,
          locationLanguage: t.locationLanguage,
          roles: t.roles,
          roleAdmin: t.roleAdmin,
          roleCreator: t.roleCreator,
          roleBusiness: t.roleBusiness,
          statusVerified: t.statusVerified,
          statusBanned: t.statusBanned,
          warnings: t.warningCount_other,
          close: t.close,
        }}
      />
    </AdminSection>
  );
}
