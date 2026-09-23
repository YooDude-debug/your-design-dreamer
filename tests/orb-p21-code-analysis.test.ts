/**
 * P21 – ORB Code Analysis Access (READ-ONLY).
 *
 * Keine Produktionsdaten, kein Modellaufruf, keine Schreiboperation: die
 * Datenbank ist eine Attrappe, gelesen wird ausschliesslich echter
 * Projektcode innerhalb des erlaubten Lesebereichs.
 */

import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";

import {
  ORB_CODE_ANALYSIS_CAPABILITY_ID,
  assessCodeAnalysisNeed,
  checkCodeAnalysisRequest,
  checkCodeOperationAllowed,
  formatCodeRequestId,
  normalizeCodeTarget,
  redactSecrets,
  type CodeAnalysisRequest,
} from "@/orb-core/toolbox/code-contract";
import { listAnalysisCapabilities, resolveOrbCapability } from "@/orb-core/toolbox/access.server";
import {
  clearCodeAnalysisCache,
  requestCodeWriteOperation,
  runCodeAnalysis,
} from "@/orb-core/toolbox/code-analysis.server";
import { readCodeFile, searchCode } from "@/orb-core/toolbox/code-read.server";

afterEach(() => clearCodeAnalysisCache());

const db = (isAdmin: boolean, fail = false) =>
  ({
    rpc: async () =>
      fail ? { data: null, error: new Error("rpc down") } : { data: isAdmin, error: null },
  }) as never;

const req = (over: Partial<CodeAnalysisRequest> = {}): CodeAnalysisRequest => ({
  capability: ORB_CODE_ANALYSIS_CAPABILITY_ID,
  mode: "read_only",
  target: "src/orb-core/llm",
  question: "Warum kann orb.analysis nicht als Tool aufgerufen werden?",
  reason: "P17-Befund im Runtime-Wiring nachvollziehen",
  requestId: formatCodeRequestId(Math.random().toString(16).slice(2)),
  source: "orb_internal",
  ...over,
});

describe("P21 – Discovery", () => {
  it("1 – ORB entdeckt orb.code_analysis eindeutig im vorhandenen Verzeichnis", () => {
    const caps = listAnalysisCapabilities();
    const ids = caps.map((c) => c.capabilityId);
    expect(ids).toContain("orb.analysis");
    expect(ids).toContain(ORB_CODE_ANALYSIS_CAPABILITY_ID);
    expect(new Set(ids).size).toBe(ids.length);
    const code = caps.find((c) => c.capabilityId === ORB_CODE_ANALYSIS_CAPABILITY_ID);
    expect(code?.kind).toBe("code_analysis");
    expect(code?.readOnly).toBe(true);
    expect(code?.requiresAdminRole).toBe(true);
    expect(code?.requiresHumanApprovalForAnyChange).toBe(true);
    expect(code?.scope).toEqual(["src", "tests", "docs"]);
    expect(resolveOrbCapability(ORB_CODE_ANALYSIS_CAPABILITY_ID)).not.toBeNull();
    expect(resolveOrbCapability("orb.deploy")).toBeNull();
  });
});

describe("P21 – lesende Analyse", () => {
  it("2–5 – erlaubte Read-only-Analyse liest echte Dateien und liefert Evidence", async () => {
    const result = await runCodeAnalysis(db(true), "admin-1", req());
    expect(result.status).toBe("COMPLETED");
    expect(result.mode).toBe("read_only");
    expect(result.filesExamined.length).toBeGreaterThan(0);
    expect(result.filesExamined.every((f) => f.startsWith("src/"))).toBe(true);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.evidence.length).toBeGreaterThan(0);
    const ev = result.evidence[0]!;
    expect(ev.file).toMatch(/^src\//);
    expect(ev.line === null || ev.line > 0).toBe(true);
    expect(result.modelCalls).toBe(0);
    expect(result.codeChanged).toBe(false);
    expect(result.patchApplied).toBe(false);
    expect(result.deployed).toBe(false);
  });

  it("4 – der P17-Befund wird am Code nachvollzogen (kein Werkzeug-Protokoll)", async () => {
    const result = await runCodeAnalysis(db(true), "admin-1", req());
    const finding = result.findings.find((f) => f.code === "CODE_NO_TOOL_PROTOCOL");
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe("error");
    expect(finding?.evidence.some((e) => e.file.includes("src/orb-core/llm"))).toBe(true);
    expect(result.proposedChange).toHaveLength(1);
    expect(result.proposedChange[0]?.requiresHumanApproval).toBe(true);
    expect(result.proposedChange[0]?.applied).toBe(false);
  });

  it("6 – Zugangsdaten werden entfernt und liegen aussenhalb des Lesebereichs", async () => {
    expect(redactSecrets('API_KEY = "abcd1234efgh"')).not.toContain("abcd1234efgh");
    expect(redactSecrets("const k = 'sk-abcdefgh12345678'")).not.toContain("sk-abcdefgh12345678");
    expect(normalizeCodeTarget(".env").ok).toBe(false);
    expect(normalizeCodeTarget("../etc/passwd").ok).toBe(false);
    expect(normalizeCodeTarget("/etc/passwd").ok).toBe(false);
    expect(normalizeCodeTarget("node_modules/x").ok).toBe(false);
    expect((await readCodeFile(".env")).ok).toBe(false);
    expect((await readCodeFile("src/orb-core/toolbox/code-contract.ts")).ok).toBe(true);
    const hits = await searchCode("SUPABASE_SERVICE_ROLE_KEY", { target: "src", maxMatches: 5 });
    expect(hits.every((h) => !/eyJ[A-Za-z0-9_-]{10,}/.test(h.excerpt))).toBe(true);
  });
});

describe("P21 – Read/Write-Grenze", () => {
  it("7–9 – Schreiben, Patch und Deployment werden verweigert", () => {
    for (const op of [
      "write_file",
      "apply_patch",
      "migration",
      "deployment",
      "publish",
      "secret_access",
    ]) {
      expect(checkCodeOperationAllowed(op).allowed).toBe(false);
      expect(requestCodeWriteOperation(op).allowed).toBe(false);
      expect(requestCodeWriteOperation(op).reason.length).toBeGreaterThan(10);
    }
    expect(checkCodeOperationAllowed("read_file").allowed).toBe(true);
    const src = readFileSync("src/orb-core/toolbox/code-read.server.ts", "utf8");
    expect(src).not.toMatch(/\b(writeFile|mkdir|rmdir|unlink|appendFile|rename|rm)\s*\(/);
    const analysis = readFileSync("src/orb-core/toolbox/code-analysis.server.ts", "utf8");
    // keine Dateischreibung und kein Tabellenzugriff (kein INSERT/UPDATE/DELETE)
    expect(analysis).not.toMatch(/\bwriteFile\s*\(/);
    expect(analysis).not.toMatch(/db\.from\(|supabase\.from\(/);
  });

  it("14 – Änderungen bleiben an eine menschliche Freigabe gebunden", async () => {
    const result = await runCodeAnalysis(db(true), "admin-1", req());
    expect(result.approvalCreated).toBe(false);
    for (const p of result.proposedChange) {
      expect(p.requiresHumanApproval).toBe(true);
      expect(p.applied).toBe(false);
    }
  });
});

describe("P21 – Berechtigung und Quellen", () => {
  it("10 – ohne Administratorrolle wird abgelehnt", async () => {
    const denied = await runCodeAnalysis(db(false), "user-1", req());
    expect(denied.status).toBe("ANALYSIS_DENIED");
    expect(denied.failureKind).toBe("unauthorized");
    expect(denied.filesExamined).toEqual([]);

    const broken = await runCodeAnalysis(db(true, true), "user-1", req());
    expect(broken.status).toBe("ANALYSIS_DENIED");
  });

  it("11–12 – normale Nachricht und autonome Frage starten keine Codeanalyse", async () => {
    for (const source of [
      "orb_chat_message",
      "orb_autonomous_question",
      "orb_curiosity",
      "orb_memory",
    ]) {
      expect(assessCodeAnalysisNeed({ source, question: "Fehler im Code?" }).needed).toBe(false);
      const check = checkCodeAnalysisRequest({ ...req(), source });
      expect(check.ok).toBe(false);
      const result = await runCodeAnalysis(db(true), "admin-1", {
        ...req(),
        source,
      } as CodeAnalysisRequest);
      expect(result.status).toBe("ANALYSIS_DENIED");
      expect(result.filesExamined).toEqual([]);
    }
    // Kein Aufruf aus dem normalen Verarbeitungspfad.
    const engine = readFileSync("src/orb-core/engine.server.ts", "utf8");
    expect(engine).not.toMatch(/code-analysis\.server|runCodeAnalysis|code_analysis/);
    // Ohne technischen Grund keine Analyse, auch aus erlaubter Quelle nicht.
    expect(
      assessCodeAnalysisNeed({ source: "orb_internal", question: "Wie geht es dir?" }).needed,
    ).toBe(false);
    expect(
      assessCodeAnalysisNeed({ source: "orb_internal", question: "Warum schlägt der Import fehl?" })
        .needed,
    ).toBe(true);
    expect(checkCodeAnalysisRequest({ ...req(), reason: "weil" }).ok).toBe(false);
    expect(checkCodeAnalysisRequest({ ...req(), mode: "write" }).ok).toBe(false);
  });

  it("13 – Analysefehler blockiert den normalen Betrieb nicht", async () => {
    const missing = await runCodeAnalysis(
      db(true),
      "admin-1",
      req({ target: "src/gibt-es-nicht-xyz" }),
    );
    expect(["ANALYSIS_UNAVAILABLE", "COMPLETED"]).toContain(missing.status);
    expect(missing.codeChanged).toBe(false);

    const timedOut = await runCodeAnalysis(
      db(true),
      "admin-1",
      req({ target: "src", timeoutMs: 1 }),
    );
    expect(["ANALYSIS_FAILED", "COMPLETED"]).toContain(timedOut.status);
  });
});

describe("P21 – Idempotenz und Beobachtbarkeit", () => {
  it("gleiche request_id führt die Analyse nicht erneut aus", async () => {
    const request = req();
    const first = await runCodeAnalysis(db(true), "admin-1", request);
    const second = await runCodeAnalysis(db(true), "admin-1", request);
    expect(second).toBe(first);
    expect(second.timestamp).toBe(first.timestamp);
  });

  it("jedes Ergebnis trägt Kennung, Zeit, Fähigkeit, Quelle, Ziel, Status, Dauer", async () => {
    const result = await runCodeAnalysis(db(true), "admin-1", req());
    expect(result.requestId).toMatch(/^orb_ca_[0-9a-f]{8,32}$/);
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
    expect(result.capability).toBe(ORB_CODE_ANALYSIS_CAPABILITY_ID);
    expect(result.source).toBe("orb_internal");
    expect(result.target).toBe("src/orb-core/llm");
    expect(typeof result.durationMs).toBe("number");
    expect(["high", "medium", "low", "none"]).toContain(result.confidence);
  });
});

describe("P21 – End-to-End: ORB fragt selbst", () => {
  it("ORB stellt eine technische Frage und erklärt die Ursache mit Code-Evidence", async () => {
    const question = "Warum kann ich orb.analysis aktuell nicht als Tool aufrufen?";
    const need = assessCodeAnalysisNeed({ source: "orb_internal", question });
    expect(need.needed).toBe(true);

    const resolved = resolveOrbCapability(ORB_CODE_ANALYSIS_CAPABILITY_ID);
    expect(resolved).not.toBeNull();
    const result = (await resolved!.request(db(true), "admin-1", req({ question }))) as Awaited<
      ReturnType<typeof runCodeAnalysis>
    >;
    expect(result.status).toBe("COMPLETED");
    expect(result.findings.some((f) => f.code === "CODE_NO_TOOL_PROTOCOL")).toBe(true);
    expect(result.evidence.every((e) => /^(src|tests|docs)\//.test(e.file))).toBe(true);
    expect(result.codeChanged).toBe(false);
    expect(result.dbChanged).toBe(false);
    expect(result.modelCalls).toBe(0);
  });
});
