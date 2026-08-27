import {
  Archive,
  Armchair,
  Baby,
  Bike,
  Car,
  Cpu,
  Footprints,
  Gamepad2,
  Gem,
  Home,
  Laptop,
  Package,
  Palette,
  Shirt,
  Smartphone,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * Zentrale Zuordnung: Icon-Name (aus market_categories.icon) -> Lucide-Komponente.
 * Icon-Namen dürfen niemals als sichtbarer Text gerendert werden.
 */
const ICONS: Record<string, LucideIcon> = {
  Cpu,
  Smartphone,
  Laptop,
  Gamepad2,
  Shirt,
  Footprints,
  Armchair,
  Home,
  Bike,
  Car,
  Baby,
  Palette,
  Gem,
  Wrench,
  Package,
  Archive,
};

export function MarketCategoryIcon({
  icon,
  className = "h-3.5 w-3.5 shrink-0",
}: {
  icon: string | null | undefined;
  className?: string;
}) {
  const Icon = icon ? ICONS[icon] : undefined;
  if (!Icon) return null;
  return <Icon className={className} aria-hidden="true" />;
}
