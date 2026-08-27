/**
 * Gemeinsames Y-Dude Navigations-Pattern für Schließen (×) und Zurück (←).
 *
 * Ziel: Jede Kategorie (Feed, Connections, Benachrichtigungen, Market,
 * Channels, Arena, Globe, Admin, Modals/Overlays) verwendet exakt dieselbe
 * Geometrie, Strichstärke, Radien, Rahmen und Hover-/Active-Zustände.
 * Neue Bereiche erben den Standard automatisch, indem sie diese Komponenten
 * nutzen – keine Sonderlösungen pro Kategorie.
 */
import { Link } from "@tanstack/react-router";
import { ArrowLeft, X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

type NavSize = "sm" | "md";

/** Einheitliche Klickfläche: md = 44px (Touch-Standard), sm = 36px (Inline-Chips). */
const BOX: Record<NavSize, string> = {
  sm: "h-9 w-9",
  md: "h-11 w-11",
};

/** Einheitliche Icon-Größe und Strichstärke. */
const ICON: Record<NavSize, string> = {
  sm: "h-5 w-5",
  md: "h-6 w-6",
};

const BASE =
  "tap-safe inline-grid shrink-0 place-items-center rounded-full border border-border bg-background/70 text-muted-foreground backdrop-blur transition-colors duration-150 hover:border-brand/60 hover:bg-brand/10 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-0 active:scale-95 disabled:pointer-events-none disabled:opacity-50";

export function navButtonClass(size: NavSize = "md", className = "") {
  return `${BASE} ${BOX[size]} ${className}`.trim();
}

export function navIconClass(size: NavSize = "md") {
  return `${ICON[size]} stroke-[2.25]`;
}

type ButtonRest = Omit<ComponentProps<"button">, "children" | "className">;

/** Einheitliches Schließkreuz für Modals, Overlays und Panels. */
export function CloseButton({
  size = "md",
  className = "",
  label = "Schließen",
  ...rest
}: ButtonRest & { size?: NavSize; className?: string; label?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={navButtonClass(size, className)}
      {...rest}
    >
      <X className={navIconClass(size)} aria-hidden />
    </button>
  );
}

/**
 * Einheitlicher Zurück-Button. Entweder als Route-Link (`to`) oder als
 * Button (`onClick`). Mit `label` wird zusätzlich Text angezeigt – dabei
 * bleiben Höhe, Radius, Rahmen und Zustände identisch zum Icon-Button.
 */
export function BackButton({
  to,
  onClick,
  label,
  ariaLabel = "Zurück",
  size = "md",
  className = "",
}: {
  to?: string;
  onClick?: () => void;
  label?: ReactNode;
  ariaLabel?: string;
  size?: NavSize;
  className?: string;
}) {
  const withLabel = label != null && label !== "";
  const shape = withLabel
    ? `${BASE} ${size === "sm" ? "h-9" : "h-11"} w-auto gap-2 px-4 text-xs font-bold uppercase tracking-wider ${className}`
    : navButtonClass(size, className);
  const inner = (
    <>
      <ArrowLeft className={navIconClass(size)} aria-hidden />
      {withLabel ? <span className="whitespace-nowrap">{label}</span> : null}
    </>
  );

  if (to) {
    return (
      <Link to={to} aria-label={ariaLabel} title={ariaLabel} className={shape}>
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={shape}
    >
      {inner}
    </button>
  );
}
