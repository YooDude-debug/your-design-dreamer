// Erzeugt die SlangTag-Sprachsounds (Lovable AI TTS) nach remotion/public/audio.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../public/audio");
fs.mkdirSync(outDir, { recursive: true });

const CASUAL =
  "Speak in casual, spontaneous everyday German. Sound like a real person recording a quick voice note on their phone – relaxed, cheeky, a bit amused. Absolutely not like an advertisement, not polished, not robotic. Slightly clipped, natural street tone.";

const VOICES = [
  { file: "berlin-kickste.mp3", input: "Ey, wat kickste so?", voice: "ash", instructions: CASUAL + " Berlin/Brandenburg accent, teasing, eyebrow raised.", speed: 1.05 },
  { file: "berlin-reingeguckt.mp3", input: "Reingeguckt!", voice: "ash", instructions: CASUAL + " Berlin accent, triumphant punchline, laughing a little.", speed: 1.0 },
  { file: "hamburg-moin.mp3", input: "Moin! Allet knorke bei dir, wa?", voice: "alloy", instructions: CASUAL + " Northern German, dry and friendly, low key.", speed: 1.05 },
  { file: "bayern-oida.mp3", input: "Ja host du des g'sehn, Oida?", voice: "onyx", instructions: CASUAL + " Bavarian accent, warm, amused, bar-table tone.", speed: 1.0 },
];

for (const v of VOICES) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini-tts",
      input: v.input,
      voice: v.voice,
      instructions: v.instructions,
      speed: v.speed,
      response_format: "mp3",
      stream_format: "audio",
    }),
  });
  if (!res.ok) {
    console.error("FAIL", v.file, res.status, await res.text().catch(() => ""));
    process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(path.join(outDir, v.file), buf);
  console.log("ok", v.file, buf.length);
}
