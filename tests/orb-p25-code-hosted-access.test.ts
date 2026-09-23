/**
 * P25 – serverseitiger Lesebestand + ehrliche Ergebniszustände.
 * Keine Modellaufrufe, keine Schreiboperation, Datenbank ist eine Attrappe.
 */
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";

import { ORB_CODE_ANALYSIS_CAPABILITY_ID, formatCodeRequestId, type CodeAnalysisRequest } from "@/orb-core/toolbox/code-contract";
import { clearCodeAnalysisCache, runCodeAnalysis } from "@/orb-core/toolbox/code-analysis.server";
import { __setCodeSourceForTests, createSnapshotSource, readCodeFile } from "@/orb-core/toolbox/code-read.server";
import { loadCodeSnapshot } from "@/orb-core/toolbox/code-snapshot.server";
import { buildOrbCodeSnapshot } from "../vite-plugins/orb-code-snapshot";

afterEach(() => {
  clearCodeAnalysisCache();
  __setCodeSourceForTests(null);
});

const db = { rpc: async () => ({ data: true, error: null }) } as never;
const req = (over: Partial<CodeAnalysisRequest> = {}): CodeAnalysisRequest => ({
  capability: ORB_CODE_ANALYSIS_CAPABILITY_ID,
  mode: "read_only",
  target: "src/orb-core/llm/provider.server.ts",
  question: "Bietet die Sprachschicht orb.analysis als Modellwerkzeug (tools) an?",
  reason: "P25 gehosteter Lesezugang pruefen",
  requestId: formatCodeRequestId(Math.random().toString(16).slice(2)),
  source: "admin_chat",
  ...over,
});

describe("P25 – Lesebestand", () => {
  it("enthält src/tests/docs, aber keine .env, JSON-Daten, node_modules; Secrets maskiert", () => {
    const { files, meta } = buildOrbCodeSnapshot(process.cwd());
    const keys = Object.keys(files);
    expect(meta.fileCount).toBe(keys.length);
    expect(keys).toContain("src/orb-core/llm/provider.server.ts");
    expect(keys.some((k) => k.startsWith("tests/"))).toBe(true);
    expect(keys.some((k) => k.startsWith("docs/"))).toBe(true);
    expect(keys.every((k) => /^(src|tests|docs)\//.test(k))).toBe(true);
    expect(keys.some((k) => /\.env|node_modules|\.json$|(^|\/)dist\//.test(k))).toBe(false);
    for (const text of Object.values(files)) {
      expect(text).not.toMatch(/\bsk-[A-Za-z0-9_-]{8,}/);
      expect(text).not.toMatch(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/);
    }
  });

  it("ist reproduzierbar (gleicher Stand ⇒ gleicher Hash)", () => {
    expect(buildOrbCodeSnapshot(process.cwd()).meta.sha256).toBe(
      buildOrbCodeSnapshot(process.cwd()).meta.sha256,
    );
  });

  it("Server-Modul lädt den Bestand über das virtuelle Modul", async () => {
    const snap = await loadCodeSnapshot();
    expect(snap?.meta.fileCount).toBeGreaterThan(100);
  });
});

describe("P25 – Analyse aus dem Lesebestand (gehostete Laufzeit simuliert)", () => {
  it("liest echte Datei aus src/orb-core, liefert Evidence, erkennt Werkzeugprotokoll", async () => {
    const snap = await loadCodeSnapshot();
    __setCodeSourceForTests(createSnapshotSource(snap!.files));
    const r = await runCodeAnalysis(db, "admin-1", req());
    expect(r.status).toBe("SUCCESS_WITH_FILES");
    expect(r.codeSource).toBe("snapshot");
    expect(r.filesExamined).toEqual(["src/orb-core/llm/provider.server.ts"]);
    expect(r.evidence.some((e) => e.file === "src/orb-core/llm/provider.server.ts")).toBe(true);
    expect(r.findings.some((f) => f.code === "CODE_TOOL_PROTOCOL_PRESENT")).toBe(true);
    expect(r.findings.some((f) => f.code === "CODE_NO_TOOL_PROTOCOL")).toBe(false);
    expect(r.codeChanged || r.patchApplied || r.deployed || r.secretsAccessed).toBe(false);
  });

  it("Secrets/ausgeschlossene Pfade bleiben unerreichbar", async () => {
    const snap = await loadCodeSnapshot();
    __setCodeSourceForTests(createSnapshotSource(snap!.files));
    expect((await readCodeFile(".env")).ok).toBe(false);
    expect((await readCodeFile("node_modules/vite/package.json")).ok).toBe(false);
    expect((await readCodeFile("src/data/land-10m.json")).ok).toBe(false);
  });

  it("keine Schreibfunktion im Lesepfad", () => {
    for (const f of ["src/orb-core/toolbox/code-read.server.ts", "src/orb-core/toolbox/code-snapshot.server.ts", "vite-plugins/orb-code-snapshot.ts"])
      expect(readFileSync(f, "utf8")).not.toMatch(/\b(writeFile|writeFileSync|mkdir|unlink|appendFile|rmSync)\s*\(/);
  });
});

describe("P25 – ehrliche Zustände", () => {
  it("absichtlich keine Projektdateien ⇒ CODE_ACCESS_UNAVAILABLE, keine Befunde", async () => {
    __setCodeSourceForTests("none");
    const r = await runCodeAnalysis(db, "admin-1", req({ target: "src/orb-core/llm" }));
    expect(r.status).toBe("CODE_ACCESS_UNAVAILABLE");
    expect(r.filesExamined).toEqual([]);
    expect(r.findings.some((f) => f.code === "CODE_NO_TOOL_PROTOCOL")).toBe(false);
    expect(r.proposedChange).toEqual([]);
  });

  it("Zugang vorhanden, Ziel leer ⇒ NO_FILES_FOUND statt Erfolg", async () => {
    const r = await runCodeAnalysis(db, "admin-1", req({ target: "src/gibt-es-nicht-xyz" }));
    expect(r.status).toBe("NO_FILES_FOUND");
    expect(r.findings.some((f) => f.code === "CODE_NO_TOOL_PROTOCOL")).toBe(false);
    expect(r.proposedChange).toEqual([]);
  });

  it("ohne Adminrolle ⇒ ACCESS_DENIED", async () => {
    const noAdmin = { rpc: async () => ({ data: false, error: null }) } as never;
    expect((await runCodeAnalysis(noAdmin, "u", req())).status).toBe("ACCESS_DENIED");
  });
});
