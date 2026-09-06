import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Hand,
  Info,
  RefreshCw,
  UserPlus,
} from "lucide-react";
import {
  getRegistrationCheckHistory,
  runRegistrationCheck,
  saveManualRegistrationTest,
} from "@/lib/registration-health.functions";
import {
  MANUAL_STEPS,
  type CheckGroup,
  type CheckStatus,
  type RegistrationHealthHistory,
  type RegistrationHealthReport,
} from "@/lib/registration-health.shared";
import { AdminButton, AdminLoading, AdminPanel, AdminSection } from "@/components/admin/AdminUI";
import { formatDateTime } from "@/lib/format-date";

export const Route = createFileRoute("/admin/registration-check")({
  head: () => ({
    meta: [
      { title: "Registrierungs-Check — Y-Dude Admin" },
      {
        name: "description",
        content:
          "Prüft automatisch, ob sich neue Nutzer bei Y-Dude registrieren können: Formular, Benutzername, E-Mail, Passwort, Bot-Schutz, Anmeldung und Profilanlage.",
      },
      { property: "og:title", content: "Registrierungs-Check — Y-Dude Admin" },
      {
        property: "og:description",
        content: "Sofort erkennen, ob die Registrierung technisch funktioniert.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: RegistrationCheckPage,
});

const STATUS_STYLE: Record<CheckStatus, { dot: string; text: string; label: string }> = {
  ok: { dot: "bg-emerald-500", text: "text-emerald-600", label: "OK" },
  failed: { dot: "bg-red-500", text: "text-red-600", label: "FEHLER" },
  manual: { dot: "bg-amber-500", text: "text-amber-600", label: "MANUELLER TEST ERFORDERLICH" },
  info: { dot: "bg-muted-foreground/50", text: "text-muted-foreground", label: "HINWEIS" },
};

function StatusPill({ status }: { status: CheckStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${s.text}`}>
      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function OverallBanner({ report }: { report: RegistrationHealthReport | null }) {
  if (!report) {
    return (
      <AdminPanel>
        <p className="text-sm text-muted-foreground">
          Noch kein Check ausgeführt. Starte den automatischen Check, um zu sehen, ob sich neue
          Nutzer registrieren können.
        </p>
      </AdminPanel>
    );
  }
  const map = {
    healthy: {
      cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
      text: "🟢 REGISTRIERUNG GESUND",
    },
    manual_required: {
      cls: "border-amber-500/40 bg-amber-500/10 text-amber-600",
      text: "🟡 MANUELLE PRÜFUNG ERFORDERLICH",
    },
    failed: {
      cls: "border-red-500/40 bg-red-500/10 text-red-600",
      text: "🔴 FEHLER GEFUNDEN",
    },
  }[report.overall];
  return (
    <div className={`rounded-2xl border p-4 ${map.cls}`}>
      <p className="text-lg font-bold">{map.text}</p>
      <p className="mt-1 text-xs opacity-80">
        {formatDateTime(report.createdAt)} · {report.errorCount} Fehler · {report.durationMs} ms ·{" "}
        {report.kind === "manual" ? "manueller Test" : "automatischer Check"}
      </p>
    </div>
  );
}

function GroupRow({ group }: { group: CheckGroup }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-muted/40"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {group.label}
        </span>
        <span className="flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground">{group.durationMs} ms</span>
          <StatusPill status={group.status} />
        </span>
      </button>
      {open && (
        <ul className="space-y-2 bg-muted/20 px-4 pb-4 pt-1">
          {group.items.map((item, i) => (
            <li key={i} className="rounded-xl border border-border bg-background p-3">
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-medium text-foreground">{item.label}</span>
                <StatusPill status={item.status} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
              <dl className="mt-2 grid gap-1 text-[11px] text-muted-foreground">
                {item.target && (
                  <div>
                    <dt className="inline font-semibold">Bereich: </dt>
                    <dd className="inline">{item.target}</dd>
                  </div>
                )}
                {typeof item.httpStatus === "number" && (
                  <div>
                    <dt className="inline font-semibold">HTTP: </dt>
                    <dd className="inline">{item.httpStatus}</dd>
                  </div>
                )}
                {item.code && (
                  <div>
                    <dt className="inline font-semibold">Code: </dt>
                    <dd className="inline">{item.code}</dd>
                  </div>
                )}
                {item.technical && (
                  <div>
                    <dt className="inline font-semibold">Technisch: </dt>
                    <dd className="inline break-all">{item.technical}</dd>
                  </div>
                )}
                {item.cause && (
                  <div>
                    <dt className="inline font-semibold">Mögliche Ursache: </dt>
                    <dd className="inline">{item.cause}</dd>
                  </div>
                )}
                {item.action && (
                  <div>
                    <dt className="inline font-semibold">Empfohlene Aktion: </dt>
                    <dd className="inline">{item.action}</dd>
                  </div>
                )}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RegistrationCheckPage() {
  const runCheck = useServerFn(runRegistrationCheck);
  const loadHistory = useServerFn(getRegistrationCheckHistory);
  const saveManual = useServerFn(saveManualRegistrationTest);

  const [history, setHistory] = useState<RegistrationHealthHistory | null>(null);
  const [report, setReport] = useState<RegistrationHealthReport | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualSteps, setManualSteps] = useState<Record<string, "ok" | "failed">>({});
  const [manualNote, setManualNote] = useState("");
  const [savingManual, setSavingManual] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const h = await loadHistory();
      setHistory(h);
      setReport((prev) => prev ?? h.last);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verlauf konnte nicht geladen werden.");
    }
  }, [loadHistory]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onRun = async () => {
    setRunning(true);
    setError("");
    try {
      const r = await runCheck({ data: undefined });
      setReport(r);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Der Check konnte nicht ausgeführt werden.");
    } finally {
      setRunning(false);
    }
  };

  const onSaveManual = async () => {
    setSavingManual(true);
    setError("");
    try {
      const steps = MANUAL_STEPS.map((label) => ({
        label,
        status: manualSteps[label] === "failed" ? ("failed" as const) : ("ok" as const),
      }));
      const r = await saveManual({ data: { steps, note: manualNote } });
      setReport(r);
      setManualOpen(false);
      setManualSteps({});
      setManualNote("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ergebnis konnte nicht gespeichert werden.");
    } finally {
      setSavingManual(false);
    }
  };

  const groups = useMemo(() => report?.groups ?? [], [report]);

  return (
    <AdminSection
      title="Registrierungs-Check"
      description="Kann sich gerade ein neuer Nutzer registrieren – ja oder nein, und wenn nein: warum?"
      actions={
        <div className="flex flex-wrap gap-2">
          <AdminButton onClick={onRun} disabled={running}>
            <RefreshCw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} />
            {running ? "Prüfe …" : "Automatischen Check starten"}
          </AdminButton>
          <a
            href="https://y-dude.com/auth?mode=register"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground hover:border-brand"
          >
            <ExternalLink className="h-4 w-4" />
            Registrierung jetzt manuell testen
          </a>
          <AdminButton onClick={() => setManualOpen((v) => !v)}>
            <Hand className="h-4 w-4" />
            Manuelles Ergebnis eintragen
          </AdminButton>
        </div>
      }
    >
      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-600">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <OverallBanner report={report} />

      {manualOpen && (
        <AdminPanel className="mt-4">
          <h2 className="mb-3 text-sm font-bold text-foreground">Manueller Registrierungstest</h2>
          <p className="text-xs text-muted-foreground">
            Führe die Registrierung auf der echten Seite durch und markiere anschließend, was
            funktioniert hat. Es werden keine Passwörter, Adressen oder Tokens gespeichert.
          </p>
          <ul className="mt-3 space-y-2">
            {MANUAL_STEPS.map((label) => (
              <li
                key={label}
                className="flex items-center justify-between gap-3 rounded-xl border border-border p-2"
              >
                <span className="text-sm text-foreground">{label}</span>
                <span className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setManualSteps((s) => ({ ...s, [label]: "ok" }))}
                    className={`rounded-lg px-2 py-1 text-[10px] font-bold ${
                      manualSteps[label] !== "failed"
                        ? "bg-emerald-500/15 text-emerald-600"
                        : "text-muted-foreground"
                    }`}
                  >
                    OK
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualSteps((s) => ({ ...s, [label]: "failed" }))}
                    className={`rounded-lg px-2 py-1 text-[10px] font-bold ${
                      manualSteps[label] === "failed"
                        ? "bg-red-500/15 text-red-600"
                        : "text-muted-foreground"
                    }`}
                  >
                    Fehler
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <textarea
            value={manualNote}
            onChange={(e) => setManualNote(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Notiz (optional) – keine Passwörter oder Zugangsdaten eintragen"
            className="mt-3 w-full rounded-xl border border-border bg-background p-2 text-sm"
          />
          <div className="mt-3">
            <AdminButton onClick={onSaveManual} disabled={savingManual}>
              <Check className="h-4 w-4" />
              {savingManual ? "Speichere …" : "Ergebnis speichern"}
            </AdminButton>
          </div>
        </AdminPanel>
      )}

      <AdminPanel className="mt-4">
        <h2 className="mb-3 text-sm font-bold text-foreground">Prüfliste</h2>
        {groups.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            Noch keine Ergebnisse. Starte den automatischen Check.
          </p>
        ) : (
          <div className="-mx-3">
            {groups.map((g) => (
              <GroupRow key={`${g.id}-${g.label}`} group={g} />
            ))}
          </div>
        )}
        <p className="mt-3 flex items-start gap-2 text-[11px] text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0" />
          Der Check umgeht weder den Bot-Schutz noch die E-Mail-Bestätigung und legt keine
          Benutzerkonten an. Punkte, die nur ein Mensch prüfen kann, erscheinen als „manueller Test
          erforderlich“ und nie als OK.
        </p>
      </AdminPanel>

      <AdminPanel className="mt-4">
        <h2 className="mb-3 text-sm font-bold text-foreground">Verlauf</h2>
        {!history ? (
          <AdminLoading />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border p-3">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">
                  Letzter erfolgreicher Check
                </p>
                <p className="mt-1 text-sm text-foreground">
                  {history.lastHealthy ? formatDateTime(history.lastHealthy.createdAt) : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">
                  Letzter Fehler
                </p>
                <p className="mt-1 text-sm text-foreground">
                  {history.lastFailure ? formatDateTime(history.lastFailure.createdAt) : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">
                  Fehlerhäufigkeit (30 Tage)
                </p>
                <p className="mt-1 text-sm text-foreground">
                  {history.failureRate30d}% von {history.runs30d} Prüfungen
                </p>
              </div>
            </div>
            <ul className="mt-3 divide-y divide-border">
              {history.entries.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                  <span className="text-muted-foreground">{formatDateTime(e.createdAt)}</span>
                  <span className="text-muted-foreground">
                    {e.kind === "manual" ? "manuell" : "automatisch"}
                  </span>
                  <span className="text-muted-foreground">{e.durationMs} ms</span>
                  <StatusPill
                    status={
                      e.overall === "healthy" ? "ok" : e.overall === "failed" ? "failed" : "manual"
                    }
                  />
                </li>
              ))}
              {history.entries.length === 0 && (
                <li className="py-3 text-xs text-muted-foreground">Noch keine Einträge.</li>
              )}
            </ul>
          </>
        )}
      </AdminPanel>

      <p className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
        <UserPlus className="h-3.5 w-3.5" />
        Ziel: sofort erkennen, ob neue Nutzer aus Werbekampagnen beitreten können.
      </p>
    </AdminSection>
  );
}
