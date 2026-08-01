import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Bot,
  Pause,
  Play,
  Power,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  getTestBotState,
  purgeTestBots,
  resetTestBotActivity,
  runTestBotActivity,
  seedTestBots,
  setTestBotSettings,
  updateTestBot,
} from "@/lib/testbots.functions";
import {
  TEST_BOT_ACTIONS,
  TEST_BOT_ACTION_LABELS,
  TEST_BOT_POOL,
  type TestBotAction,
  type TestBotRow,
  type TestBotSettings,
} from "@/lib/testbots.shared";
import {
  AdminButton,
  AdminEmpty,
  AdminInput,
  AdminLoading,
  AdminPanel,
  AdminSection,
  formatDateTime,
} from "@/components/admin/AdminUI";

export const Route = createFileRoute("/admin/testbots")({
  head: () => ({
    meta: [
      { title: "Testbots — Y-Dude Admin" },
      {
        name: "description",
        content:
          "Testbots für den Entwicklungsmodus verwalten: aktivieren, Anzahl festlegen, Aktivität starten, zurücksetzen und alle Testdaten löschen.",
      },
      { property: "og:title", content: "Testbots — Y-Dude Admin" },
      { property: "og:description", content: "Testbots und Testdaten im Entwicklungsmodus steuern." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminTestBots,
});

function AdminTestBots() {
  const load = useServerFn(getTestBotState);
  const saveSettings = useServerFn(setTestBotSettings);
  const seed = useServerFn(seedTestBots);
  const runActivity = useServerFn(runTestBotActivity);
  const resetActivity = useServerFn(resetTestBotActivity);
  const patchBot = useServerFn(updateTestBot);
  const purge = useServerFn(purgeTestBots);

  const [settings, setSettings] = useState<TestBotSettings | null>(null);
  const [bots, setBots] = useState<TestBotRow[] | null>(null);
  const [countDraft, setCountDraft] = useState("20");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await load({});
      setSettings(res.settings);
      setBots(res.bots);
      setCountDraft(String(res.settings.botCount));
    } catch {
      setBots([]);
    }
  }, [load]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
      toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Aktion fehlgeschlagen");
    }
    setBusy(false);
  };

  const enabled = settings?.enabled ?? false;

  return (
    <AdminSection
      title="Testbots"
      description="Klar gekennzeichnete Testbots ausschließlich für den Entwicklungsmodus. Bot-Inhalte sind nur sichtbar, solange der Hauptschalter aktiv ist."
      actions={
        <AdminButton onClick={() => void refresh()}>
          <RefreshCw className="h-3.5 w-3.5" /> Aktualisieren
        </AdminButton>
      }
    >
      {settings === null || bots === null ? (
        <AdminLoading />
      ) : (
        <div className="space-y-3">
          <AdminPanel className={enabled ? "border-brand/40" : ""}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Bot className="h-4 w-4 text-brand" /> Hauptschalter Testbot-System
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {enabled
                    ? "Aktiv – Testbots und ihre Inhalte sind im Entwicklungsmodus sichtbar."
                    : "Deaktiviert – keine Bot-Aktivität, Bot-Inhalte werden überall ausgeblendet."}
                  {" · "}Zuletzt geändert: {formatDateTime(settings.updatedAt)}
                </p>
              </div>
              <AdminButton
                variant={enabled ? "danger" : "primary"}
                disabled={busy}
                onClick={() =>
                  void act(
                    () => saveSettings({ data: { enabled: !enabled } }),
                    enabled ? "Testbot-System deaktiviert" : "Testbot-System aktiviert",
                  )
                }
              >
                <Power className="h-3.5 w-3.5" /> {enabled ? "Deaktivieren" : "Aktivieren"}
              </AdminButton>
            </div>
          </AdminPanel>

          <AdminPanel>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Verwaltung
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                Anzahl Bots
                <AdminInput value={countDraft} onChange={setCountDraft} className="w-16" />
                <span>/ {TEST_BOT_POOL.length}</span>
              </label>
              <AdminButton
                variant="primary"
                disabled={busy || !enabled}
                onClick={() =>
                  void act(async () => {
                    const count = Number(countDraft || "0");
                    await saveSettings({ data: { botCount: count } });
                    await seed({ data: { count } });
                  }, "Testbots erzeugt")
                }
              >
                <Sparkles className="h-3.5 w-3.5" /> Neue Testdaten generieren
              </AdminButton>
              <AdminButton
                disabled={busy || !enabled}
                onClick={() =>
                  void act(async () => {
                    await saveSettings({ data: { running: !settings.running } });
                    if (!settings.running) await runActivity({ data: { rounds: 2 } });
                  }, settings.running ? "Aktivität gestoppt" : "Aktivität gestartet")
                }
              >
                {settings.running ? (
                  <>
                    <Pause className="h-3.5 w-3.5" /> Aktivität stoppen
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" /> Aktivität starten
                  </>
                )}
              </AdminButton>
              <AdminButton
                disabled={busy || !enabled}
                onClick={() =>
                  void act(
                    async () => {
                      const s = await runActivity({ data: { rounds: 1 } });
                      toast.message(
                        `Beiträge ${s.posts} · Kommentare ${s.comments} · Likes ${s.likes} · Shares ${s.shares} · SlangTags ${s.slangTags} · Besuche ${s.visits}`,
                      );
                    },
                    "Aktivitätsrunde ausgeführt",
                  )
                }
              >
                <Play className="h-3.5 w-3.5" /> Eine Runde simulieren
              </AdminButton>
              <AdminButton
                disabled={busy}
                onClick={() => {
                  if (!window.confirm("Alle Bot-Aktivitäten (Beiträge, Likes, Kommentare) zurücksetzen?"))
                    return;
                  void act(() => resetActivity({}), "Aktivität zurückgesetzt");
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" /> Aktivität zurücksetzen
              </AdminButton>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Status: {settings.running ? "Aktivität läuft" : "Aktivität gestoppt"} ·{" "}
              {bots.filter((b) => b.active).length} von {bots.length} Bots aktiv
            </p>
          </AdminPanel>

          <AdminPanel className="border-destructive/50 bg-destructive/5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-destructive">
                  🗑️ Alle Testbots und Testdaten löschen
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Entfernt endgültig alle Bot-Konten, Testbeiträge, Testkommentare, Testlikes,
                  Test-SlangTags und Testbenachrichtigungen. Daten echter Nutzer bleiben unberührt.
                </p>
              </div>
              <AdminButton
                variant="danger"
                disabled={busy}
                onClick={() => {
                  if (
                    !window.confirm(
                      "Endgültig alle Testbots und sämtliche Testdaten löschen? Dies kann nicht rückgängig gemacht werden.",
                    )
                  )
                    return;
                  void act(async () => {
                    const r = await purge({});
                    toast.message(`${r.accounts} Konten und ${r.content} Datensätze entfernt`);
                  }, "Testbots und Testdaten gelöscht");
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Endgültig löschen
              </AdminButton>
            </div>
          </AdminPanel>

          {bots.length === 0 ? (
            <AdminEmpty>
              Noch keine Testbots vorhanden. Hauptschalter aktivieren und Testdaten generieren.
            </AdminEmpty>
          ) : (
            <div className="space-y-2">
              {bots.map((b) => (
                <AdminPanel key={b.id} className={b.active ? "" : "opacity-60"}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                        @{b.username}
                        <span className="inline-flex items-center gap-1 rounded-full border border-destructive/50 bg-destructive/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-destructive">
                          <Bot className="h-3 w-3" /> Testbot
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            b.active ? "bg-brand/15 text-brand" : "bg-accent text-accent-foreground"
                          }`}
                        >
                          {b.active ? "AKTIV" : "INAKTIV"}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {b.country} · {b.region} · {b.language} · Interessen:{" "}
                        {b.interests.join(", ") || "—"}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        Beiträge {b.posts} · Kommentare {b.comments} · Likes {b.likes} · SlangTags{" "}
                        {b.slangTags} · Letzte Aktivität{" "}
                        {b.lastActivityAt ? formatDateTime(b.lastActivityAt) : "—"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <label className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        Intervall
                        <AdminInput
                          value={String(b.intervalMinutes)}
                          onChange={(v) =>
                            void act(
                              () =>
                                patchBot({
                                  data: { id: b.id, intervalMinutes: Number(v || "60") },
                                }),
                              "Intervall gespeichert",
                            )
                          }
                          className="w-14"
                        />
                        Min.
                      </label>
                      <AdminButton
                        disabled={busy}
                        onClick={() =>
                          void act(
                            () => patchBot({ data: { id: b.id, active: !b.active } }),
                            b.active ? "Bot deaktiviert" : "Bot aktiviert",
                          )
                        }
                      >
                        {b.active ? "Deaktivieren" : "Aktivieren"}
                      </AdminButton>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Verhalten
                    </span>
                    {TEST_BOT_ACTIONS.map((action: TestBotAction) => {
                      const on = b.actions.includes(action);
                      return (
                        <button
                          key={action}
                          disabled={busy}
                          onClick={() =>
                            void act(
                              () =>
                                patchBot({
                                  data: {
                                    id: b.id,
                                    actions: on
                                      ? b.actions.filter((a) => a !== action)
                                      : [...b.actions, action],
                                  },
                                }),
                              "Verhalten gespeichert",
                            )
                          }
                          className={`rounded-full border px-2.5 py-1 text-[10px] transition-colors ${
                            on
                              ? "border-brand/50 bg-brand/15 text-brand"
                              : "border-border text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {TEST_BOT_ACTION_LABELS[action]}
                        </button>
                      );
                    })}
                  </div>
                </AdminPanel>
              ))}
            </div>
          )}
        </div>
      )}
    </AdminSection>
  );
}
