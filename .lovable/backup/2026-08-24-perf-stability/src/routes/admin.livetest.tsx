import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Activity, RefreshCw, Trash2 } from "lucide-react";
import {
  clearLiveTestEvents,
  getLiveTestMetrics,
  setLiveTestSettings,
} from "@/lib/live-test.functions";
import { LIVE_TEST_AD_FREQUENCIES, type LiveTestMetrics } from "@/lib/live-test.shared";
import {
  AdminButton,
  AdminEmpty,
  AdminLoading,
  AdminPanel,
  AdminSection,
} from "@/components/admin/AdminUI";

export const Route = createFileRoute("/admin/livetest")({
  head: () => ({
    meta: [
      { title: "Werbe-Testmodus — Y-Dude Admin" },
      {
        name: "description",
        content:
          "Testwerbung im Feed steuern: Werbefrequenz, Einblendungen, Klicks und Testmetriken des Werbekernels.",
      },
      { property: "og:title", content: "Werbe-Testmodus — Y-Dude Admin" },
      {
        property: "og:description",
        content: "Werbekernel und Feed-Algorithmus mit Testwerbung beobachten.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLiveTest,
});

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="control-panel rounded-xl px-3 py-2">
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
    <div className="control-track inline-flex items-center gap-1 rounded-full p-1">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          disabled={disabled}
          aria-pressed={value === opt}
          onClick={() => onSelect(opt)}
          className={`control-chip rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${
            value === opt ? "control-chip-active" : ""
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
      title="Werbe-Testmodus"
      description="Kontrollierter Test von Werbekernel und Feed-Algorithmus. Es wird ausschließlich Testwerbung eingeblendet; es entstehen keine echten Werbekosten und keine Kampagnendaten."
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
                  <Activity className="h-4 w-4 text-brand" /> Testwerbung im Feed
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {data.settings.liveTest
                    ? "EIN – Testwerbung erscheint im Feed und wird gemessen."
                    : "AUS – keine Testwerbung im Feed."}
                </p>
              </div>
              <AdminButton
                variant={data.settings.liveTest ? "danger" : "primary"}
                disabled={busy}
                onClick={() =>
                  void act(
                    () => save({ data: { liveTest: !data.settings.liveTest } }),
                    data.settings.liveTest ? "Testwerbung AUS" : "Testwerbung EIN",
                  )
                }
              >
                {data.settings.liveTest ? "AUS schalten" : "EIN schalten"}
              </AdminButton>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4">
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
                disabled={busy}
                onClick={() => {
                  if (!window.confirm("Alle Testmessungen löschen?")) return;
                  void act(() => clearEvents({}), "Testmessungen gelöscht");
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Messungen löschen
              </AdminButton>
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
              <Stat label="Mehrfach genutzte Tags" value={data.feed.repeatedTags} />
              <Stat label="Plays" value={data.slang.plays} />
              <Stat label="Uses" value={data.slang.uses} />
              <Stat label="Likes" value={data.slang.likes} />
              <Stat label="Neue Tags 24 h" value={data.slang.newTags24h} />
            </div>
          </AdminPanel>
        </div>
      )}
    </AdminSection>
  );
}
