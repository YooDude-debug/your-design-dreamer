/**
 * Background-Sync-Erweiterung für den bestehenden Y-Dude Service Worker.
 *
 * Wird per importScripts in sw.js geladen und verändert weder Caches,
 * Cache-Versionierung, Legacy-Cleanup noch den separaten Push-Worker.
 *
 * Aufgabe: nach einem kurzen Verbindungsabbruch die offenen Tabs anstoßen,
 * damit sie ihre ausstehenden (wiederholbaren) Aktionen erneut senden.
 * Es werden hier bewusst KEINE Nutzdaten gespeichert oder gesendet.
 */
/* global self, clients */
const YDUDE_OUTBOX_TAG = "ydude-outbox";

async function notifyClientsToFlushOutbox() {
  const windowClients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  for (const client of windowClients) {
    client.postMessage({ type: "ydude-outbox-flush" });
  }
}

self.addEventListener("sync", (event) => {
  if (event.tag !== YDUDE_OUTBOX_TAG) return;
  event.waitUntil(notifyClientsToFlushOutbox());
});
