import { requestOrbAnalysis } from "@/orb-core/toolbox/access.server";
let rpc = 0, reads = 0;
const rows = [
  { id: "1", fix_id: "ORB-FIX-0001", state: "WAITING_FOR_ADMIN_APPROVAL", version: 1, files: ["src/orb-core/memory.ts"], created_at: new Date().toISOString(), fingerprint: "a", diff: "", scope: "memory_recall", root_cause: "x", evidence: [], confidence: "HIGH", source: "orb_chat", created_by: "u", metadata: {} },
];
const db = {
  rpc: async () => { rpc++; return { data: true, error: null }; },
  from: () => ({ select: () => ({ order: () => ({ limit: async () => { reads++; return { data: rows, error: null }; } }) }) }),
} as never;
const t0 = Date.now();
const r = await requestOrbAnalysis(db, "p11-admin", { analysisType: "repair_pipeline_state" });
console.log(JSON.stringify({ status: r.status, failureKind: r.failureKind, durationMs: r.durationMs, wall: Date.now() - t0, modelCalls: r.modelCalls, findings: r.findings, recommendations: r.recommendations, rpc, reads }, null, 1));
