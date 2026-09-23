/**
 * TEMPORÄR – einmalige, rein lesende Architektur-Selbstanalyse.
 * Kein Produktionscode, keine Datenänderung, keine Modellaufrufe.
 * Wird nach dem Lauf wieder entfernt.
 */

import { createOrbCore } from "@/orb-sdk/orb-core.server";

/** Attrappe: erlaubt die Rollenprüfung, liefert leere Leseergebnisse. */
function stubDb(isAdmin: boolean) {
  const query: Record<string, unknown> = {};
  const chain = new Proxy(query, {
    get(_t, prop) {
      if (prop === "then")
        return (res: (v: unknown) => void) => res({ data: [], error: null, count: 0 });
      return () => chain;
    },
  });
  return {
    rpc: async (fn: string) => ({ data: fn === "has_role" ? isAdmin : null, error: null }),
    from: () => chain,
  } as never;
}

async function main() {
  const core = createOrbCore({ data: stubDb(true), userId: "00000000-0000-0000-0000-000000000001" });

  const access = await core.discoverAnalysisAccess();
  const caps = await core.listAnalysisCapabilities();
  console.log("ACCESS", JSON.stringify(access, null, 2));
  console.log("CAPABILITIES", JSON.stringify(caps, null, 2));

  for (const type of access.analysis) {
    const t0 = Date.now();
    const result = await core.requestAnalysis({ analysisType: type });
    console.log(
      `\n--- ${type} · ${result.status} · ${Date.now() - t0} ms · modelCalls=${result.modelCalls} ` +
        `codeChanged=${result.codeChanged} dbChanged=${result.dbChanged} ` +
        `proposalCreated=${result.proposalCreated} deployed=${result.deployed}`,
    );
    console.log(JSON.stringify(result, null, 2));
  }

  const denied = createOrbCore({
    data: stubDb(false),
    userId: "00000000-0000-0000-0000-000000000002",
  });
  const rejected = await denied.requestAnalysis({ analysisType: "memory_recall" });
  console.log("\nDENIED", rejected.status, JSON.stringify(rejected.findings ?? []));
}

void main();
