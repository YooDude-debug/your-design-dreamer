import { discoverAnalysisAccess, requestOrbAnalysis, isAnalysisAvailable } from "@/orb-core/toolbox/access.server";
import { TOOLBOX_ANALYSIS_TYPES } from "@/orb-core/toolbox/contract";

let rpc = 0, reads = 0;
const db = {
  rpc: async (_n: string, _a: unknown) => { rpc++; return { data: true, error: null }; },
  from: (_t: string) => ({
    select: (_c: string) => ({
      eq: () => ({ order: () => ({ limit: async () => { reads++; return { data: [], error: null }; } }) }),
    }),
  }),
} as never;

const access = discoverAnalysisAccess();
console.log("ACCESS", JSON.stringify(access));
for (const t of TOOLBOX_ANALYSIS_TYPES) console.log("AVAILABLE", t, isAnalysisAvailable(t));

for (const t of TOOLBOX_ANALYSIS_TYPES) {
  const t0 = Date.now();
  const r = await requestOrbAnalysis(db, "p11-admin", { analysisType: t });
  console.log("RESULT", t, JSON.stringify({ status: r.status, failureKind: r.failureKind, durationMs: r.durationMs, wall: Date.now() - t0, modelCalls: r.modelCalls, codeChanged: r.codeChanged, dbChanged: r.dbChanged, proposalCreated: r.proposalCreated, approvalCreated: r.approvalCreated, deployed: r.deployed }, null, 0));
  for (const f of r.findings) console.log("  FINDING", f.severity, f.code, "|", f.summary, "|", JSON.stringify(f.evidence));
  for (const rec of r.recommendations) console.log("  REC", JSON.stringify(rec));
}
// Berechtigungsprobe: ohne Adminrolle
const denyDb = { rpc: async () => ({ data: false, error: null }) } as never;
const denied = await requestOrbAnalysis(denyDb, "p11-nonadmin", { analysisType: "memory_recall" });
console.log("DENIED", denied.status, denied.failureKind);
console.log("DB_OPS", JSON.stringify({ rpcCalls: rpc, tableReads: reads }));
