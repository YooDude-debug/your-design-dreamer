/**
 * Gegenrichtung zum bestehenden Teilen: andere Apps -> Y-Dude.
 * Die von `/share-target` empfangenen Daten werden kurz zwischengespeichert
 * und beim naechsten Laden des bestehenden Composers genau einmal uebernommen.
 */
export const SHARE_TARGET_KEY = "y-dude-share-target";

/** Maximale Groesse eines geteilten Bildes (als Data-URL zwischengespeichert). */
export const SHARE_TARGET_MAX_BYTES = 5 * 1024 * 1024;

export type SharedContent = {
  /** Titel des geteilten Inhalts (optional) */
  title?: string;
  /** Geteilter Text (optional) */
  text?: string;
  /** Geteilte URL (optional) */
  url?: string;
  /** Geteiltes Bild als Data-URL (optional) */
  image?: string;
  /** Hinweis, wenn ein Dateityp nicht uebernommen werden konnte */
  notice?: string;
};

/** Beschreibungstext aus Titel, Text und URL – ohne Doppelungen. */
export function sharedDescription(shared: SharedContent): string {
  const parts = [shared.title, shared.text, shared.url]
    .map((part) => (part ?? "").trim())
    .filter(Boolean);
  return Array.from(new Set(parts)).join("\n");
}

/**
 * Geteilte Inhalte einmalig auslesen. Der Eintrag wird sofort entfernt,
 * damit ein Reload den Composer nicht erneut vorbefuellt.
 */
export function consumeSharedContent(): SharedContent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SHARE_TARGET_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(SHARE_TARGET_KEY);
    const parsed = JSON.parse(raw) as SharedContent;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}
