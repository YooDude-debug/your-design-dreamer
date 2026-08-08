/**
 * Startet den Hintergrund-Worker der KI-Moderation – ohne zu warten.
 *
 * Der Aufruf ist absichtlich "feuern und vergessen": die Oberfläche blockiert
 * nie und wartet nie auf ein Prüfergebnis. Schlägt der Aufruf fehl, arbeitet
 * der Zeitplan (Cron) die Aufträge später ab.
 */
export function kickModerationWorker(): void {
  const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;
  if (!key || typeof fetch !== "function") return;
  try {
    void fetch("/api/public/moderation-run", {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: "{}",
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* Moderation läuft über den Zeitplan weiter. */
  }
}
