import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  RefreshCw,
  ShieldCheck,
  Search,
  Stethoscope,
  GitCompare,
  ScrollText,
  Play,
} from "lucide-react";
import {
  orbDevApproveFix,
  orbDevAuditLog,
  orbDevCodeQuery,
  orbDevCreateProposal,
  orbDevListProposals,
  orbDevRequestExecution,
  orbDevReviseFix,
  orbDevRunDiagnosis,
  orbDevSandboxEvents,
  orbDevQueueSandboxExecution,
  orbDevStatus,
  orbDevValidateSandboxExecution,
  type CodeQueryMode,
  type OrbDevStatus,
  type ProposalView,
  type SandboxGateView,
} from "@/lib/orb-dev.functions";
import type { AuditEntry, Diagnosis } from "@/orb-dev/types";
import { AdminButton, AdminEmpty, AdminPanel, AdminSection } from "@/components/admin/AdminUI";
import { formatDateTime } from "@/lib/format-date";

export const Route = createFileRoute("/admin/orb-dev")({
  head: () => ({
    meta: [
      { title: "ORB Developer / Repair — Y-Dude Admin" },
      {
        name: "description",
        content:
          "Geschützte Entwicklungs- und Diagnoseumgebung für ORB Core: Code-Analyse, Diagnose, Fix-Vorschläge, Freigabe-Warteschlange und Audit-Log.",
      },
      { property: "og:title", content: "ORB Developer / Repair — Y-Dude Admin" },
      {
        property: "og:description",
        content: "Admin-only Diagnose- und Reparaturumgebung für ORB.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OrbDeveloperEnvironment,
});

const MODES: { value: CodeQueryMode; label: string }[] = [
  { value: "read", label: "Datei lesen" },
  { value: "search", label: "Code durchsuchen" },
  { value: "symbol", label: "Definition finden" },
  { value: "callers", label: "Aufrufer finden" },
  { value: "dependencies", label: "Abhängigkeiten" },
  { value: "tests", label: "Tests finden" },
  { value: "schema", label: "SQL / Schema" },
];

function OrbDeveloperEnvironment() {
  const loadStatus = useServerFn(orbDevStatus);
  const codeQuery = useServerFn(orbDevCodeQuery);
  const runDiagnosis = useServerFn(orbDevRunDiagnosis);
  const listProposals = useServerFn(orbDevListProposals);
  const createProposal = useServerFn(orbDevCreateProposal);
  const approveFix = useServerFn(orbDevApproveFix);
  const requestExecution = useServerFn(orbDevRequestExecution);
  const reviseFix = useServerFn(orbDevReviseFix);
  const loadAudit = useServerFn(orbDevAuditLog);
  const validateSandbox = useServerFn(orbDevValidateSandboxExecution);
  const queueSandbox = useServerFn(orbDevQueueSandboxExecution);
  const loadSandboxEvents = useServerFn(orbDevSandboxEvents);

  const [status, setStatus] = useState<OrbDevStatus | null>(null);
  const [mode, setMode] = useState<CodeQueryMode>("search");
  const [value, setValue] = useState("retrieveCandidates");
  const [result, setResult] = useState<string>("");
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [proposals, setProposals] = useState<ProposalView[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [gate, setGate] = useState<SandboxGateView | null>(null);
  const [sandboxEvents, setSandboxEvents] = useState<AuditEntry[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    void loadStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
    void listProposals()
      .then(setProposals)
      .catch(() => setProposals([]));
    void loadAudit()
      .then(setAudit)
      .catch(() => setAudit([]));
    void loadSandboxEvents()
      .then((rows) => setSandboxEvents(rows as unknown as AuditEntry[]))
      .catch(() => setSandboxEvents([]));
  }, [loadStatus, listProposals, loadAudit, loadSandboxEvents]);

  useEffect(refresh, [refresh]);

  const onQuery = async () => {
    setBusy(true);
    try {
      const res = await codeQuery({ data: { mode, value } });
      setResult(
        res.file
          ? `${res.file.path} (${res.file.lines} Zeilen)\n\n${res.file.content}`
          : res.dependencies
            ? res.dependencies.join("\n")
            : (res.matches ?? []).map((m) => `${m.path}:${m.line}  ${m.text}`).join("\n") ||
              "Keine Treffer.",
      );
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Zugriff verweigert");
    } finally {
      setBusy(false);
    }
  };

  const onDiagnose = async () => {
    setBusy(true);
    try {
      setDiagnosis(await runDiagnosis({ data: {} }));
      refresh();
    } catch {
      toast.error("Diagnose nicht möglich");
    } finally {
      setBusy(false);
    }
  };

  const onPropose = async () => {
    setBusy(true);
    try {
      const res = await createProposal();
      if (res.created) toast.success(`Fix-Vorschlag ${res.created} erstellt`);
      else toast.error(res.error ?? "Kein Fix-Vorschlag möglich");
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const onApprove = async (p: ProposalView) => {
    setBusy(true);
    try {
      const res = await approveFix({ data: { fixId: p.fixId, fingerprint: p.fingerprint } });
      if (res.ok) toast.success(`${p.fixId} freigegeben`);
      else toast.error(res.reason ?? "Freigabe abgelehnt");
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const onRevise = async (p: ProposalView) => {
    setBusy(true);
    try {
      const res = await reviseFix({ data: { fixId: p.fixId, note: "Inhalt überarbeitet" } });
      if (res.created)
        toast.success(`Neue Fix-Version ${res.created} – alte Freigabe ist ungültig`);
      else toast.error(res.error ?? "Änderung nicht möglich");
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const onRequestExecution = async (p: ProposalView) => {
    const res = await requestExecution({ data: { fixId: p.fixId, path: p.files[0] ?? "" } });
    toast.message("Ausführung abgelehnt", { description: res.reason });
    refresh();
  };

  const onCheckSandbox = async (p: ProposalView) => {
    setBusy(true);
    try {
      setGate(await validateSandbox({ data: { fixId: p.fixId } }));
    } catch {
      toast.error("Prüfung nicht möglich");
      setGate(null);
    } finally {
      setBusy(false);
    }
  };

  const onQueueSandbox = async (p: ProposalView) => {
    setBusy(true);
    try {
      const res = await queueSandbox({ data: { fixId: p.fixId, fingerprint: p.fingerprint } });
      if (res.queued)
        toast.success("Sandbox-Ausführung beauftragt", {
          description: `Isolierte Ausführung: ${res.runner}`,
        });
      else toast.error(res.reason ?? "Ausführung blockiert");
      setGate(await validateSandbox({ data: { fixId: p.fixId } }));
      refresh();
    } catch {
      toast.error("Ausführung blockiert");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <AdminSection
        title="ORB Developer / Repair"
        description="Admin-only, serverseitig erzwungen. Phase 3: Fix-Vorschläge, Freigaben und Protokoll dauerhaft gespeichert; freigegebene Fixes laufen ausschliesslich in einer isolierten Sandbox. Kein Live-Code, kein Deployment, keine autonome Selbstreparatur."
        actions={
          <AdminButton onClick={refresh}>
            <RefreshCw className="h-3.5 w-3.5" /> Aktualisieren
          </AdminButton>
        }
      >
        <div className="space-y-6">
          {/* 1. System Status */}
          <AdminPanel>
            <h2 className="mb-3 text-[12px] font-bold uppercase tracking-[0.15em] text-brand">
              1 · System Status
            </h2>
            {!status ? (
              <AdminEmpty>Kein Zugriff oder Status nicht verfügbar.</AdminEmpty>
            ) : (
              <dl className="grid gap-2 text-[12px] sm:grid-cols-2">
                <Row label="Phase" value={status.phase} />
                <Row label="Speicherung" value="dauerhaft in der Datenbank (mit Zeilenschutz)" />
                <Row
                  label="Schreiboperationen"
                  value={status.writeOperationsEnabled ? "AN" : "AUS"}
                />
                <Row
                  label="Selbstveränderung"
                  value={status.selfModificationEnabled ? "AN" : "AUS"}
                />
                <Row label="Deployment" value={status.deploymentEnabled ? "AN" : "AUS"} />
                <Row label="Lesbare Bereiche" value={status.allowedRoots.join(", ")} />
                <Row label="Fix-Vorschläge" value={String(status.proposals)} />
                <Row label="Freigaben" value={String(status.approvals)} />
              </dl>
            )}
          </AdminPanel>

          {/* 2. Code Analysis */}
          <AdminPanel>
            <h2 className="mb-3 text-[12px] font-bold uppercase tracking-[0.15em] text-brand">
              2 · Code Analysis (read-only)
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as CodeQueryMode)}
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-[12px]"
              >
                {MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="min-w-[240px] flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-[12px]"
                placeholder="Pfad, Symbol oder Suchbegriff"
              />
              <AdminButton onClick={onQuery} disabled={busy}>
                <Search className="h-3.5 w-3.5" /> Analysieren
              </AdminButton>
            </div>
            {result ? (
              <pre className="mt-3 max-h-80 overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-[11px] leading-relaxed">
                {result}
              </pre>
            ) : null}
          </AdminPanel>

          {/* 3. Diagnostics */}
          <AdminPanel>
            <h2 className="mb-3 text-[12px] font-bold uppercase tracking-[0.15em] text-brand">
              3 · Diagnostics
            </h2>
            <AdminButton onClick={onDiagnose} disabled={busy}>
              <Stethoscope className="h-3.5 w-3.5" /> Erstfall analysieren („Wie alt bin ich?“)
            </AdminButton>
            {diagnosis ? (
              <div className="mt-3 space-y-3 text-[12px]">
                <p className="text-muted-foreground">{diagnosis.observation}</p>
                <div className="rounded-lg border border-border p-3">
                  <p className="font-semibold">Ursache: {diagnosis.rootCauseLevel}</p>
                  <p className="text-muted-foreground">{diagnosis.rootCause}</p>
                </div>
                <ol className="space-y-1">
                  {diagnosis.chain.map((step) => (
                    <li key={step.stage} className="flex gap-2">
                      <span
                        className={
                          step.outcome === "BLOCKED"
                            ? "shrink-0 font-mono text-destructive"
                            : "shrink-0 font-mono text-muted-foreground"
                        }
                      >
                        {step.stage} [{step.outcome}]
                      </span>
                      <span className="text-muted-foreground">{step.detail}</span>
                    </li>
                  ))}
                </ol>
                {diagnosis.codeTrace.length > 0 ? (
                  <pre className="max-h-48 overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-[11px]">
                    {diagnosis.codeTrace.map((t) => `${t.path}:${t.line}  ${t.text}`).join("\n")}
                  </pre>
                ) : null}
                {diagnosis.relatedTests.length > 0 ? (
                  <p className="text-muted-foreground">
                    Tests: {diagnosis.relatedTests.join(", ")}
                  </p>
                ) : null}
              </div>
            ) : null}
          </AdminPanel>

          {/* 4./5. Fix Proposals + Approval Queue */}
          <AdminPanel>
            <h2 className="mb-3 text-[12px] font-bold uppercase tracking-[0.15em] text-brand">
              4/5 · Fix Proposals & Approval Queue
            </h2>
            <AdminButton onClick={onPropose} disabled={busy}>
              <GitCompare className="h-3.5 w-3.5" /> Fix-Vorschlag aus bewiesener Ursache erstellen
            </AdminButton>
            {proposals.length === 0 ? (
              <AdminEmpty>Noch kein Fix-Vorschlag gespeichert.</AdminEmpty>
            ) : (
              <ul className="mt-3 space-y-4">
                {proposals.map((p) => (
                  <li key={p.fixId} className="rounded-xl border border-border p-3 text-[12px]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono font-semibold text-brand">{p.fixId}</span>
                      <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[11px]">
                        {p.state}
                      </span>
                    </div>
                    <p className="mt-2 font-semibold">Root Cause ({p.rootCauseLevel})</p>
                    <p className="text-muted-foreground">{p.rootCause}</p>
                    <p className="mt-2 font-semibold">Files</p>
                    <p className="font-mono text-muted-foreground">{p.files.join(", ")}</p>
                    <p className="mt-2 font-semibold">Diff</p>
                    <pre className="max-h-56 overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-[11px]">
                      {p.diff}
                    </pre>
                    <List title="Test Plan" items={p.testPlan} />
                    <List title="Risks" items={p.risks} />
                    <List title="Rollback Plan" items={p.rollbackPlan} />
                    <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                      Fingerabdruck {p.fingerprint} · Version {p.version}
                      {p.supersedesFixId ? ` · ersetzt ${p.supersedesFixId}` : ""} · erstellt{" "}
                      {formatDateTime(p.createdAt)} · geändert {formatDateTime(p.updatedAt)} ·
                      Quelle {p.createdBy}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                      {p.approval
                        ? `Freigabe ${p.approval.status} · ${formatDateTime(p.approval.approvedAt)} · Fingerabdruck ${p.approval.fingerprint}${p.approved ? "" : " (ungültig – Inhalt geändert)"}`
                        : "Keine Freigabe"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <AdminButton
                        onClick={() => onApprove(p)}
                        disabled={busy || p.approved || p.state !== "WAITING_FOR_ADMIN_APPROVAL"}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {p.approved ? "FREIGEGEBEN" : `FIX ${p.fixId} FREIGEBEN`}
                      </AdminButton>
                      <AdminButton onClick={() => onRevise(p)} disabled={busy}>
                        Fix ändern (entwertet Freigabe, neue Fix-ID)
                      </AdminButton>
                      <AdminButton onClick={() => onRequestExecution(p)}>
                        Live-Ausführung anfragen (immer abgelehnt)
                      </AdminButton>
                      <AdminButton onClick={() => onCheckSandbox(p)} disabled={busy}>
                        <ShieldCheck className="h-3.5 w-3.5" /> Freigabe für Sandbox prüfen
                      </AdminButton>
                      <AdminButton
                        onClick={() => onQueueSandbox(p)}
                        disabled={busy || !gate || gate.fixId !== p.fixId || !gate.ready}
                      >
                        <Play className="h-3.5 w-3.5" /> ▶ APPROVED FIX IN SANDBOX AUSFÜHREN
                      </AdminButton>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </AdminPanel>

          {/* 6. Repair Sandbox */}
          <AdminPanel>
            <h2 className="mb-3 text-[12px] font-bold uppercase tracking-[0.15em] text-brand">
              6 · Repair Sandbox (isoliert, kein Live-Code, kein Deployment)
            </h2>
            {!gate ? (
              <AdminEmpty>
                Freigabe eines Fixes prüfen, um den Sandbox-Zustand zu sehen. Die Prüfung erfolgt
                immer serverseitig – auch der Knopf allein genügt nie.
              </AdminEmpty>
            ) : (
              <dl className="grid gap-2 text-[12px] sm:grid-cols-2">
                <Row label="Fix-ID" value={gate.fixId} />
                <Row label="Version" value={gate.version === null ? "—" : String(gate.version)} />
                <Row label="Fingerabdruck" value={gate.fingerprint ?? "—"} />
                <Row label="Sandbox-Status" value={gate.state} />
                <Row label="Freigabe gültig" value={gate.ready ? "JA" : "NEIN"} />
                <Row label="Grund" value={gate.reason ?? "—"} />
                <Row label="Patch-Dateien" value={gate.patchFiles.join(", ") || "—"} />
                <Row label="Geprüfte Schritte" value={String(gate.commands.length)} />
                <Row
                  label="Live-Code schreiben"
                  value={gate.liveCodeWriteEnabled ? "AN" : "AUS (gesperrt)"}
                />
                <Row
                  label="Deployment"
                  value={gate.deploymentEnabled ? "AN" : "AUS (gesperrt)"}
                />
              </dl>
            )}
            {gate && gate.commands.length > 0 ? (
              <pre className="mt-3 max-h-48 overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-[11px]">
                {gate.commands.join("\n")}
              </pre>
            ) : null}
            <p className="mt-3 text-[11px] text-muted-foreground">
              Ein erfolgreicher Durchlauf bedeutet ausschliesslich: der freigegebene Fix wurde
              isoliert angewendet und getestet. Nicht „Production Ready“, nicht „deployed“, nicht
              „selbst repariert“. Danach: READY FOR HUMAN REVIEW.
            </p>
            {sandboxEvents.length > 0 ? (
              <ul className="mt-3 space-y-1 text-[11px]">
                {sandboxEvents.map((e, i) => (
                  <li key={`${e.at}-${i}`} className="flex flex-wrap gap-2 font-mono">
                    <span>{formatDateTime(e.at)}</span>
                    <span className="text-brand">{e.action}</span>
                    <span>{e.fixId ?? "—"}</span>
                    <span className="text-muted-foreground">
                      {e.previousState ?? "—"} → {e.newState ?? "—"}
                    </span>
                    <span className="text-muted-foreground">{e.result}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </AdminPanel>

          {/* 7. Audit Log */}
          <AdminPanel>
            <h2 className="mb-3 text-[12px] font-bold uppercase tracking-[0.15em] text-brand">
              7 · Audit Log
            </h2>
            {audit.length === 0 ? (
              <AdminEmpty>Keine Protokolleinträge gespeichert.</AdminEmpty>
            ) : (
              <ul className="space-y-1 text-[11px]">
                {audit.map((e, i) => (
                  <li key={`${e.at}-${i}`} className="flex flex-wrap gap-2 font-mono">
                    <ScrollText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{formatDateTime(e.at)}</span>
                    <span className="text-brand">{e.action}</span>
                    <span>{e.fixId ?? "—"}</span>
                    <span className="text-muted-foreground">
                      {e.previousState ?? "—"} → {e.newState ?? "—"}
                    </span>
                    <span className="text-muted-foreground">{e.result}</span>
                  </li>
                ))}
              </ul>
            )}
          </AdminPanel>
        </div>
      </AdminSection>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 rounded-lg border border-border px-3 py-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-mono">{value}</dd>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-2">
      <p className="font-semibold">{title}</p>
      <ul className="list-inside list-disc text-muted-foreground">
        {items.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
