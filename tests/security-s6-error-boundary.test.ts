import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { z } from "zod";
import {
  OrbInternalError,
  SAFE_SERVER_ERROR,
  internalError,
  shouldMaskServerError,
} from "@/lib/internal-error";

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
  it("9 Fachliche Fehlermeldungen bleiben unverändert", () => {
    expect(shouldMaskServerError(new Error("Rollout blockiert"))).toBe(false);
  });
  it("Framework-Steuerobjekte werden nicht maskiert", () => {
    expect(shouldMaskServerError(new Response(null, { status: 307 }))).toBe(false);
    expect(shouldMaskServerError({ isNotFound: true })).toBe(false);
  });
  it("Grenze ist als globale Function-Middleware registriert", () => {
    const src = readFileSync("src/start.ts", "utf8");
    expect(src).toMatch(/functionMiddleware:\s*\[safeServerFnErrors,/);
  });
});
