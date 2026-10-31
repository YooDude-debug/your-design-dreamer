import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ADMIN_USER_SEARCH_MAX,
  buildAdminUserSearchFilter,
  normalizeAdminSearch,
} from "@/lib/admin-user-search";

/** Splits a PostgREST or() list at top-level commas (outside double quotes). */
function topLevelConditions(filter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < filter.length; i++) {
    const c = filter[i];
    if (inQ && c === "\\") {
      cur += c + filter[++i];
      continue;
    }
    if (c === '"') inQ = !inQ;
    if (c === "," && !inQ) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

describe("SEC-02 admin user search filter", () => {
  it("normal name search keeps matching by username and display name", () => {
    expect(buildAdminUserSearchFilter("Dora")).toBe(
      'username.ilike."%Dora%",display_name.ilike."%Dora%"',
    );
  });

  it("e-mail style search stays a single literal value", () => {
    const f = buildAdminUserSearchFilter("mario.j@y-dude.com")!;
    expect(topLevelConditions(f)).toHaveLength(2);
    expect(f).toContain('"%mario.j@y-dude.com%"');
  });

  it("empty or whitespace search adds no filter", () => {
    expect(buildAdminUserSearchFilter("")).toBeNull();
    expect(buildAdminUserSearchFilter("   ")).toBeNull();
  });

  it("regular special characters are kept, LIKE wildcards are literal", () => {
    expect(buildAdminUserSearchFilter("O'Neil-Müller")).toContain('"%O\'Neil-Müller%"');
    expect(buildAdminUserSearchFilter("50%_off")).toContain('"%50\\\\%\\\\_off%"');
  });

  it("manipulation attempt a,id.neq.0 cannot add conditions", () => {
    const f = buildAdminUserSearchFilter("a,id.neq.0")!;
    const conds = topLevelConditions(f);
    expect(conds).toEqual(['username.ilike."%a,id.neq.0%"', 'display_name.ilike."%a,id.neq.0%"']);
  });

  it("commas, parentheses, dots and quotes stay inside the quoted value", () => {
    const f = buildAdminUserSearchFilter('x),and(id.not.is.null,"y')!;
    const conds = topLevelConditions(f);
    expect(conds).toHaveLength(2);
    for (const c of conds) expect(c).toMatch(/^(username|display_name)\.ilike\."%.*%"$/);
    expect(f).toContain('\\"y');
  });

  it("very long input is capped", () => {
    expect(normalizeAdminSearch("a".repeat(5000))).toHaveLength(ADMIN_USER_SEARCH_MAX);
  });

  it("invalid input types and control characters are handled safely", () => {
    expect(buildAdminUserSearchFilter(undefined)).toBeNull();
    expect(buildAdminUserSearchFilter({ or: "id.neq.0" })).toBeNull();
    expect(normalizeAdminSearch("ab\u0000c\n")).toBe("abc");
  });

  it("only two ilike conditions on the intended columns are ever produced", () => {
    for (const q of ["zzqq,id.not.is.null,username.ilike.zz", "a\\", "*", "%"]) {
      const conds = topLevelConditions(buildAdminUserSearchFilter(q)!);
      expect(conds.map((c) => c.split(".")[0])).toEqual(["username", "display_name"]);
    }
  });

  it("admin user search still requires the admin role before loading users", () => {
    const src = readFileSync("src/lib/admin.functions.ts", "utf8");
    const block = src.slice(src.indexOf("export const adminGetUsers"));
    const handler = block.slice(0, block.indexOf("export const", 10));
    expect(handler).toMatch(/requireSupabaseAuth/);
    expect(handler.indexOf("await assertAdmin(context)")).toBeGreaterThan(-1);
    expect(handler.indexOf("await assertAdmin(context)")).toBeLessThan(handler.indexOf("loadUsers("));
  });
});
