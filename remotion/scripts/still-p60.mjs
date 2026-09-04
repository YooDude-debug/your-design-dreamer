import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition, openBrowser } from "@remotion/renderer";
import path from "path"; import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bundled = await bundle({ entryPoint: path.resolve(__dirname, "../src/index.ts"), webpackOverride: (c)=>c });
const browser = await openBrowser("chrome", { browserExecutable: "/bin/chromium", chromiumOptions:{args:["--no-sandbox","--disable-gpu","--disable-dev-shm-usage"]}, chromeMode:"chrome-for-testing" });
const composition = await selectComposition({ serveUrl: bundled, id: "product-tour-60", puppeteerInstance: browser });
for (const f of process.argv.slice(2).map(Number)) {
  await renderStill({ composition, serveUrl: bundled, output: `/tmp/p60-${f}.png`, frame: f, puppeteerInstance: browser, overwrite: true });
  console.log("ok", f);
}
await browser.close({ silent: false });
