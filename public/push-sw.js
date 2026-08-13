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
  const raw = (event.notification.data && event.notification.data.link) || "/dev";
  const link = String(raw).startsWith("/") ? String(raw) : "/dev";
  const target = new URL(link, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const own = windows.filter((c) => {
        try {
          return new URL(c.url).origin === self.location.origin;
        } catch {
          return false;
        }
      });

      if (own.length > 0) {
        // Bevorzugt das bereits sichtbare Fenster, sonst das erste eigene.
        const client = own.find((c) => c.visibilityState === "visible") || own[0];
        try {
          await client.focus();
        } catch {
          /* Fokus ist optional */
        }
        // Die App navigiert selbst (In-App-Routing, kein Reload, kein neuer Tab).
        try {
          client.postMessage({ type: "push-navigate", link });
        } catch {
          /* Fallback unten */
        }
        // Zusatzabsicherung, falls die App die Nachricht nicht verarbeiten kann.
        if ("navigate" in client) {
          try {
            const current = new URL(client.url);
            if (current.pathname + current.search !== link) {
              // Kurz warten, damit In-App-Routing Vorrang hat.
              await new Promise((r) => setTimeout(r, 400));
              const after = await self.clients.matchAll({
                type: "window",
                includeUncontrolled: true,
              });
              const same = after.find((c) => c.id === client.id);
              const stillElsewhere =
                same && new URL(same.url).pathname + new URL(same.url).search !== link;
              if (stillElsewhere) await same.navigate(target);
            }
          } catch {
            /* Navigation ist optional */
          }
        }
        return;
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
