import type { LucideIcon } from "lucide-react";

export type ArenaTabId = "box" | "manager" | "globe" | "arena";

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
      className="control-bar mt-1 grid grid-cols-2 gap-1 rounded-xl p-1 md:grid-cols-4"
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
            className={`control-chip tap-safe grid min-h-[36px] grid-cols-[auto_minmax(0,1fr)] items-center gap-1.5 rounded-lg px-2 py-1 text-left ${
              on ? "control-chip-active" : ""
            } ${entry.disabled ? "cursor-not-allowed opacity-40" : ""}`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="flex min-w-0 flex-col">
              <span className="flex items-center gap-1">
                <span className="min-w-0 break-words text-[9px] font-bold uppercase leading-tight tracking-wide">
                  {entry.label}
                </span>
                {!entry.disabled && typeof entry.count === "number" && entry.count > 0 && (
                  <span className="shrink-0 rounded-full border border-current px-1 text-[8px] font-bold leading-3 opacity-80">
                    {entry.count}
                  </span>
                )}
              </span>
              {entry.badge && (
                <span className="text-[8px] font-bold uppercase tracking-wider opacity-70">
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
