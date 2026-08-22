/**
 * Service-Worker-Registrierung mit strengen Schutzregeln:
 * Registrierung ausschließlich auf den Produktions-Hosts von Y-Dude
 * (Allowlist). In Dev, im iframe und auf allen Vorschau-Hosts wird nicht
 * registriert – dort werden vorhandene Registrierungen zusätzlich entfernt,
 * damit kein alter Cache die Vorschau blockiert.
 */
const SW_URL = "/sw.js";
const PRODUCTION_HOSTS = ["y-dude.com", "www.y-dude.com"];

function isBlockedContext(): boolean {
  if (!import.meta.env.PROD) return true;
  if (typeof window === "undefined") return true;
  if (window.self !== window.top) return true;

  const host = window.location.hostname;
  const isProductionHost =
    PRODUCTION_HOSTS.includes(host) || host.endsWith(".y-dude.com");
  if (!isProductionHost) return true;
  if (new URLSearchParams(window.location.search).has("sw")) {
    return new URLSearchParams(window.location.search).get("sw") === "off";
  }
  return false;
}

async function unregisterAppServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    regs
      .filter((r) => (r.active?.scriptURL ?? r.installing?.scriptURL ?? "").includes(SW_URL))
      .map((r) => r.unregister()),
  );
}

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  // Das Inline-Snippet im HTML-Head hat den Worker bereits registriert.
  if ((window as unknown as { __ydudeSwRegistered?: boolean }).__ydudeSwRegistered) return;
  if (isBlockedContext()) {
    void unregisterAppServiceWorkers();
    return;
  }
  void navigator.serviceWorker.register(SW_URL, { scope: "/" }).catch(() => {
    /* Registrierung ist optional – Fehler dürfen die App nie blockieren */
  });
}
