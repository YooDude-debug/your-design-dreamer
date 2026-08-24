/**
 * Feed-Sitzungszustand (eine einzige Zuständigkeit).
 *
 * Der Feed wird beim Wechsel auf eigene Seiten (Market, Channels, Profil …)
 * technisch abgebaut. Damit der Nutzer nach `Zurück` exakt dort weitermacht,
 * wo er war, wird der beobachtete Zustand hier gemerkt:
 *
 * - eingerastete Schnellleiste (Feed-Modus)
 * - Scrollposition der TATSÄCHLICH scrollenden Quelle (Container oder Seite)
 * - zuletzt oben sichtbarer Beitrag als stabiler Anker (robuster als Pixel)
 * - Reiter und Anzahl gerenderter Beiträge (Infinite-Scroll-Stand)
 *
 * Modulzustand statt Storage: gilt genau für die laufende App-Sitzung, ein
 * echter Reload startet wieder oben.
 */

export type FeedSession = {
  /** Schnellleiste war eingerastet. */
  feedMode: boolean;
  /** Aktiver Feed-Reiter. */
  tab: string | null;
  /** Bereits gerenderte Beiträge (Infinite-Scroll-Stand). */
  renderCount: number;
  /** Scrollposition des Feed-Containers. */
  scrollTop: number;
  /** Scrollposition der Seite (falls die Seite scrollt). */
  windowScrollY: number;
  /** Oberster sichtbarer Beitrag + sein Abstand zur Oberkante. */
  anchorId: string | null;
  anchorOffset: number;
};

const EMPTY: FeedSession = {
  feedMode: false,
  tab: null,
  renderCount: 0,
  scrollTop: 0,
  windowScrollY: 0,
  anchorId: null,
  anchorOffset: 0,
};

let state: FeedSession | null = null;

export function readFeedSession(): FeedSession | null {
  return state;
}

/** Teilzustand aktualisieren – vorhandene Werte bleiben erhalten. */
export function patchFeedSession(patch: Partial<FeedSession>): void {
  state = { ...(state ?? EMPTY), ...patch };
}

export function clearFeedSession(): void {
  state = null;
}
