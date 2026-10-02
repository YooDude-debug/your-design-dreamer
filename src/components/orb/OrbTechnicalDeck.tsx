import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type OrbTechnicalItem = {
  id: string;
  label: string;
  summary: string;
  icon: LucideIcon;
  content: ReactNode;
};

export function OrbTechnicalDeck({ items }: { items: OrbTechnicalItem[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = items.find((item) => item.id === activeId);

  return (
    <section aria-labelledby="orb-technical-title" className="space-y-1.5">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-brand">
            Einblicke
          </p>
          <h2 id="orb-technical-title" className="text-sm font-semibold text-foreground">
            Technische Informationen
          </h2>
        </div>
        <span className="text-[11px] text-muted-foreground">Bei Bedarf öffnen</span>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          const selected = activeId === item.id;
          return (
            <Button
              key={item.id}
              type="button"
              variant="outline"
              aria-expanded={selected}
              aria-controls="orb-technical-content"
              onClick={() => setActiveId(selected ? null : item.id)}
              className={cn(
                "h-auto min-h-0 items-center justify-start gap-2 rounded-lg border-border bg-surface-2/45 px-2.5 py-1.5 text-left shadow-none hover:border-brand/50 hover:bg-surface-2",
                selected && "border-brand/70 bg-brand/10 text-foreground",
              )}
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-background text-brand">
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold leading-tight">{item.label}</span>
                <span className="block truncate text-[10px] leading-tight font-normal text-muted-foreground">
                  {item.summary}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "size-3.5 shrink-0 text-muted-foreground transition-transform",
                  selected && "rotate-180",
                )}
                aria-hidden="true"
              />
            </Button>
          );
        })}
      </div>

      {active && (
        <div
          id="orb-technical-content"
          className="rounded-lg border border-border bg-surface/70 p-3 shadow-subtle"
        >
          <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
            <active.icon className="size-4 text-brand" aria-hidden="true" />
            <h3 className="text-xs font-bold uppercase tracking-wide text-foreground">
              {active.label}
            </h3>
          </div>
          {active.content}
        </div>
      )}
    </section>
  );
}
