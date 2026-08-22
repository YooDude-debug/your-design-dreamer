// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import path from "node:path";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Load all env vars (no prefix) into process.env for server-side code only.
// Never expose these to the client bundle.
const serverEnv = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "");
Object.assign(process.env, serverEnv);

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null,
        filename: "sw.js",
        devOptions: { enabled: false },
        outDir: "dist/client",
        manifest: {
          id: "y-dude-pwa",
          name: "Y-Dude — Speak Local. Connect Global.",
          short_name: "Y-Dude",
          description:
            "Y-Dude: Entdecke Slang, fühl den Vibe. Kurze Audio-SlangTags verbinden lokale Stimmen mit der Welt.",
          lang: "de",
          start_url: "/",
          scope: "/",
          display: "standalone",
          display_override: ["standalone", "window-controls-overlay"],
          orientation: "portrait",
          theme_color: "#000000",
          background_color: "#000000",
          categories: ["social", "entertainment"],

          // Andere Apps -> Y-Dude: systemweites Teilen-Ziel (Android/Chromium).
          // POST deckt Text, Titel, URL und Bilddateien in einem Ziel ab.
          share_target: {
            action: "/share-target",
            method: "POST",
            enctype: "multipart/form-data",
            params: {
              title: "title",
              text: "text",
              url: "url",
              files: [
                {
                  name: "files",
                  accept: ["image/png", "image/jpeg", "image/webp", "image/gif", "image/*"],
                },
              ],
            },
          },

          icons: [
            { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/maskable-icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],

          screenshots: [
            {
              src: "/screenshots/feed-slangtag.jpg",
              sizes: "660x1348",
              type: "image/jpeg",
              form_factor: "narrow",
              label: "Y-Dude Feed mit SlangTags",
            },
            {
              src: "/screenshots/post-slangtag.jpg",
              sizes: "660x1348",
              type: "image/jpeg",
              form_factor: "narrow",
              label: "Y-Dude Beitrag mit SlangTag",
            },
            {
              src: "/screenshots/feed-ads.jpg",
              sizes: "660x1348",
              type: "image/jpeg",
              form_factor: "narrow",
              label: "Y-Dude Feed mit personalisierter Werbung",
            },
            {
              src: "/screenshots/feed-wide.jpg",
              sizes: "1280x720",
              type: "image/jpeg",
              form_factor: "wide",
              label: "Y-Dude Feed – Desktop-Ansicht",
            },
            {
              src: "/screenshots/globe-wide.jpg",
              sizes: "1280x720",
              type: "image/jpeg",
              form_factor: "wide",
              label: "Y-Dude Slang Globe – Desktop-Ansicht",
            },
          ],

          shortcuts: [
            {
              name: "Slang Globe",
              short_name: "Globe",
              description: "Interaktive 3D-Weltkugel mit Slang-Heatmap",
              url: "/globe",
              icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
            },
            {
              name: "Slang Arena",
              short_name: "Arena",
              description: "Community-Voting und SlangTag-Challenges",
              url: "/arena",
              icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
            },
            {
              name: "Nachrichten",
              short_name: "Chats",
              description: "Messenger und private Unterhaltungen",
              url: "/dev",
              icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
            },
            {
              name: "SlangTag erstellen",
              short_name: "SlangTag",
              description: "Eigene SlangTags verwalten und erstellen",
              url: "/arena?tab=mine",
              icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,svg,png,woff2}"],
          globIgnores: ["**/node_modules/**", "**/icon-512.png", "**/favicon.png"],
          navigateFallback: null,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              // HTML wird serverseitig gerendert und verweist auf gehashte
              // Build-Assets. Zwischengespeicherte Seiten aus einem alten Deploy
              // zeigen auf gelöschte Chunks -> Bootstrap-Fehler. Darum niemals
              // Navigationen cachen.
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkOnly",
            },
            {
              urlPattern: ({ url, request }) =>
                url.origin === self.location.origin &&
                url.pathname.startsWith("/assets/") &&
                (request.destination === "script" || request.destination === "style"),
              handler: "CacheFirst",
              options: {
                cacheName: "ydude-assets",
                expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              urlPattern: ({ request }) => request.destination === "image",
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "ydude-images",
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 14 },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        "entities/lib/decode.js": path.resolve(
          import.meta.dirname,
          "node_modules/entities/lib/decode.js",
        ),
        "entities/lib/encode.js": path.resolve(
          import.meta.dirname,
          "node_modules/entities/lib/encode.js",
        ),
        entities: path.resolve(import.meta.dirname, "node_modules/entities"),
      },
    },
  },
});
