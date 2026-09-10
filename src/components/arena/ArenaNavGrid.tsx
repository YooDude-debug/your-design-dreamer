import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

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
      className="grid shrink-0 grid-cols-2 gap-2.5 md:grid-cols-4"
    >
      {entries.map((entry) => {
        const Icon = entry.icon;
        const on = entry.id === active && !entry.disabled;
        return (
          <Button
            key={entry.id}
            type="button"
            variant="ghost"
            role="tab"
            aria-selected={on}
            aria-disabled={entry.disabled ? true : undefined}
            disabled={entry.disabled}
            onClick={() => !entry.disabled && onSelect(entry.id)}
            className={`h-14 w-full justify-start gap-2 rounded-xl border px-3 text-left transition-colors md:h-16 md:justify-center ${
              on
                ? "border-brand bg-brand/10 text-foreground shadow-glow-active"
                : "border-border bg-surface-2/55 text-muted-foreground hover:border-foreground/30 hover:bg-surface-2 hover:text-foreground"
            } ${entry.disabled ? "cursor-not-allowed opacity-45" : ""}`}
          >
            <Icon className={`h-5 w-5 shrink-0 ${on ? "text-brand" : ""}`} />
            <span className="flex min-w-0 flex-col">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="min-w-0 truncate text-[10px] font-bold uppercase leading-tight sm:text-xs">
                  {entry.label}
                </span>
                {!entry.disabled && typeof entry.count === "number" && entry.count > 0 && (
                  <span className="shrink-0 rounded-full border border-current px-1.5 text-[9px] font-bold leading-4 opacity-80">
                    {entry.count}
                  </span>
                )}
              </span>
              {entry.badge && (
                <span className="text-[9px] font-bold uppercase text-brand opacity-80">
                  {entry.badge}
                </span>
              )}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
