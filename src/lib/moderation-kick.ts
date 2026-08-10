/**
 * Startet den Hintergrund-Worker der KI-Moderation – ohne zu warten.
 *
 * Der Aufruf ist absichtlich "feuern und vergessen": die Oberfläche blockiert
 * nie und wartet nie auf ein Prüfergebnis. Schlägt der Aufruf fehl, arbeitet
 * der Zeitplan (Cron) die Aufträge später ab.
 *
 * Autorisierung: über die bestehende Server-Anmeldung (Bearer-Token der
 * Sitzung). Es liegt bewusst KEIN Geheimnis im Frontend.
 */
import { runModerationQueue } from "@/lib/moderation.functions";

export function kickModerationWorker(): void {
  try {
    void runModerationQueue().catch(() => {});
  } catch {
    /* Moderation läuft über den Zeitplan weiter. */
  }
}
