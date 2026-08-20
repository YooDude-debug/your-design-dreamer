import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { translateMessageForViewer } from "@/lib/translate-message.server";

const CONV = "f1b5127f-796a-47e6-bc05-28be54855855";
const SENDER = "9ce1d1b0-7481-4cb0-aedf-5291dae67297";
const path = `${SENDER}/audio/translate-test-${Date.now()}.wav`;

// 1) Testsprachnachricht erzeugen (deutscher Slang-Satz)
const speech = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "openai/gpt-4o-mini-tts",
    voice: "alloy",
    input: "Alter, der Globe ist echt richtig fett geworden, das feiere ich.",
    response_format: "wav",
  }),
});
console.log("tts status", speech.status);
if (!speech.ok) {
  console.log(await speech.text());
  process.exit(1);
}
const bytes = new Uint8Array(await speech.arrayBuffer());
console.log("audio bytes", bytes.length);

const up = await supabaseAdmin.storage.from("media").upload(path, bytes, { contentType: "audio/wav" });
console.log("upload", up.error?.message ?? "ok");

const ins = await supabaseAdmin
  .from("messages")
  .insert({ conversation_id: CONV, sender_id: SENDER, kind: "audio", media_url: path, body: "" } as never)
  .select("id")
  .single();
console.log("insert", ins.error?.message ?? ins.data);
const id = (ins.data as { id: string } | null)?.id;
if (!id) process.exit(1);

for (const to of ["en", "el", "de"] as const) {
  const t0 = Date.now();
  console.log(to, `${Date.now() - t0}ms`, JSON.stringify(await translateMessageForViewer(supabaseAdmin, id, to)));
}
const t1 = Date.now();
console.log("cached en", `${Date.now() - t1}ms`, JSON.stringify(await translateMessageForViewer(supabaseAdmin, id, "en")));

// Aufräumen
await supabaseAdmin.from("messages").delete().eq("id", id);
await supabaseAdmin.storage.from("media").remove([path]);
console.log("cleaned up");
