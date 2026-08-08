/*
 * Y-Dude Push-Worker.
 *
 * Reiner Nachrichten-Worker: kein Caching, keine App-Shell, kein Offline-Modus.
 * Zustaendig ausschliesslich fuer Web-Push-Nachrichten und das Oeffnen des
 * passenden Ziels beim Antippen einer Benachrichtigung.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Y-Dude", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Y-Dude";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icon-192.png",
    badge: "/icon-192.png",
    // Gleiche Benachrichtigung ersetzt sich selbst -> keine Doppelungen.
    tag: payload.tag || payload.id || title,
    renotify: false,
    data: { link: payload.link || "/dev", id: payload.id || null },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/dev";
  const target = new URL(link, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(target);
            } catch {
              /* Navigation ist optional */
            }
          }
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});

// Browser kann das Abonnement erneuern: neues Abo an die App melden.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) client.postMessage({ type: "push-subscription-change" });
    })(),
  );
});
