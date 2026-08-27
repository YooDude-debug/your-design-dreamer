import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  AlertTriangle,
  BellRing,
  Check,
  RefreshCw,
  Stethoscope,
  ShieldCheck,
} from "lucide-react";
import {
  opsGetHealth,
  opsRunHealthChecks,
  opsSelfTest,
  opsTestAlertChannel,
  opsUpdateIncident,
} from "@/lib/ops.functions";
import type { OpsHealth, OpsSeverity } from "@/lib/ops-monitor.shared";
import {
  AdminButton,
  AdminEmpty,
  AdminLoading,
  AdminPanel,
  AdminSection,
} from "@/components/admin/AdminUI";
import { formatDateTime } from "@/lib/format-date";

export const Route = createFileRoute("/admin/health")({
  head: () => ({
    meta: [
      { title: "Systemzustand — Y-Dude Admin" },
      {
        name: "description",
        content:
          "Technische Übersicht: Fehlerquoten, Antwortzeiten, Zahlungen, Push, Anmeldung und offene Vorfälle.",
      },
      { property: "og:title", content: "Systemzustand — Y-Dude Admin" },
      {
        property: "og:description",
        content: "Zentrale Überwachung aller kritischen Y-Dude-Bereiche.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminHealth,
});

const SEVERITY_STYLE: Record<OpsSeverity, string> = {
  info: "border-border text-muted-foreground",
  warning: "border-amber-500/50 text-amber-400",
  critical: "border-red-500/50 text-red-400",
};

const STATUS_STYLE: Record<"ok" | "degraded" | "down", string> = {
  ok: "border-brand/50 bg-brand/10 text-brand",
  degraded: "border-amber-500/50 bg-amber-500/10 text-amber-400",
  down: "border-red-500/50 bg-red-500/10 text-red-400",
};

function AdminHealth() {
  const load = useServerFn(opsGetHealth);
  const updateIncident = useServerFn(opsUpdateIncident);
  const selfTest = useServerFn(opsSelfTest);
  const alertTest = useServerFn(opsTestAlertChannel);
  const runChecks = useServerFn(opsRunHealthChecks);
  const [health, setHealth] = useState<OpsHealth | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setHealth(await load({ data: {} }));
    } catch {
      setHealth(null);
    }
  }, [load]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(timer);
  }, [refresh]);

  const runSelfTest = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await selfTest({ data: { scenario: "api_error" } });
      setNotice(
        result.ok
          ? `Selbsttest ausgeführt: ${result.events} Testereignisse erzeugt.`
          : (result.blocked ?? "Selbsttest nicht möglich."),
      );
      await refresh();
    } catch {
      setNotice("Selbsttest fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const runProbes = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const r = await runChecks();
      setNotice(
        `Systemprüfung (${r.environment}): Datenbank ${r.dbLatencyMs ?? "—"} ms, RPC ${r.rpcLatencyMs ?? "—"} ms, Push-Fehler ${r.pushFailures}, Zahlungs-Fehler ${r.webhookFailures}, hängende Zahlungen ${r.stuckPayments}.`,
      );
      await refresh();
    } catch {
      setNotice("Systemprüfung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const runAlertTest = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await alertTest();
      setNotice(
        !result.configured
          ? "Kein Alarmkanal hinterlegt – Alarme erscheinen nur im Serverprotokoll."
          : result.delivered
            ? `Alarmtest zugestellt (${result.channels} Kanal/Kanäle).`
            : "Alarmtest konnte nicht zugestellt werden – Kanal prüfen.",
      );
    } catch {
      setNotice("Alarmtest fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (id: string, status: "acknowledged" | "resolved") => {
    setBusy(true);
    try {
      await updateIncident({ data: { id, status } });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminSection
      title="Systemzustand"
      description="Fehler, Antwortzeiten und offene Vorfälle je Bereich – getrennt nach Umgebung."
      actions={
        <>
          <AdminButton onClick={() => void runSelfTest()} disabled={busy}>
            <Stethoscope className="h-3.5 w-3.5" /> Selbsttest
          </AdminButton>
          <AdminButton onClick={() => void runProbes()} disabled={busy}>
            <ShieldCheck className="h-3.5 w-3.5" /> Systemprüfung
          </AdminButton>
          <AdminButton onClick={() => void runAlertTest()} disabled={busy}>
            <BellRing className="h-3.5 w-3.5" /> Alarmtest
          </AdminButton>
          <AdminButton onClick={() => void refresh()}>
            <RefreshCw className="h-3.5 w-3.5" /> Aktualisieren
          </AdminButton>
        </>
      }
    >
      {health === null ? (
        <AdminLoading />
      ) : (
        <div className="space-y-4">
          {notice && (
            <AdminPanel className="p-3 text-xs text-muted-foreground">{notice}</AdminPanel>
          )}

          {/* Kopfzeile: Gesamtzustand, Umgebung, Alarmweg */}
          <AdminPanel className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-widest ${STATUS_STYLE[health.status.level]}`}
              >
                <Activity className="h-3.5 w-3.5" /> {health.status.label}
              </span>
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Umgebung: {health.environment}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
              <span>Ereignisse (1 h): {health.totals.events1h}</span>
              <span>Fehler (1 h): {health.totals.errors1h}</span>
              <span>Kritisch (24 h): {health.totals.critical24h}</span>
              <span className="inline-flex items-center gap-1">
                <BellRing className="h-3.5 w-3.5" />
                Alarmweg: {health.alertChannel.configured ? "Webhook aktiv" : "nur Serverprotokoll"}
              </span>
              <span>Stand: {formatDateTime(health.generatedAt)}</span>
            </div>
          </AdminPanel>

          {/* Bereichskacheln */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {health.areas.map((area) => (
              <AdminPanel key={area.area} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {area.label}
                  </span>
                  {area.openIncidents > 0 ? (
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                  ) : (
                    <Check className="h-4 w-4 text-brand" />
                  )}
                </div>
                <div className="mt-2 flex items-end gap-3">
                  <span className="text-2xl font-bold leading-none text-foreground">
                    {area.errors1h}
                  </span>
                  <span className="text-[10px] text-muted-foreground">Fehler / Stunde</span>
                </div>
                <dl className="mt-2 space-y-0.5 text-[10px] text-muted-foreground">
                  <div>
                    24 h: {area.errors24h} Fehler, davon {area.critical24h} kritisch
                  </div>
                  <div>
                    Antwortzeit p95:{" "}
                    {area.p95DurationMs === null ? "—" : `${area.p95DurationMs} ms`}
                  </div>
                  <div>Offene Vorfälle: {area.openIncidents}</div>
                  <div>Alarmregel: {area.threshold}</div>
                </dl>
              </AdminPanel>
            ))}
          </div>

          {/* Vorfälle */}
          <AdminPanel className="p-4">
            <h2 className="text-sm font-bold text-foreground">Vorfälle</h2>
            {health.incidents.length === 0 ? (
              <AdminEmpty>Keine Vorfälle erfasst.</AdminEmpty>
            ) : (
              <ul className="mt-3 space-y-2">
                {health.incidents.map((incident) => (
                  <li
                    key={incident.id}
                    className={`rounded-xl border p-3 ${SEVERITY_STYLE[incident.severity]}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        {incident.isTest && (
                          <span className="rounded-full border border-border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                            Test
                          </span>
                        )}
                        {incident.title}
                      </span>
                      <span className="text-[10px] uppercase tracking-widest">
                        {incident.status} · {incident.eventCount}×
                      </span>
                    </div>
                    {incident.isTest && (
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Selbsttest – zählt nicht in Kennzahlen, Ampel oder Alarmierung.
                      </p>
                    )}

                    {incident.summary && (
                      <p className="mt-1 break-words text-[11px] text-muted-foreground">
                        {incident.summary}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      zuerst {formatDateTime(incident.firstSeenAt)} · zuletzt{" "}
                      {formatDateTime(incident.lastSeenAt)} ·{" "}
                      {incident.alertedAt ? `alarmiert ${incident.alertCount}×` : "noch kein Alarm"}
                    </p>
                    {incident.status !== "resolved" && (
                      <div className="mt-2 flex gap-2">
                        <AdminButton
                          onClick={() => void setStatus(incident.id, "acknowledged")}
                          disabled={busy}
                        >
                          Gesehen
                        </AdminButton>
                        <AdminButton
                          onClick={() => void setStatus(incident.id, "resolved")}
                          disabled={busy}
                        >
                          Erledigt
                        </AdminButton>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </AdminPanel>

          {/* Letzte Ereignisse */}
          <AdminPanel className="p-4">
            <h2 className="text-sm font-bold text-foreground">Letzte Ereignisse</h2>
            {health.recentEvents.length === 0 ? (
              <AdminEmpty>Keine Ereignisse in den letzten 24 Stunden.</AdminEmpty>
            ) : (
              <ul className="mt-3 divide-y divide-border text-[11px]">
                {health.recentEvents.map((event) => (
                  <li key={event.id} className="flex flex-wrap items-center gap-2 py-1.5">
                    <span className="w-32 shrink-0 text-muted-foreground">
                      {formatDateTime(event.createdAt)}
                    </span>
                    <span
                      className={`rounded border px-1.5 py-0.5 uppercase tracking-widest ${SEVERITY_STYLE[event.severity]}`}
                    >
                      {event.severity}
                    </span>
                    <span className="text-foreground">{event.event}</span>
                    {event.fn && <span className="text-muted-foreground">({event.fn})</span>}
                    {event.durationMs !== null && (
                      <span className="text-muted-foreground">{event.durationMs} ms</span>
                    )}
                    {event.message && (
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {event.message}
                      </span>
                    )}
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
