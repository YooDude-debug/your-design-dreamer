import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../public/audio");
fs.mkdirSync(outDir, { recursive: true });
const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "openai/gpt-4o-mini-tts",
    input: "Fernweh.",
    voice: "alloy",
    instructions:
      "Speak one single German word clearly and naturally, like a quick voice note: relaxed, warm, slightly wistful. Native German pronunciation. Not advertising, not robotic.",
    speed: 0.95,
    response_format: "mp3",
    stream_format: "audio",
  }),
});
if (!res.ok) {
  console.error("FAIL", res.status, await res.text().catch(() => ""));
  process.exit(1);
}
const buf = Buffer.from(await res.arrayBuffer());
fs.writeFileSync(path.join(outDir, "de-fernweh.mp3"), buf);
console.log("ok", buf.length);
