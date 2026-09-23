import { it, vi } from "vitest";
import { processInput } from "@/orb-core/engine.server";
import { speakViaLovableGateway } from "@/orb-core/llm/provider.server";
import { createFakeDb, type FakeCall, type FakeResponse } from "./helpers/fake-supabase";
const USER="11111111-1111-4111-8111-111111111111"; const NOW=new Date().toISOString();
const state={id:"s",user_id:USER,curiosity:0.7,joy:0.5,fear:0.05,trust:0.5,uncertainty:0.3,energy:0.95,cracks:0,reactivation_count:0,goals:["help_user"],created_at:NOW,updated_at:NOW};
const db=()=>createFakeDb((c:FakeCall):FakeResponse=>{
  if(c.table==="orb_state") return {data:state};
  if(c.table==="orb_nodes"){ if(c.action==="insert") return {data:{id:"n-new"}}; if(c.action==="select") return {data:c.single?null:[]}; return {data:null}; }
  if(c.action==="select") return {data:c.single?null:[]};
  return {data:c.single?{id:`${c.table}-x`}:null};
});
it("P3 Vergleichstest", async () => {
  const rows:Record<string,unknown>[]=[]; const evts:Record<string,unknown>[]=[];
  const spy=vi.spyOn(console,"info").mockImplementation((t:unknown,p?:unknown)=>{
    if(typeof t==="string"&&typeof p==="string"){
      if(t==="[orb.obs.model_call]") rows.push(JSON.parse(p));
      if(t==="[orb.obs.event]") evts.push(JSON.parse(p));
    }
  });
  // Netzwerk-Attrappe VOR allen Aufrufen: kein einziger echter Modellaufruf.
  process.env["LOVABLE_API_KEY"]="test-key";
  vi.stubGlobal("fetch", async () => new Response(
    `data: ${JSON.stringify({type:"response.output_text.delta",delta:"ok"})}\n\n`,
    { status: 200, headers: new Headers({ "X-Lovable-AIG-Run-ID": "run-demo" }) }));
  // 5 echte User-Nachrichten – Sprachschicht ohne Schlüssel (0 Modellaufrufe, 0 Kosten)
  for (const t of ["Erste Nachricht.","Zweite Nachricht.","Dritte Nachricht.","Vierte Nachricht.","Fünfte Nachricht."]) await processInput(db(), USER, t);
  // 5 synthetische technische Testevents mit Netzwerk-Attrappe (kein echter Aufruf)
  const { newEventContext } = await import("@/orb-core/observability.server");
  for (let i=0;i<5;i++){ const ctx=newEventContext({path:"turn_reply",callType:"user_visible"}); await speakViaLovableGateway("sys","x",ctx); }
  await speakViaLovableGateway("sys","x"); // Aufruf ohne ORB-Ereignis
  spy.mockRestore(); vi.unstubAllGlobals(); delete process.env["LOVABLE_API_KEY"];
  console.log("\n| Event | Model Request ID | Model | Source | Path | Call Type | Success | ms |");
  console.log("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const r of rows) console.log(`| ${String(r["event_id"]).slice(0,12)}… | ${String(r["model_request_id"]).slice(0,12)}… | ${r["model"]} | ${r["source"]} | ${r["path"]} | ${r["call_type"]} | ${r["success"]} | ${r["duration_ms"]} |`);
  console.log("\n| Event | Path | Model Calls | DB Queries |");
  console.log("| --- | --- | --- | --- |");
  for (const e of evts) console.log(`| ${String(e["event_id"]).slice(0,12)}… | ${e["path"]} | ${e["model_calls"]} | ${e["db_queries"]} |`);
}, 60000);
