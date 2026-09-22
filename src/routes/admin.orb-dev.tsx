import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { RefreshCw, ShieldCheck, Search, Stethoscope, GitCompare, ScrollText } from "lucide-react";
import {
  orbDevApproveFix,
  orbDevAuditLog,
  orbDevCodeQuery,
  orbDevCreateProposal,
  orbDevListProposals,
  orbDevRequestExecution,
  orbDevRunDiagnosis,
  orbDevStatus,
  type CodeQueryMode,
  type OrbDevStatus,
  type ProposalView,
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
      { property: "og:description", content: "Admin-only Diagnose- und Reparaturumgebung für ORB." },
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
  const loadAudit = useServerFn(orbDevAuditLog);

  const [status, setStatus] = useState<OrbDevStatus | null>(null);
  const [mode, setMode] = useState<CodeQueryMode>("search");
  const [value, setValue] = useState("retrieveCandidates");
  const [result, setResult] = useState<string>("");
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [proposals, setProposals] = useState<ProposalView[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    void loadStatus().then(setStatus).catch(() => setStatus(null));
    void listProposals().then(setProposals).catch(() => setProposals([]));
    void loadAudit().then(setAudit).catch(() => setAudit([]));
  }, [loadStatus, listProposals, loadAudit]);

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

  const onRequestExecution = async (p: ProposalView) => {
    const res = await requestExecution({ data: { fixId: p.fixId, path: p.files[0] ?? "" } });
    toast.message("Ausführung abgelehnt", { description: res.reason });
    refresh();
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6">
      <AdminSection
        title="ORB Developer / Repair"
        description="Admin-only, serverseitig erzwungen. Phase 1: ausschliesslich lesende Analyse, Fix-Vorschläge und Freigabe-Logik. Keine Änderung am laufenden ORB."
      >
        <AdminButton onClick={refresh}>
          <RefreshCw className="h-3.5 w-3.5" /> Aktualisieren
        </AdminButton>
      </AdminSection>

      {/* 1. System Status */}
      <AdminPanel title="1 · System Status">
        {!status ? (
          <AdminEmpty text="Kein Zugriff oder Status nicht verfügbar." />
        ) : (
          <dl className="grid gap-2 text-[12px] sm:grid-cols-2">
            <Row label="Phase" value={status.phase} />
            <Row label="Speicherung" value="nur laufende Server-Sitzung (keine Datenbank)" />
            <Row label="Schreiboperationen" value={status.writeOperationsEnabled ? "AN" : "AUS"} />
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
      <AdminPanel title="2 · Code Analysis (read-only)">
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
      <AdminPanel title="3 · Diagnostics">
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
              <p className="text-muted-foreground">Tests: {diagnosis.relatedTests.join(", ")}</p>
            ) : null}
          </div>
        ) : null}
      </AdminPanel>

      {/* 4./5. Fix Proposals + Approval Queue */}
      <AdminPanel title="4/5 · Fix Proposals & Approval Queue">
        <AdminButton onClick={onPropose} disabled={busy}>
          <GitCompare className="h-3.5 w-3.5" /> Fix-Vorschlag aus bewiesener Ursache erstellen
        </AdminButton>
        {proposals.length === 0 ? (
          <AdminEmpty text="Noch kein Fix-Vorschlag in dieser Sitzung." />
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
                  Fingerabdruck {p.fingerprint} · erstellt {formatDateTime(p.createdAt)} · Quelle{" "}
                  {p.createdBy}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <AdminButton
                    onClick={() => onApprove(p)}
                    disabled={busy || p.approved || p.state !== "WAITING_FOR_ADMIN_APPROVAL"}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {p.approved ? "FREIGEGEBEN" : `FIX ${p.fixId} FREIGEBEN`}
                  </AdminButton>
                  <AdminButton onClick={() => onRequestExecution(p)}>
                    Ausführung anfragen (Phase 1: immer abgelehnt)
                  </AdminButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminPanel>

      {/* 6. Test Results */}
      <AdminPanel title="6 · Test Results">
        <AdminEmpty text="Phase 1 führt keine Tests in dieser Umgebung aus. Testergebnisse werden ab Phase 2 einer Fix-ID zugeordnet." />
      </AdminPanel>

      {/* 7. Audit Log */}
      <AdminPanel title="7 · Audit Log">
        {audit.length === 0 ? (
          <AdminEmpty text="Keine Einträge in dieser Server-Sitzung." />
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
