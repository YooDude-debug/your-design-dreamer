/**
 * Gemeinsamer Sitzungsstart (Bootstrap-Verteiler).
 *
 * `bootstrap_user_state()` liefert seit der Bündelung nicht nur die
 * persönlichen Zustände, sondern zusätzlich Freigaben, Werbepausen,
 * Verbindungen, Chats, Ungelesen-Zähler und Benachrichtigungen.
 *
 * Damit dieselben Daten nicht zweimal geholt werden, veröffentlicht der
 * Datenkern (`data.tsx`) das laufende Versprechen hier, und andere Bereiche
 * (Social-Layer) warten kurz darauf, statt eigene Einzelabfragen zu stellen.
 * Bleibt der Wert aus (Fehler, Zeitüberschreitung), greift dort unverändert
 * der bisherige Ladeweg – es geht also nie Funktionalität verloren.
 */

export type SocialBootstrapRow = Record<string, unknown>;

export type SessionBootstrap = {
  granted_tag_ids?: string[];
  ad_pauses?: SocialBootstrapRow[];
  connections?: SocialBootstrapRow[];
  conversations?: SocialBootstrapRow[];
  unread_counts?: Record<string, number>;
  notifications?: SocialBootstrapRow[];
  [key: string]: unknown;
};

type Entry = {
  userId: string;
  promise: Promise<SessionBootstrap | null>;
  /** Jeder Bereich darf den Sitzungsstart genau einmal übernehmen. */
  consumers: Set<string>;
};

let current: Entry | null = null;

/** Der Datenkern meldet den laufenden Bootstrap-Aufruf an. */
export function publishSessionBootstrap(
  userId: string,
  promise: Promise<SessionBootstrap | null>,
) {
  current = { userId, promise, consumers: new Set() };
}

/** Beim Abmelden verworfen, damit kein fremder Stand übernommen wird. */
export function clearSessionBootstrap() {
  current = null;
}

/**
 * Einmalige Übernahme je Bereich (`consumer`). Liefert `null`, wenn kein
 * passender Bootstrap vorliegt oder er nicht rechtzeitig antwortet – dann
 * greift beim Aufrufer der bisherige Ladeweg.
 */
export async function takeSessionBootstrap(
  userId: string,
  consumer: string,
  timeoutMs = 6000,
): Promise<SessionBootstrap | null> {
  const entry = current;
  if (!entry || entry.userId !== userId || entry.consumers.has(consumer)) return null;
  entry.consumers.add(consumer);
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
  try {
    return await Promise.race([entry.promise, timeout]);
  } catch {
    return null;
  }
}

