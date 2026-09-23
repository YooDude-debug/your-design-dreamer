import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  CODE_TOOL_CAPABILITY,
  CODE_TOOL_DEFINITION,
  CODE_TOOL_MODEL_NAME,
  MAX_TOOL_ROUNDS,
  codeToolRequestId,
  isExplicitCodeAnalysisRequest,
  prepareCodeToolRuntime,
  runCodeToolLoop,
  type ToolModelStep,
} from "@/orb-core/llm/code-tool.server";

const EVENT = "orb_evt_1234abcd-5678-90ab-cdef-1234567890ab";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (admin: boolean | "throw"): any => ({
  rpc: async () => {
    if (admin === "throw") throw new Error("down");
    return { data: admin, error: null };
  },
});

describe("P22 Runtime-Wiring orb.code_analysis", () => {
  it("genau ein Werkzeug, gemappt auf orb.code_analysis", () => {
    expect(CODE_TOOL_CAPABILITY).toBe("orb.code_analysis");
    expect(CODE_TOOL_DEFINITION.name).toBe(CODE_TOOL_MODEL_NAME);
    expect(Object.keys(CODE_TOOL_DEFINITION.parameters.properties).sort()).toEqual([
      "question",
      "reason",
      "target",
    ]);
  });

  it("nur ausdrückliche Anforderungen", () => {
    expect(isExplicitCodeAnalysisRequest("Codeanalyse: Warum?")).toBe(true);
    expect(isExplicitCodeAnalysisRequest("/codeanalyse src")).toBe(true);
    expect(isExplicitCodeAnalysisRequest("Wie alt bin ich?")).toBe(false);
    expect(isExplicitCodeAnalysisRequest("Kannst du eine Codeanalyse machen?")).toBe(false);
  });

  it("INJECTED nur für Admin + ausdrückliche Anforderung", async () => {
    expect(await prepareCodeToolRuntime(db(true), "u", "Hallo", EVENT)).toBeNull();
    expect(await prepareCodeToolRuntime(db(false), "u", "Codeanalyse: x", EVENT)).toBeNull();
    expect(await prepareCodeToolRuntime(db("throw"), "u", "Codeanalyse: x", EVENT)).toBeNull();
    expect(await prepareCodeToolRuntime(db(true), "u", "Codeanalyse: x", EVENT)).not.toBeNull();
  });

  it("gleiche Ereigniskennung ⇒ gleiche Anforderungskennung (Idempotenz)", () => {
    expect(codeToolRequestId(EVENT, 0)).toBe(codeToolRequestId(EVENT, 0));
    expect(codeToolRequestId(EVENT, 0)).not.toBe(codeToolRequestId(EVENT, 1));
    expect(codeToolRequestId(EVENT, 0)).toMatch(/^orb_ca_[0-9a-f]{32}$/);
  });

  it("CALLABLE: Werkzeugaufruf liest echte Datei aus src/ über den P21-Zugang", async () => {
    const runtime = (await prepareCodeToolRuntime(db(true), "u", "Codeanalyse: x", EVENT))!;
    const outputs: string[] = [];
    let round = 0;
    const step: ToolModelStep = async ({ items }) => {
      round++;
      if (round === 1)
        return {
          text: "",
          calls: [
            {
              callId: "c1",
              name: CODE_TOOL_MODEL_NAME,
              arguments: JSON.stringify({
                target: "src/orb-core/llm/select.server.ts",
                question: "Werden Werkzeuge an das Modell übergeben?",
                reason: "P22 End-to-End Runtime-Wiring-Test",
              }),
            },
          ],
        };
      for (const i of items as { type?: string; output?: string }[])
        if (i.type === "function_call_output") outputs.push(i.output!);
      return { text: "Befund mit Code-Evidence.", calls: [] };
    };
    const done = await runCodeToolLoop({ userText: "Codeanalyse: x", runtime, step });
    expect(done?.reply).toBe("Befund mit Code-Evidence.");
    expect(done?.traces[0]?.status).toBe("SUCCESS_WITH_FILES");
    expect(done?.traces[0]?.filesExamined).toContain("src/orb-core/llm/select.server.ts");
    const parsed = JSON.parse(outputs[0]!);
    expect(parsed.readOnly).toBe(true);
    expect(parsed.patchApplied).toBe(false);
  });

  it("Lesebereich: .env und Pfade ausserhalb werden abgelehnt", async () => {
    const runtime = (await prepareCodeToolRuntime(db(true), "u", "Codeanalyse: x", EVENT))!;
    for (const target of [".env", "../etc/passwd", "supabase/config.toml"]) {
      const r = await runtime.execute(
        {
          callId: "c",
          name: CODE_TOOL_MODEL_NAME,
          arguments: JSON.stringify({ target, question: "lesen?", reason: "Scope-Grenztest P22" }),
        },
        7,
      );
      expect(r.trace.status).toBe("ACCESS_DENIED");
    }
  });

  it("unbekanntes Werkzeug / kaputte Argumente ⇒ isoliert abgelehnt", async () => {
    const runtime = (await prepareCodeToolRuntime(db(true), "u", "Codeanalyse: x", EVENT))!;
    expect(
      (await runtime.execute({ callId: "a", name: "write_file", arguments: "{}" }, 0)).trace.status,
    ).toBe("REJECTED");
    expect(
      (await runtime.execute({ callId: "b", name: CODE_TOOL_MODEL_NAME, arguments: "{" }, 1)).trace
        .status,
    ).toBe("REJECTED");
  });

  it("Rundenbegrenzung: nach MAX_TOOL_ROUNDS wird das Werkzeug entzogen", async () => {
    const runtime = (await prepareCodeToolRuntime(db(true), "u", "Codeanalyse: x", EVENT))!;
    const allowed: boolean[] = [];
    const step: ToolModelStep = async ({ toolsAllowed }) => {
      allowed.push(toolsAllowed);
      return {
        text: "ende",
        calls: [{ callId: `c${allowed.length}`, name: "x", arguments: "{}" }],
      };
    };
    const done = await runCodeToolLoop({ userText: "x", runtime, step });
    expect(allowed.length).toBe(MAX_TOOL_ROUNDS + 1);
    expect(allowed.at(-1)).toBe(false);
    expect(done?.reply).toBe("ende");
  });

  it("Modellausfall ⇒ null (bestehender Pfad übernimmt)", async () => {
    const runtime = (await prepareCodeToolRuntime(db(true), "u", "Codeanalyse: x", EVENT))!;
    expect(await runCodeToolLoop({ userText: "x", runtime, step: async () => null })).toBeNull();
  });

  it("Wiring nur im Nutzer-Antwortpfad, keine Schreib-APIs", () => {
    const engine = readFileSync("src/orb-core/engine.server.ts", "utf8");
    expect(engine.match(/prepareCodeToolRuntime/g)?.length).toBe(1);
    expect(engine).toContain('if (source === "user_stated")');
    const tool = readFileSync("src/orb-core/llm/code-tool.server.ts", "utf8");
    expect(tool).not.toMatch(/writeFile|unlink|rmdir|mkdir|process\.env/);
    expect(tool).not.toMatch(/max_tokens|maxOutputTokens/);
  });
});
