/**
 * Darstellung des letzten Aktivitätszeitpunkts („Zuletzt online“).
 *
 * Quelle ist ausschließlich der Backend-Wert `profiles.last_seen_at`
 * (bzw. der letzte Login aus der Kontoverwaltung für Konten ohne Profil).
 * Es wird niemals ein künstlicher Online-Status erzeugt: ohne Wert bleibt
 * die Anzeige unbekannt.
 */

export type LastSeenState = "online" | "recent" | "offline" | "unknown";

export type LastSeenInfo = {
  state: LastSeenState;
  /** Farbiger Punkt als Emoji (bewusst textbasiert, damit überall lesbar). */
  dot: string;
  /** Kurzer Status: „Online“, „kürzlich aktiv“, „offline“. */
  status: string;
  /** Relative oder absolute Zeitangabe, z. B. „vor 5 Minuten“. */
  time: string;
  /** Tailwind-Klasse für die Textfarbe (bestehende Farbwelt). */
  toneClass: string;
};

const MIN = 60_000;
const HOUR = 60 * MIN;

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function clock(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function dateStr(d: Date) {
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Wechselt automatisch zwischen relativer und absoluter Zeit. */
export function formatLastSeenTime(value: string | null, now: number = Date.now()): string {
  if (!value) return "unbekannt";
  const d = new Date(value);
  const ms = d.getTime();
  if (!Number.isFinite(ms)) return "unbekannt";
  const diff = now - ms;

  if (diff < 2 * MIN) return "gerade eben";
  if (diff < HOUR) return `vor ${Math.max(1, Math.floor(diff / MIN))} Minuten`;
  if (diff < 6 * HOUR) {
    const h = Math.floor(diff / HOUR);
    return `vor ${h} ${h === 1 ? "Stunde" : "Stunden"}`;
  }

  const today = new Date(now);
  if (sameDay(d, today)) return `heute, ${clock(d)}`;

  const yesterday = new Date(now - 24 * HOUR);
  if (sameDay(d, yesterday)) return `gestern, ${clock(d)}`;

  return `${dateStr(d)}, ${clock(d)}`;
}

/** Vollständige Statusinformation für eine Nutzerkarte. */
export function describeLastSeen(value: string | null, now: number = Date.now()): LastSeenInfo {
  const ms = value ? new Date(value).getTime() : NaN;
  const time = formatLastSeenTime(value, now);
  if (!Number.isFinite(ms)) {
    return {
      state: "unknown",
      dot: "⚪",
      status: "unbekannt",
      time,
      toneClass: "text-muted-foreground",
    };
  }
  const diff = now - ms;
  if (diff < 5 * MIN)
    return { state: "online", dot: "🟢", status: "Online", time, toneClass: "text-brand" };
  if (diff < 30 * MIN)
    return {
      state: "recent",
      dot: "🟡",
      status: "kürzlich aktiv",
      time,
      toneClass: "text-amber-300/90",
    };
  return {
    state: "offline",
    dot: "⚪",
    status: "offline",
    time,
    toneClass: "text-muted-foreground",
  };
}
