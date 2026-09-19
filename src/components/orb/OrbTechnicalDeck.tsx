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
    <section aria-labelledby="orb-technical-title" className="space-y-3">
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

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
                "h-auto min-h-20 items-start justify-start gap-3 rounded-lg border-border bg-surface-2/45 px-3 py-3 text-left shadow-none hover:border-brand/50 hover:bg-surface-2",
                selected && "border-brand/70 bg-brand/10 text-foreground",
              )}
            >
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-background text-brand">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold">{item.label}</span>
                <span className="mt-1 block truncate text-[10px] font-normal text-muted-foreground">
                  {item.summary}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "mt-1 size-3.5 text-muted-foreground transition-transform",
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
