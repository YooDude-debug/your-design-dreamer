import type { LucideIcon } from "lucide-react";

export type ArenaTabId = "mine" | "box" | "arena" | "globe";

export type ArenaNavEntry = {
  id: ArenaTabId;
  label: string;
  icon: LucideIcon;
  count?: number;
  /** Bereich ist angekündigt, aber noch nicht aktiv. */
  disabled?: boolean;
  /** Kleiner Hinweis-Badge (z. B. „Bald“). */
  badge?: string;
};

/**
 * Zentrale SlangTag-Navigation der Arena: 2×2 auf Mobile, 4 Spalten ab md.
 * Rein präsentational – Zustand liegt in der Route (Suchparameter `tab`).
 */
export function ArenaNavGrid({
  entries,
  active,
  onSelect,
}: {
  entries: ArenaNavEntry[];
  active: ArenaTabId;
  onSelect: (id: ArenaTabId) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="SlangTag-Bereiche"
      className="control-bar mt-3 grid grid-cols-2 gap-1.5 rounded-2xl p-1.5 md:grid-cols-4"
    >
      {entries.map((entry) => {
        const Icon = entry.icon;
        const on = entry.id === active && !entry.disabled;
        return (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={on}
            aria-disabled={entry.disabled ? true : undefined}
            disabled={entry.disabled}
            onClick={() => !entry.disabled && onSelect(entry.id)}
            className={`control-chip tap-safe grid min-h-[48px] grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-xl px-2.5 py-2 text-left ${
              on ? "control-chip-active" : ""
            } ${entry.disabled ? "cursor-not-allowed opacity-40" : ""}`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-1.5">
                <span className="min-w-0 break-words text-[10.5px] font-bold uppercase leading-tight tracking-wide">
                  {entry.label}
                </span>
                {!entry.disabled && typeof entry.count === "number" && entry.count > 0 && (
                  <span className="shrink-0 rounded-full border border-current px-1.5 text-[9px] font-bold leading-4 opacity-80">
                    {entry.count}
                  </span>
                )}
              </span>
              {entry.badge && (
                <span className="text-[8.5px] font-bold uppercase tracking-wider opacity-70">
                  {entry.badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
