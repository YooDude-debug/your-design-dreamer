import type { LucideIcon } from "lucide-react";

export type ArenaTabId = "mine" | "manager" | "arena" | "globe";

export type ArenaNavEntry = {
  id: ArenaTabId;
  label: string;
  hint: string;
  icon: LucideIcon;
  count?: number;
};

/**
 * 2×2 Modul-Navigation der Arena (Mobile), 4 Spalten auf Desktop.
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
      aria-label="Arena-Bereiche"
      className="control-bar mt-3 grid grid-cols-2 gap-1.5 rounded-2xl p-1.5 md:grid-cols-4"
    >
      {entries.map((entry) => {
        const Icon = entry.icon;
        const on = entry.id === active;
        return (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onSelect(entry.id)}
            className={`control-chip tap-safe grid min-h-[56px] grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-xl px-2.5 py-2 text-left ${
              on ? "control-chip-active" : ""
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[11px] font-bold uppercase tracking-wider">
                  {entry.label}
                </span>
                {typeof entry.count === "number" && entry.count > 0 && (
                  <span className="shrink-0 rounded-full border border-current px-1.5 text-[9px] font-bold leading-4 opacity-80">
                    {entry.count}
                  </span>
                )}
              </span>
              <span className="block truncate text-[9px] opacity-70">{entry.hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
