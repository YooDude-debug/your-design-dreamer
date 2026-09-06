import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, UserPlus } from "lucide-react";
import { adminGetRegistrationMetrics } from "@/lib/admin.functions";
import {
  CAUSE_LABELS,
  RANGE_LABELS,
  REGISTRATION_CAUSES,
  REGISTRATION_EVENTS,
  REGISTRATION_RANGES,
  type RegistrationMetrics,
  type RegistrationRange,
} from "@/lib/registration-tracking.shared";
import {
  AdminLoading,
  AdminPanel,
  AdminSection,
  AdminTabs,
  AdminEmpty,
} from "@/components/admin/AdminUI";
import { formatDateTime } from "@/lib/format-date";

export const Route = createFileRoute("/admin/registration")({
  head: () => ({
    meta: [
      { title: "Registrierungen — Y-Dude Admin" },
      {
        name: "description",
        content:
          "Registrierungsversuche, erfolgreiche und fehlgeschlagene Registrierungen, Fehlerursachen und Conversion-Funnel.",
      },
      { property: "og:title", content: "Registrierungen — Y-Dude Admin" },
      {
        property: "og:description",
        content: "Technische Auswertung des Registrierungsvorgangs.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminRegistrationPage,
});

const EVENT_LABELS: Record<string, string> = {
  registration_started: "Registrierung geöffnet",
  registration_submitted: "Registrierung abgesendet",
  turnstile_loaded: "Turnstile geladen",
  turnstile_completed: "Turnstile bestanden",
  turnstile_failed: "Turnstile fehlgeschlagen",
  validation_failed: "Validierung fehlgeschlagen",
  auth_failed: "Auth fehlgeschlagen",
  profile_creation_failed: "Profil-Erstellung fehlgeschlagen",
  email_confirmation_pending: "E-Mail-Bestätigung offen",
  registration_completed: "Registrierung abgeschlossen",
};

function pctText(value: number | null): string {
  return value === null ? "—" : `${value.toString().replace(".", ",")} %`;
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-black text-foreground">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function AdminRegistrationPage() {
  const load = useServerFn(adminGetRegistrationMetrics);
  const [range, setRange] = useState<RegistrationRange>("7d");
  const [data, setData] = useState<RegistrationMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void load({ data: { range } })
      .then((res) => {
        if (active) setData(res as RegistrationMetrics);
      })
      .catch(() => {
        if (active) setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const base = data?.funnel[0]?.count ?? 0;

  return (
    <AdminSection
      title="Registrierungen"
      description="Technische Erfassung der Registrierungsversuche. Es werden keine Passwörter, Tokens oder personenbezogenen Inhalte gespeichert."
    >
      <AdminTabs
        value={range}
        onChange={setRange}
        tabs={REGISTRATION_RANGES.map((r) => ({ value: r, label: RANGE_LABELS[r] }))}
      />

      {loading && <AdminLoading />}
      {!loading && !data && <AdminEmpty>Auswertung konnte nicht geladen werden.</AdminEmpty>}

      {!loading && data && (
        <>
          {data.historyIncomplete && (
            <AdminPanel>
              <p className="flex items-start gap-2 text-xs font-semibold text-amber-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Historische Daten nicht vollständig verfügbar
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Die Messung begann am{" "}
                {data.measurementStart ? formatDateTime(data.measurementStart) : "—"}. Zeiträume
                davor enthalten keine Ereignisdaten; fehlende Werte werden nicht geschätzt.
              </p>
            </AdminPanel>
          )}
          {!data.measurementStart && (
            <AdminPanel>
              <p className="text-xs text-muted-foreground">
                Bisher wurden keine Registrierungsereignisse erfasst.
              </p>
            </AdminPanel>
          )}

          <AdminPanel>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Metric label="Registrierungsversuche" value={String(data.attempts)} />
              <Metric
                label="Erfolgreich"
                value={String(data.completed)}
                hint="Account tatsächlich erstellt"
              />
              <Metric label="Fehlgeschlagen" value={String(data.failed)} />
              <Metric label="Fehlerrate" value={pctText(data.failureRate)} />
              <Metric
                label="Abbruchrate"
                value={pctText(data.abandonRate)}
                hint={`${data.abandoned} ohne Ergebnis`}
              />
              <Metric label="Conversion" value={pctText(data.conversionRate)} />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Erfolgreich bedeutet: der Account wurde angelegt (Session aktiv oder
              E-Mail-Bestätigung ausstehend). Klicks ohne entstandenen Account zählen als
              fehlgeschlagen bzw. abgebrochen.
            </p>
          </AdminPanel>

          <AdminPanel>
            <p className="text-xs font-bold text-foreground">Fehler nach Ursache</p>
            <div className="mt-2 space-y-1.5">
              {REGISTRATION_CAUSES.map((c) => (
                <div key={c} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{CAUSE_LABELS[c]}</span>
                  <span className="font-bold text-foreground">{data.causeCounts[c]}</span>
                </div>
              ))}
            </div>
          </AdminPanel>

          <AdminPanel>
            <p className="text-xs font-bold text-foreground">Conversion Funnel</p>
            <div className="mt-2 space-y-1.5">
              {data.funnel.map((stage, i) => {
                const prev = data.funnel[i - 1]?.count ?? null;
                const share =
                  stage.count !== null && base > 0
                    ? Math.round((stage.count / base) * 1000) / 10
                    : null;
                const step =
                  stage.count !== null && prev !== null && prev > 0
                    ? Math.round((stage.count / prev) * 1000) / 10
                    : null;
                return (
                  <div key={stage.key} className="rounded-lg border border-border px-3 py-2">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate text-foreground">{stage.label}</span>
                      <span className="font-bold text-foreground">
                        {stage.count === null ? "nicht messbar" : stage.count}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {stage.count === null
                        ? "Datenbestand zu groß für vollständige Auszählung"
                        : `Gesamt ${pctText(share)} · Schritt ${pctText(step)}`}
                      {" · "}
                      {stage.source === "events" ? "Ereignisdaten" : "Kontodaten"}
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 flex items-start gap-2 text-[11px] text-muted-foreground">
              <UserPlus className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Stufen aus Kontodaten (Account, E-Mail, Profil, erste Anmeldung) sind nicht einzelnen
              Versuchen zugeordnet, sondern gezählte Konten im Zeitraum.
            </p>
          </AdminPanel>

          <AdminPanel>
            <p className="text-xs font-bold text-foreground">Ereignisse im Zeitraum</p>
            <div className="mt-2 space-y-1.5">
              {REGISTRATION_EVENTS.map((e) => (
                <div key={e} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{EVENT_LABELS[e] ?? e}</span>
                  <span className="font-bold text-foreground">{data.eventCounts[e]}</span>
                </div>
              ))}
            </div>
          </AdminPanel>
        </>
      )}
    </AdminSection>
  );
}
