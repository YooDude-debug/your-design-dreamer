/** Kompakter Status-Chip im bestehenden Brand-Stil. */
export function StatusChip({
  label,
  tone = "muted",
}: {
  label: string;
  tone?: "muted" | "brand" | "cyan";
}) {
  const cls =
    tone === "brand"
      ? "border-brand/50 bg-brand/10 text-brand"
      : tone === "cyan"
        ? "border-brand-cyan/50 bg-brand-cyan/10 text-brand-cyan"
        : "border-border text-muted-foreground";
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${cls}`}
    >
      {label}
    </span>
  );
}
