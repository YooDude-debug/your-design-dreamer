import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, openBrowser } from "@remotion/renderer";
import path from "path"; import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bundled = await bundle({ entryPoint: path.resolve(__dirname, "../src/index.ts"), webpackOverride: (c)=>c });
const browser = await openBrowser("chrome", { browserExecutable: "/bin/chromium", chromiumOptions:{args:["--no-sandbox","--disable-gpu","--disable-dev-shm-usage"]}, chromeMode:"chrome-for-testing" });
const composition = await selectComposition({ serveUrl: bundled, id: "product-tour-60", puppeteerInstance: browser });
await renderMedia({ composition, serveUrl: bundled, codec: "h264", crf: 18,
  outputLocation: "/mnt/documents/y-dude-produkt-demo-60s.mp4", puppeteerInstance: browser,
  muted: true, concurrency: 2, delayRenderTimeoutInMilliseconds: 60000 });
await browser.close({ silent: false });
console.log("done");
