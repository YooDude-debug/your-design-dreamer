import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bot, Play, Plus, RefreshCw, Save, Sparkles, Trash2, X } from "lucide-react";
import {
  adminCreateTestAccount,
  adminDeleteTestAccount,
  adminGetTestAccounts,
  adminRunTestAction,
  adminSeedTestAccounts,
  adminUpdateTestAccount,
} from "@/lib/admin.functions";
import { BOT_ACTIONS, type AdminTestAccount, type BotConfig } from "@/lib/admin.shared";
import {
  AdminButton,
  AdminEmpty,
  AdminInput,
  AdminLoading,
  AdminPanel,
  AdminSection,
  formatDateTime,
} from "@/components/admin/AdminUI";

export const Route = createFileRoute("/admin/testusers")({
  head: () => ({
    meta: [
      { title: "Testuser-Verwaltung — Y-Dude Admin" },
      {
        name: "description",
        content:
          "Testkonten anlegen, bearbeiten, aktivieren, löschen sowie Bot-Verhalten und Testaktionen steuern.",
      },
      { property: "og:title", content: "Testuser-Verwaltung — Y-Dude Admin" },
      { property: "og:description", content: "Testkonten und Bot-Verhalten steuern." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminTestUsers,
});

function AdminTestUsers() {
  const load = useServerFn(adminGetTestAccounts);
  const create = useServerFn(adminCreateTestAccount);
  const seed = useServerFn(adminSeedTestAccounts);
  const update = useServerFn(adminUpdateTestAccount);
  const remove = useServerFn(adminDeleteTestAccount);
  const runAction = useServerFn(adminRunTestAction);

  const [rows, setRows] = useState<AdminTestAccount[] | null>(null);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ username: "", region: "", language: "" });
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setRows(null);
    try {
      setRows(await load({}));
    } catch {
      setRows([]);
    }
  }, [load]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const patchBot = async (acc: AdminTestAccount, patch: Partial<BotConfig>) => {
    setBusy(true);
    try {
      await update({ data: { id: acc.id, botConfig: { ...acc.botConfig, ...patch } } });
      await refresh();
    } catch {
      toast.error("Bot-Konfiguration fehlgeschlagen");
    }
    setBusy(false);
  };

  return (
    <AdminSection
      title="Testuser-Verwaltung"
      description="Testkonten anlegen, bearbeiten, aktivieren/deaktivieren, löschen, Testaktionen ausführen und Bot-Verhalten steuern."
      actions={
        <>
          <AdminInput
            value={newName}
            onChange={setNewName}
            placeholder="Neuer Testuser"
            className="w-36"
          />
          <AdminButton
            variant="primary"
            disabled={busy || !newName.trim()}
            onClick={() => {
              setBusy(true);
              void create({ data: { username: newName.trim() } })
                .then(() => {
                  toast.success("Testuser erstellt");
                  setNewName("");
                  return refresh();
                })
                .catch((e) =>
                  toast.error(e instanceof Error ? e.message : "Erstellen fehlgeschlagen"),
                )
                .finally(() => setBusy(false));
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Erstellen
          </AdminButton>
          <AdminButton
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void seed({})
                .then(() => {
                  toast.success("Testuser-Set angelegt");
                  return refresh();
                })
                .catch(() => toast.error("Generieren fehlgeschlagen"))
                .finally(() => setBusy(false));
            }}
          >
            <Sparkles className="h-3.5 w-3.5" /> Standard-Set anlegen
          </AdminButton>
          <AdminButton onClick={() => void refresh()}>
            <RefreshCw className="h-3.5 w-3.5" /> Aktualisieren
          </AdminButton>
        </>
      }
    >
      {rows === null ? (
        <AdminLoading />
      ) : rows.length === 0 ? (
        <AdminEmpty>Noch keine Testkonten vorhanden.</AdminEmpty>
      ) : (
        <div className="space-y-2">
          {rows.map((a) => (
            <AdminPanel key={a.id} className={a.active ? "" : "opacity-60"}>
              {editing === a.id ? (
                <div className="grid gap-2 sm:grid-cols-4">
                  <AdminInput
                    value={draft.username}
                    onChange={(v) => setDraft({ ...draft, username: v })}
                    placeholder="Username"
                  />
                  <AdminInput
                    value={draft.region}
                    onChange={(v) => setDraft({ ...draft, region: v })}
                    placeholder="Region"
                  />
                  <AdminInput
                    value={draft.language}
                    onChange={(v) => setDraft({ ...draft, language: v })}
                    placeholder="Sprache"
                  />
                  <div className="flex gap-1.5">
                    <AdminButton
                      variant="primary"
                      disabled={busy}
                      onClick={() => {
                        setBusy(true);
                        void update({ data: { id: a.id, ...draft } })
                          .then(() => {
                            toast.success("Testuser gespeichert");
                            setEditing(null);
                            return refresh();
                          })
                          .catch(() => toast.error("Speichern fehlgeschlagen"))
                          .finally(() => setBusy(false));
                      }}
                    >
                      <Save className="h-3.5 w-3.5" /> Speichern
                    </AdminButton>
                    <AdminButton onClick={() => setEditing(null)}>
                      <X className="h-3.5 w-3.5" />
                    </AdminButton>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        @{a.username}
                        <span
                          className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            a.active ? "bg-brand/15 text-brand" : "bg-accent text-accent-foreground"
                          }`}
                        >
                          {a.active ? "AKTIV" : "INAKTIV"}
                        </span>
                        {a.botConfig.enabled && (
                          <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-brand-cyan/15 px-2 py-0.5 text-[10px] font-bold text-brand-cyan">
                            <Bot className="h-3 w-3" /> BOT
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {a.email} · Passwort {a.initialPassword} · {a.region || "—"} · {a.language}{" "}
                        · {formatDateTime(a.registeredAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <AdminButton
                        onClick={() => {
                          setEditing(a.id);
                          setDraft({
                            username: a.username,
                            region: a.region,
                            language: a.language,
                          });
                        }}
                      >
                        Bearbeiten
                      </AdminButton>
                      <AdminButton
                        disabled={busy}
                        onClick={() => {
                          setBusy(true);
                          void update({ data: { id: a.id, active: !a.active } })
                            .then(() => refresh())
                            .catch(() => toast.error("Aktion fehlgeschlagen"))
                            .finally(() => setBusy(false));
                        }}
                      >
                        {a.active ? "Deaktivieren" : "Aktivieren"}
                      </AdminButton>
                      <AdminButton
                        variant="danger"
                        disabled={busy}
                        onClick={() => {
                          if (!window.confirm(`Testuser @${a.username} löschen?`)) return;
                          setBusy(true);
                          void remove({ data: { id: a.id } })
                            .then(() => {
                              toast.success("Testuser gelöscht");
                              return refresh();
                            })
                            .catch(() => toast.error("Löschen fehlgeschlagen"))
                            .finally(() => setBusy(false));
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </AdminButton>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-2">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Bot-Verhalten
                    </span>
                    <AdminButton
                      disabled={busy}
                      onClick={() => void patchBot(a, { enabled: !a.botConfig.enabled })}
                    >
                      <Bot className="h-3.5 w-3.5" /> {a.botConfig.enabled ? "Bot aus" : "Bot ein"}
                    </AdminButton>
                    <label className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      Intervall
                      <AdminInput
                        value={String(a.botConfig.intervalMinutes)}
                        onChange={(v) => void patchBot(a, { intervalMinutes: Number(v || "60") })}
                        className="w-16"
                      />
                      Min.
                    </label>
                    {BOT_ACTIONS.map((action) => {
                      const on = a.botConfig.actions.includes(action);
                      return (
                        <button
                          key={action}
                          disabled={busy}
                          onClick={() =>
                            void patchBot(a, {
                              actions: on
                                ? a.botConfig.actions.filter((x) => x !== action)
                                : [...a.botConfig.actions, action],
                            })
                          }
                          className={`rounded-full border px-2.5 py-1 text-[10px] transition-colors ${
                            on
                              ? "border-brand/50 bg-brand/15 text-brand"
                              : "border-border text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {action}
                        </button>
                      );
                    })}
                    <AdminButton
                      disabled={busy}
                      onClick={() => {
                        setBusy(true);
                        void runAction({ data: { id: a.id, action: "simulate" } })
                          .then((r) => toast.success(String(r?.result ?? "Testaktion ausgeführt")))
                          .catch(() => toast.error("Testaktion fehlgeschlagen"))
                          .finally(() => setBusy(false));
                      }}
                    >
                      <Play className="h-3.5 w-3.5" /> Testaktion
                    </AdminButton>
                  </div>
                </>
              )}
            </AdminPanel>
          ))}
        </div>
      )}
    </AdminSection>
  );
}
