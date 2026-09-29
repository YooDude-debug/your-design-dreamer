import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { z } from "zod";
import {
  OrbInternalError,
  SAFE_SERVER_ERROR,
  internalError,
  shouldMaskServerError,
} from "@/orb-core/internal-error";
import { CodeAccessError } from "@/orb-dev/code-access.server";

const pgError = {
  message: 'new row violates row-level security policy for table "orb_connections"',
  code: "42501",
  details: null,
  hint: null,
};

describe("S6 – sichere Fehlergrenze", () => {
  it("1 Zod-Fehler bleibt unverändert", () => {
    const r = z.object({ a: z.string() }).safeParse({ a: 1 });
    expect(r.success).toBe(false);
    expect(shouldMaskServerError(!r.success && r.error)).toBe(false);
  });
  it("2/3 Unauthorized und Forbidden bleiben unverändert", () => {
    expect(shouldMaskServerError(new Error("Unauthorized: No token provided"))).toBe(false);
    expect(shouldMaskServerError(new Error("Forbidden"))).toBe(false);
  });
  it("4/5 DB- und RLS-Fehler werden maskiert", () => {
    const e = internalError(pgError);
    expect(e).toBeInstanceOf(OrbInternalError);
    expect(shouldMaskServerError(e)).toBe(true);
    expect(shouldMaskServerError(pgError)).toBe(true);
    expect(SAFE_SERVER_ERROR).toBe("Interner Serverfehler");
  });
  it("6 TypeError wird maskiert", () => {
    expect(shouldMaskServerError(new TypeError("x is undefined"))).toBe(true);
  });
  it("7 Originalfehler bleibt intern erhalten (message + cause)", () => {
    const e = internalError(pgError, "Audit-Eintrag fehlgeschlagen");
    expect(e.message).toContain("row-level security");
    expect(e.message.startsWith("Audit-Eintrag fehlgeschlagen: ")).toBe(true);
    expect(e.cause).toBe(pgError);
  });
  it("9 ORB-Dev-Meldungen bleiben unverändert", () => {
    expect(shouldMaskServerError(new Error("Rollout blockiert"))).toBe(false);
  });
  it("10 CodeAccessError bleibt unverändert", () => {
    expect(shouldMaskServerError(new CodeAccessError("Pfad nicht freigegeben: x"))).toBe(false);
  });
  it("Framework-Steuerobjekte werden nicht maskiert", () => {
    expect(shouldMaskServerError(new Response(null, { status: 307 }))).toBe(false);
    expect(shouldMaskServerError({ isNotFound: true })).toBe(false);
  });
  it("Grenze ist als globale Function-Middleware registriert", () => {
    const src = readFileSync("src/start.ts", "utf8");
    expect(src).toMatch(/functionMiddleware:\s*\[safeServerFnErrors,/);
  });
  it("8 keine direkte DB-error.message-Weitergabe in ORB-Pfaden", () => {
    let out = "";
    try {
      out = execSync(
        `rg -n "throw new Error\\([^)]*error\\??\\.message" src/orb-core src/orb-dev src/orb-sdk src/integrations/y-dude-orb src/lib/orb-knowledge-graph.functions.ts src/lib/orb-dev.functions.ts src/lib/orb-toolbox.functions.ts src/lib/orb-chat-bridge.functions.ts`,
        { encoding: "utf8" },
      );
    } catch {
      out = "";
    }
    expect(out).toBe("");
  });
});
