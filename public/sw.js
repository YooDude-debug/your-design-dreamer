/**
 * Abschalt-Worker (Kill Switch).
 *
 * Die PWA-/Workbox-Funktionalität wurde entfernt. Browser, die den alten
 * App-Service-Worker unter /sw.js noch registriert haben, erhalten diesen
 * Worker, räumen ausschließlich die eigenen Workbox-Caches auf und melden die
 * Registrierung ab. Der Push-Worker (/push-sw.js) bleibt unberührt.
 */
function isWorkboxCacheForThisRegistration(name) {
  const hasWorkboxBucket = /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-/.test(name);
  return hasWorkboxBucket && name.endsWith(self.registration.scope);
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        const workboxCacheNames = cacheNames.filter(isWorkboxCacheForThisRegistration);
        await Promise.allSettled(workboxCacheNames.map((name) => caches.delete(name)));
        await self.clients.claim();
        const windowClients = await self.clients.matchAll({ type: "window" });
        await Promise.allSettled(windowClients.map((client) => client.navigate(client.url)));
      } finally {
        await self.registration.unregister();
      }
    })(),
  ),
);
