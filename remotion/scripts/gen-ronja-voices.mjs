// Erzeugt die vier Geburtstags-SlangTag-Stimmen (Lovable AI TTS).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../public/audio");
fs.mkdirSync(outDir, { recursive: true });

const CASUAL =
  "Sound like a real friend recording a quick, warm voice note on a phone for a birthday. Spontaneous, happy, slightly laughing, not polished, absolutely not like an advertisement or a robot.";

const VOICES = [
  { file: "ronja-de.mp3", input: "Alles Gute, Ronja!", voice: "ash", instructions: CASUAL + " Casual German, Berlin tone, cheerful.", speed: 1.0 },
  { file: "ronja-en.mp3", input: "Happy Birthday!", voice: "alloy", instructions: CASUAL + " European English speaker, bright and excited.", speed: 1.05 },
  { file: "ronja-us.mp3", input: "Alles Gute, Ronja!", voice: "onyx", instructions: CASUAL + " German spoken with a noticeable American English accent, amused, a bit clumsy but loving.", speed: 0.98 },
  { file: "ronja-jp.mp3", input: "ロンヤ、お誕生日おめでとう！", voice: "sage", instructions: CASUAL + " Natural Japanese, friendly and warm.", speed: 1.0 },
];

for (const v of VOICES) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`, "Content-Type": "application/json" },
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
  if (!res.ok) { console.error("FAIL", v.file, res.status, await res.text().catch(() => "")); process.exit(1); }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(path.join(outDir, v.file), buf);
  console.log("ok", v.file, buf.length);
}
