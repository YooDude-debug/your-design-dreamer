import { createClient } from "@supabase/supabase-js";
const URL="https://lxhdvbtkulwgkvqpjsvt.supabase.co";
const KEY="sb_publishable_61o67IwX23ltL0HAtT-Lyw_OjVERkdv";
function mk(){return createClient(URL,KEY,{auth:{persistSession:false},global:{fetch:(i,init)=>{const h=new Headers(init?.headers);if(h.get("Authorization")===`Bearer ${KEY}`)h.delete("Authorization");h.set("apikey",KEY);return fetch(i,{...init,headers:h});}}});}
const a=mk(),b=mk();
const A=await a.auth.signInWithPassword({email:"lina_hh@testaccount.y-dude.com",password:"Yd!dp5YeaJaQvs5wf"});
const B=await b.auth.signInWithPassword({email:"deniz_b@testaccount.y-dude.com",password:"Yd!JUvNkUg5V2kHE8"});
console.log("signin",A.error?.message,B.error?.message,A.data.user?.id,B.data.user?.id);
const uidA=A.data.user!.id, uidB=B.data.user!.id;
const convId=crypto.randomUUID();
console.log("conv insert",(await a.from("conversations").insert({id:convId,kind:"direct",created_by:uidA})).error?.message);
console.log("mem self",(await a.from("conversation_members").insert({conversation_id:convId,user_id:uidA})).error?.message);
console.log("mem partner",(await a.from("conversation_members").insert({conversation_id:convId,user_id:uidB})).error?.message);
console.log("msg",(await a.from("messages").insert({conversation_id:convId,sender_id:uidA,kind:"text",body:"hallo test",slang_tag_ids:[],delivered_at:new Date().toISOString()})).error?.message);
const r=await b.from("messages").select("*").eq("conversation_id",convId);
console.log("B read",r.error?.message,r.data?.length);
const cm=await b.from("conversation_members").select("conversation_id,user_id,last_read_at");
console.log("B members",cm.error?.message,cm.data?.length);
const cv=await b.from("conversations").select("*").in("id",[convId]);
console.log("B convs",cv.error?.message,cv.data?.length);
console.log("B reply",(await b.from("messages").insert({conversation_id:convId,sender_id:uidB,kind:"text",body:"antwort",slang_tag_ids:[],delivered_at:new Date().toISOString()})).error?.message);
console.log("notify",(await a.from("notifications").insert({user_id:uidB,actor_id:uidA,type:"message",body:"x",entity_id:convId})).error?.message);
const pr=await a.from("profiles").select("id,username,display_name,bio,location_visibility,language,avatar_url,cover_url,verified,level,xp,created_at,updated_at,last_seen_at,is_test_bot");
console.log("profiles",pr.error?.message,pr.data?.length);
// realtime
const ch=b.channel("t").on("postgres_changes",{event:"INSERT",schema:"public",table:"messages"},(p)=>console.log("RT",(p.new as any).body));
await new Promise<void>(res=>ch.subscribe(s=>{console.log("rt status",s);if(s==="SUBSCRIBED"||s==="CHANNEL_ERROR")res();}));
await a.from("messages").insert({conversation_id:convId,sender_id:uidA,kind:"text",body:"realtime-check",slang_tag_ids:[]});
await new Promise(r=>setTimeout(r,3000));
// cleanup
await a.from("messages").delete().eq("conversation_id",convId);
process.exit(0);
