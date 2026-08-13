import { createFileRoute } from "@tanstack/react-router";

import { SHARE_TARGET_KEY, SHARE_TARGET_MAX_BYTES, type SharedContent } from "@/lib/share-target";

/**
 * Web Share Target: andere Apps teilen Inhalte nach Y-Dude.
 *
 * Der Endpunkt speichert die empfangenen Daten kurz im Browser und leitet
 * anschliessend in den bestehenden Feed mit dem vorhandenen Composer weiter.
 * Es werden keine Inhalte serverseitig gespeichert.
 */
const ALLOWED_IMAGE = /^image\/(png|jpeg|jpg|webp|gif)$/i;

function redirectPage(shared: SharedContent) {
  const payload = JSON.stringify(JSON.stringify(shared)).replace(/</g, "\\u003c");
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Y-Dude</title><style>body{margin:0;background:#000;color:#fff;font-family:system-ui,sans-serif;display:grid;place-items:center;height:100vh}</style>
</head><body><p>Y-Dude wird geöffnet…</p><script>
try { sessionStorage.setItem(${JSON.stringify(SHARE_TARGET_KEY)}, ${payload}); } catch (e) {}
location.replace("/dev");
</script></body></html>`;
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

async function readShared(request: Request): Promise<SharedContent> {
  const shared: SharedContent = {};

  if (request.method === "GET") {
    const url = new URL(request.url);
    shared.title = url.searchParams.get("title") ?? undefined;
    shared.text = url.searchParams.get("text") ?? undefined;
    shared.url = url.searchParams.get("url") ?? undefined;
    return shared;
  }

  const form = await request.formData();
  const title = form.get("title");
  const text = form.get("text");
  const link = form.get("url");
  if (typeof title === "string") shared.title = title;
  if (typeof text === "string") shared.text = text;
  if (typeof link === "string") shared.url = link;

  const files = form.getAll("files").filter((entry): entry is File => entry instanceof File);
  const image = files.find((file) => ALLOWED_IMAGE.test(file.type));

  if (!image && files.length > 0) {
    shared.notice = "unsupported-type";
    return shared;
  }
  if (image) {
    if (image.size > SHARE_TARGET_MAX_BYTES) {
      shared.notice = "too-large";
      return shared;
    }
    const bytes = new Uint8Array(await image.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
    shared.image = `data:${image.type};base64,${btoa(binary)}`;
  }
  return shared;
}

export const Route = createFileRoute("/share-target")({
  server: {
    handlers: {
      GET: async ({ request }) => redirectPage(await readShared(request)),
      POST: async ({ request }) => {
        try {
          return redirectPage(await readShared(request));
        } catch (error) {
          console.error("[share-target] failed", error);
          return redirectPage({ notice: "unsupported-type" });
        }
      },
    },
  },
});
