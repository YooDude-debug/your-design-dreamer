import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition, openBrowser } from "@remotion/renderer";
import path from "path"; import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bundled = await bundle({ entryPoint: path.resolve(__dirname, "../src/index.ts"), webpackOverride: (c) => c });
const browser = await openBrowser("chrome", { browserExecutable: "/bin/chromium", chromiumOptions: { args: ["--no-sandbox","--disable-gpu","--disable-dev-shm-usage"] }, chromeMode: "chrome-for-testing" });
const composition = await selectComposition({ serveUrl: bundled, id: "bavaria", puppeteerInstance: browser });
for (const f of [50, 140, 170, 250, 330]) {
  await renderStill({ composition, serveUrl: bundled, frame: f, output: `/tmp/bav-${f}.png`, puppeteerInstance: browser });
}
await browser.close({ silent: false }); console.log("stills ok");
