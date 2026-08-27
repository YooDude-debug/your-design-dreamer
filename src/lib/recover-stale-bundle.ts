/**
 * Selbstheilung bei veraltetem Bundle-Cache.
 *
 * Ein Service Worker kann bei schlechter Verbindung eine alte, zwischen-
 * gespeicherte HTML-Seite ausliefern. Diese verweist auf gehashte JS/CSS-Dateien
 * eines früheren Deploys, die auf dem Server nicht mehr existieren. Der Import
 * schlägt fehl und die App zeigt nur noch die Fehlerseite.
 *
 * Hier werden solche Ladefehler erkannt, Caches und Service Worker einmalig
 * entfernt und die Seite frisch neu geladen. Der Marker in sessionStorage
 * verhindert Reload-Schleifen.
 */
const MARKER = "y-dude:bundle-recovery";

function looksLikeStaleBundleError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("failed to fetch dynamically imported module") ||
    m.includes("error loading dynamically imported module") ||
    m.includes("importing a module script failed") ||
    m.includes("unexpected token '<'") ||
    m.includes("chunkloaderror") ||
    (m.includes("module") && m.includes("mime type")) ||
    // Aufruf einer Server-Funktion aus einem alten Build: Der Server kennt die
    // gesendete Funktions-ID nicht mehr (HTTP 409 "stale_client_bundle").
    m.includes("invalid server function id") ||
    m.includes("stale_client_bundle")
  );
}

async function clearCachesAndServiceWorkers() {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.allSettled(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* Cache-Aufräumen darf die Wiederherstellung nie blockieren */
  }
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(regs.map((r) => r.unregister()));
    }
  } catch {
    /* dito */
  }
}

/** Führt die Wiederherstellung höchstens einmal pro Browser-Tab aus. */
export async function recoverFromStaleBundle(reason: unknown): Promise<void> {
  if (typeof window === "undefined") return;
  const message =
    reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason ?? "");
  if (!looksLikeStaleBundleError(message)) return;
  try {
    if (sessionStorage.getItem(MARKER)) return;
    sessionStorage.setItem(MARKER, "1");
  } catch {
    return;
  }
  await clearCachesAndServiceWorkers();
  window.location.reload();
}

/** Globale Listener für Bundle-Ladefehler außerhalb der React-Fehlergrenze. */
export function installStaleBundleRecovery(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("error", (event) => {
    void recoverFromStaleBundle(event.error ?? event.message);
  });
  window.addEventListener("unhandledrejection", (event) => {
    void recoverFromStaleBundle(event.reason);
  });
}
