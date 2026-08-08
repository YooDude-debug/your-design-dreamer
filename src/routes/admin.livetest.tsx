import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Activity, Megaphone, Play, RefreshCw, Trash2 } from "lucide-react";
import {
  clearLiveTestEvents,
  getLiveTestMetrics,
  runLiveTestRound,
  setLiveTestSettings,
} from "@/lib/live-test.functions";
import {
  LIVE_TEST_AD_FREQUENCIES,
  LIVE_TEST_INTERVALS,
  type LiveTestMetrics,
} from "@/lib/live-test.shared";
import {
  AdminButton,
  AdminEmpty,
  AdminLoading,
  AdminPanel,
  AdminSection,
} from "@/components/admin/AdminUI";
import { formatDateTime } from "@/lib/format-date";

export const Route = createFileRoute("/admin/livetest")({
  head: () => ({
    meta: [
      { title: "Live-Testmodus — Y-Dude Admin" },
      {
        name: "description",
        content:
          "Live-Test von Werbekernel und Feed-Algorithmus steuern: Bot-Posting-Intervall, Werbefrequenz im Feed und Testmetriken.",
      },
      { property: "og:title", content: "Live-Testmodus — Y-Dude Admin" },
      {
        property: "og:description",
        content: "Werbekernel und Feed-Algorithmus unter realistischer Bot-Aktivität beobachten.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLiveTest,
});

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}

function Segmented<T extends number>({
  options,
  value,
  unit,
  disabled,
  onSelect,
}: {
  options: readonly T[];
  value: number;
  unit: string;
  disabled?: boolean;
  onSelect: (value: T) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-background p-1">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          disabled={disabled}
          aria-pressed={value === opt}
          onClick={() => onSelect(opt)}
          className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors ${
            value === opt
              ? "bg-gradient-brand text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {opt} {unit}
        </button>
      ))}
    </div>
  );
}

function AdminLiveTest() {
  const load = useServerFn(getLiveTestMetrics);
  const save = useServerFn(setLiveTestSettings);
  const runRound = useServerFn(runLiveTestRound);
  const clearEvents = useServerFn(clearLiveTestEvents);

  const [data, setData] = useState<LiveTestMetrics | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setData(await load({}));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [load]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Während der Test läuft, Metriken automatisch nachladen.
  useEffect(() => {
    if (!data?.settings.liveTest) return;
    const id = window.setInterval(() => void refresh(), 20_000);
    return () => window.clearInterval(id);
  }, [data?.settings.liveTest, refresh]);

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

  return (
    <AdminSection
      title="Live-Testmodus"
      description="Kontrollierter Test von Werbekernel und Feed-Algorithmus. Es werden ausschließlich Bot-Konten bespielt; es entstehen keine echten Werbekosten und keine Kampagnendaten."
      actions={
        <AdminButton onClick={() => void refresh()}>
          <RefreshCw className="h-3.5 w-3.5" /> Aktualisieren
        </AdminButton>
      }
    >
      {failed ? (
        <AdminEmpty>Testdaten konnten nicht geladen werden.</AdminEmpty>
      ) : data === null ? (
        <AdminLoading />
      ) : (
        <div className="space-y-3">
          <AdminPanel className={data.settings.liveTest ? "border-brand/40" : ""}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Activity className="h-4 w-4 text-brand" /> Bot Live Test
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {data.settings.liveTest
                    ? "EIN – Bots posten im gewählten Intervall, Werbekarte erscheint im Feed."
                    : "AUS – keine automatischen Bot-Posts, keine Werbekarte im Feed."}
                  {!data.settings.botsEnabled && " · Hauptschalter Testbot-System ist aus."}
                </p>
              </div>
              <AdminButton
                variant={data.settings.liveTest ? "danger" : "primary"}
                disabled={busy}
                onClick={() =>
                  void act(
                    () => save({ data: { liveTest: !data.settings.liveTest } }),
                    data.settings.liveTest ? "Live-Test AUS" : "Live-Test EIN",
                  )
                }
              >
                {data.settings.liveTest ? "AUS schalten" : "EIN schalten"}
              </AdminButton>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <label className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                Posting Interval
                <Segmented
                  options={LIVE_TEST_INTERVALS}
                  value={data.settings.postIntervalMinutes}
                  unit="min"
                  disabled={busy}
                  onSelect={(v) =>
                    void act(
                      () => save({ data: { postIntervalMinutes: v } }),
                      `Posting-Intervall: ${v} min`,
                    )
                  }
                />
              </label>
              <label className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                Ad Frequency
                <Segmented
                  options={LIVE_TEST_AD_FREQUENCIES}
                  value={data.settings.adFrequency}
                  unit="Int."
                  disabled={busy}
                  onSelect={(v) =>
                    void act(() => save({ data: { adFrequency: v } }), `Werbefrequenz: ${v}`)
                  }
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <AdminButton
                disabled={busy || !data.settings.liveTest}
                onClick={() =>
                  void act(async () => {
                    const res = await runRound({});
                    toast.message(
                      res.ran
                        ? `Beiträge ${res.posts} · Likes ${res.likes} · Bots ${res.bots.length}`
                        : `Lauf übersprungen (${res.reason ?? "-"})`,
                    );
                  }, "Testlauf ausgeführt")
                }
              >
                <Play className="h-3.5 w-3.5" /> Lauf jetzt starten
              </AdminButton>
              <AdminButton
                disabled={busy}
                onClick={() => {
                  if (!window.confirm("Alle Testmessungen löschen?")) return;
                  void act(() => clearEvents({}), "Testmessungen gelöscht");
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Messungen löschen
              </AdminButton>
              <span className="text-[10px] text-muted-foreground">
                Letzter Lauf:{" "}
                {data.settings.lastRunAt ? formatDateTime(data.settings.lastRunAt) : "—"} · Nächster:{" "}
                {data.bots.nextRunAt ? formatDateTime(data.bots.nextRunAt) : "—"}
              </span>
            </div>
          </AdminPanel>

          <AdminPanel>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Werbung (Testmessung, letzte 24 h)
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Eingeplant" value={data.ads.scheduled} />
              <Stat label="Impressionen" value={data.ads.impressions} />
              <Stat label="Klicks" value={data.ads.clicks} />
              <Stat label="SlangTag-Plays" value={data.ads.slangPlays} />
              <Stat label="Übersprungen" value={data.ads.skips} />
              <Stat label="Ø Interaktionen" value={data.ads.avgInteractions} />
              <Stat label="Ø Feed-Position" value={data.ads.avgPosition} />
              <Stat
                label="Skip-Rate"
                value={
                  data.ads.impressions
                    ? `${Math.round((data.ads.skips / data.ads.impressions) * 100)} %`
                    : "—"
                }
              />
            </div>
          </AdminPanel>

          <AdminPanel>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Feed &amp; SlangTags
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Feed-Impressionen" value={data.feed.impressions} />
              <Stat label="Post-Wechsel" value={data.feed.steps} />
              <Stat label="Neue Beiträge 24 h" value={data.feed.newPosts24h} />
              <Stat label="davon Bots" value={data.feed.botPosts} />
              <Stat label="Mehrfach genutzte Tags" value={data.feed.repeatedTags} />
              <Stat label="Plays" value={data.slang.plays} />
              <Stat label="Uses" value={data.slang.uses} />
              <Stat label="Neue Tags 24 h" value={data.slang.newTags24h} />
            </div>
          </AdminPanel>

          <AdminPanel>
            <p className="inline-flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              <Megaphone className="h-3.5 w-3.5" /> Bots ({data.bots.active} von {data.bots.total}{" "}
              aktiv)
            </p>
            {data.bots.posts.length === 0 ? (
              <AdminEmpty>Keine Testbots vorhanden.</AdminEmpty>
            ) : (
              <ul className="mt-2 divide-y divide-border text-[12px]">
                {data.bots.posts.map((b) => (
                  <li key={b.username} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="truncate font-medium text-foreground">@{b.username}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {b.posts} Beiträge (24 h) ·{" "}
                      {b.lastActivityAt ? formatDateTime(b.lastActivityAt) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </AdminPanel>
        </div>
      )}
    </AdminSection>
  );
}
