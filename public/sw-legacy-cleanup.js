/*
 * Einmalige Aufräumhilfe für den generierten Service Worker.
 *
 * Entfernt ausschließlich den nicht mehr verwendeten Bild-Runtime-Cache
 * "ydude-images" (cachete früher auch Nutzermedien). Andere Caches – etwa
 * Push-, SlangTag- oder App-Asset-Caches – werden nicht angefasst.
 */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const names = await caches.keys();
        await Promise.allSettled(
          names.filter((n) => n.startsWith("ydude-images")).map((n) => caches.delete(n)),
        );
      } catch {
        /* Aufräumen darf die Aktivierung nie blockieren */
      }
    })(),
  );
});
