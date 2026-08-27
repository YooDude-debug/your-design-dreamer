/**
 * Zentrale Teilen-Logik für Y-Dude.
 * Nur öffentliche Beiträge erhalten eine öffentliche URL – private Inhalte
 * dürfen niemals geteilt werden.
 */

/** Öffentliche Basis-URL der Plattform (Custom Domain). */
export const SHARE_BASE_URL = "https://y-dude.com";

export type SharePayload = {
  /** Öffentliche URL des Beitrags */
  url: string;
  /** Titel bzw. erste Zeile des Beitrags */
  title: string;
  /** Anzeigename des Erstellers */
  author: string;
  /** Vorschaubild (optional) */
  image?: string | null;
  /** Eigener Teilen-Text (optional) – überschreibt den Standardtext. */
  text?: string;
};

/** Öffentliche URL eines Profils (bestehende Profilroute). */
export function profileShareUrl(username: string): string {
  return `${SHARE_BASE_URL}/profile/${encodeURIComponent(username)}`;
}

/** Öffentliche URL eines Beitrags. */
export function postShareUrl(postId: string): string {
  return `${SHARE_BASE_URL}/post/${postId}`;
}

/** Nur öffentliche Beiträge sind teilbar. */
export function isShareable(visibility: string): boolean {
  return visibility === "public";
}

/** Erste Zeile / Kurzfassung als Teilen-Titel. */
export function shareTitle(title: string, description = ""): string {
  const raw = (title || description.split("\n")[0] || "Y-Dude Beitrag").trim();
  return raw.length > 90 ? `${raw.slice(0, 87)}…` : raw;
}

/** Einheitlicher Teilen-Text für alle Kanäle. */
export function shareText(payload: SharePayload): string {
  if (payload.text) return payload.text;
  return `${payload.title} – von ${payload.author} auf Y-Dude`;
}

/** Steht die native Web Share API zur Verfügung? */
export function canWebShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

/** System-Teilen (Web Share API). Gibt false zurück, wenn nicht möglich/abgebrochen. */
export async function nativeShare(payload: SharePayload): Promise<boolean> {
  if (!canWebShare()) return false;
  try {
    await navigator.share({ title: payload.title, text: shareText(payload), url: payload.url });
    return true;
  } catch {
    return false;
  }
}

/** Link in die Zwischenablage kopieren – mit Fallback für alte Browser. */
export async function copyLink(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = url;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

export type ShareTargetId = "whatsapp" | "email" | "x" | "facebook";

export type ShareTarget = {
  id: ShareTargetId;
  label: string;
  /** Tailwind-Klassen für das Icon-Badge (Y-Dude Design-Tokens) */
  accent: string;
  /** Erzeugt die Ziel-URL für den jeweiligen Kanal */
  href: (payload: SharePayload) => string;
};

/** Erweiterbare Liste der Teilen-Ziele – neue Plattformen einfach ergänzen. */
export const SHARE_TARGETS: ShareTarget[] = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    accent: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
    href: (p) => `https://wa.me/?text=${encodeURIComponent(`${shareText(p)}\n${p.url}`)}`,
  },
  {
    id: "email",
    label: "E-Mail",
    accent: "border-brand/40 bg-brand/10 text-brand",
    href: (p) =>
      `mailto:?subject=${encodeURIComponent(p.title)}&body=${encodeURIComponent(
        `${shareText(p)}\n\n${p.url}`,
      )}`,
  },
  {
    id: "x",
    label: "X",
    accent: "border-border bg-foreground/10 text-foreground",
    href: (p) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText(p))}&url=${encodeURIComponent(p.url)}`,
  },
  {
    id: "facebook",
    label: "Facebook",
    accent: "border-blue-500/40 bg-blue-500/10 text-blue-400",
    href: (p) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(p.url)}`,
  },
];

/** Öffnet ein Teilen-Ziel in einem neuen Tab (mailto im gleichen Tab). */
export function openShareTarget(target: ShareTarget, payload: SharePayload) {
  const href = target.href(payload);
  if (target.id === "email") {
    window.location.href = href;
    return;
  }
  window.open(href, "_blank", "noopener,noreferrer,width=640,height=680");
}
