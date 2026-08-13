import { createFileRoute } from "@tanstack/react-router";

/**
 * Browser fragen `/favicon.ico` automatisch bei jedem Seitenaufruf ab, auch
 * wenn im <head> ausschliesslich `/favicon.png` deklariert ist. Ohne eigene
 * Behandlung antwortet der SSR-Fallback mit einer HTML-Seite unter dem
 * Dateinamen `favicon.ico` – diese Typ-Verwechslung (HTML als .ico) fuehrt in
 * Chromium dazu, dass die Antwort als Datei behandelt und im Downloads-Ordner
 * abgelegt wird ("favicon (84).ico" usw.).
 *
 * Deshalb wird hier dauerhaft auf das einzige Favicon (`/favicon.png`)
 * verwiesen. Es gibt damit genau eine Icon-Quelle: PNG-Favicon im Tab,
 * apple-touch-icon fuer iOS und die Manifest-Icons fuer PWA/Android.
 */
export const Route = createFileRoute("/favicon.ico")({
  server: {
    handlers: {
      GET: () =>
        new Response(null, {
          status: 301,
          headers: {
            Location: "/favicon.png",
            "Cache-Control": "public, max-age=86400",
          },
        }),
    },
  },
});
