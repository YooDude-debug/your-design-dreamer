/**
 * Gemeinsame Definitionen des Feedback- und Verbesserungssystems.
 * Enthaelt keine Server-Abhaengigkeiten und keine Geheimnisse.
 */

export const FEEDBACK_CATEGORIES = [
  { value: "bug", emoji: "🐛", label: "Fehler" },
  { value: "improvement", emoji: "💡", label: "Verbesserung" },
  { value: "design", emoji: "🎨", label: "Design / Bedienung" },
  { value: "performance", emoji: "⚡", label: "Performance" },
  { value: "other", emoji: "📝", label: "Sonstiges" },
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]["value"];

export const FEEDBACK_STATUSES = [
  { value: "new", label: "Neu" },
  { value: "in_progress", label: "In Bearbeitung" },
  { value: "done", label: "Erledigt" },
  { value: "rejected", label: "Abgelehnt" },
] as const;

export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number]["value"];

/** Technische Grenzen: 300 Zeilen und eine sinnvolle Zeichenbegrenzung. */
export const FEEDBACK_MAX_LINES = 300;
export const FEEDBACK_MAX_CHARS = 6000;
export const FEEDBACK_MIN_CHARS = 5;

export function categoryLabel(value: string): string {
  const found = FEEDBACK_CATEGORIES.find((c) => c.value === value);
  return found ? `${found.emoji} ${found.label}` : value;
}

export function statusLabel(value: string): string {
  return FEEDBACK_STATUSES.find((s) => s.value === value)?.label ?? value;
}

export type FeedbackRow = {
  id: string;
  userId: string;
  username: string;
  roles: string[];
  category: FeedbackCategory;
  message: string;
  area: string;
  device: string;
  browser: string;
  os: string;
  status: FeedbackStatus;
  adminNote: string;
  createdAt: string;
  handledAt: string | null;
};

/** Kuerzt Text auf die erlaubten Zeilen/Zeichen (rein technisch, kein Inhaltseingriff). */
export function clampFeedbackText(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n").slice(0, FEEDBACK_MAX_LINES);
  return lines.join("\n").slice(0, FEEDBACK_MAX_CHARS);
}

/** Leitet aus dem User-Agent nur grobe, nicht personenbezogene Angaben ab. */
export function clientEnvironment(ua: string, width: number): {
  device: string;
  browser: string;
  os: string;
} {
  const s = ua || "";
  const os = /Android/i.test(s)
    ? "Android"
    : /iPhone|iPad|iPod/i.test(s)
      ? "iOS"
      : /Mac OS X/i.test(s)
        ? "macOS"
        : /Windows/i.test(s)
          ? "Windows"
          : /Linux/i.test(s)
            ? "Linux"
            : "Unbekannt";
  const browser = /Edg\//i.test(s)
    ? "Edge"
    : /OPR\//i.test(s)
      ? "Opera"
      : /Chrome\//i.test(s)
        ? "Chrome"
        : /Firefox\//i.test(s)
          ? "Firefox"
          : /Safari\//i.test(s)
            ? "Safari"
            : "Unbekannt";
  const device = /iPad|Tablet/i.test(s)
    ? "Tablet"
    : /Mobi|Android|iPhone/i.test(s)
      ? "Smartphone"
      : "Desktop";
  return { device, browser, os: width > 0 ? `${os} · ${width}px` : os };
}
