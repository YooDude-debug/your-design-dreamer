import { it } from "vitest";
import { processInput } from "@/orb-core/engine.server";
import { normKey } from "@/orb-core/memory";
import { createFakeDb, type FakeCall, type FakeResponse } from "./helpers/fake-supabase";

const USER = "11111111-1111-4111-8111-111111111111";
const NOW = new Date().toISOString();
const state = { id:"s", user_id:USER, curiosity:0.7, joy:0.5, fear:0.05, trust:0.5, uncertainty:0.3, energy:0.95, cracks:0, reactivation_count:0, goals:["help_user"], created_at:NOW, updated_at:NOW };
const node = (o:Record<string,unknown>={}) => ({ id:"n1", user_id:USER, type:"memory", content:"Mein Hund heisst Rex.", importance:0.6, confidence:0.7, source:"user_stated", topic:"leben", norm_key:"hund rex", activation_count:3, last_accessed_at:NOW, created_at:NOW, metadata:{}, ...o });
function mk(nodes:Record<string,unknown>[]) {
  return createFakeDb((c:FakeCall):FakeResponse => {
    if (c.table === "orb_state") return { data: state };
    if (c.table === "orb_nodes") {
      if (c.action === "insert") return { data: { id: "n-new" } };
      if (c.action === "select") return { data: c.single ? (nodes[0] ?? null) : nodes };
      return { data: null };
    }
    if (c.table === "orb_style") return { data: null };
    if (c.action === "select") return { data: c.single ? null : [] };
    return { data: c.single ? { id: `${c.table}-x` } : null };
  });
}
function dump(label:string, calls:FakeCall[]) {
  console.log(`\n### ${label} (${calls.length} DB-Aufrufe)`);
  const agg = new Map<string,number>();
  calls.forEach((c,i) => {
    console.log(`${String(i+1).padStart(2)} ${c.table} ${c.action}${c.single?" single":""}`);
    const k = `${c.table}|${c.action}`; agg.set(k,(agg.get(k)??0)+1);
  });
  console.log("SUMME " + [...agg.entries()].map(([k,v])=>`${k}=${v}`).join(" "));
}
it("TRACE A/B/C", async () => {
  const a = mk([]); await processInput(a, USER, "Hallo, wie läuft dein Tag?"); dump("TRACE A – normale Nachricht ohne Treffer", a.calls);
  const b = mk([node()]); await processInput(b, USER, "Mein Hund heisst Rex."); dump("TRACE B – Nachricht mit Erinnerungstreffer", b.calls);
  const c = mk([node()]); await processInput(c, USER, "Frag mich was."); dump("TRACE C – Aufforderung zur eigenen Frage", c.calls);
}, 60000);
