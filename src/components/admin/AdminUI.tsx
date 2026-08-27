import { BackButton } from "@/components/ui/nav-buttons";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Card on the admin dashboard start page. */
export function AdminCard({
  to,
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`group flex flex-col gap-2 rounded-2xl border p-4 transition-all hover:-translate-y-0.5 ${
        accent
          ? "border-brand/50 bg-brand/5 hover:border-brand hover:shadow-glow"
          : "border-border bg-background hover:border-brand/50"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-brand">
          {label}
        </span>
        <Icon className="h-4 w-4 shrink-0 text-brand" />
      </div>
      <span className="text-2xl font-bold leading-none text-foreground">{value}</span>
      {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
    </Link>
  );
}

/** Wrapper for every admin management area. */
export function AdminSection({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <BackButton to="/admin" label="Dashboard" />
          <h1 className="mt-1 text-xl font-bold tracking-tight text-foreground">{title}</h1>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function AdminPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-border bg-background p-4 ${className}`}>
      {children}
    </div>
  );
}

export function AdminButton({
  children,
  onClick,
  variant = "default",
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const styles = {
    default: "border border-border text-muted-foreground hover:border-brand/60 hover:text-brand",
    primary: "bg-gradient-brand font-semibold text-primary-foreground hover:opacity-90",
    danger: "border border-destructive/50 text-destructive hover:bg-destructive/10",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors disabled:opacity-40 ${styles}`}
    >
      {children}
    </button>
  );
}

export function AdminInput({
  value,
  onChange,
  placeholder,
  type = "text",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`min-w-0 rounded-lg border border-border bg-background/70 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-brand/60 focus:outline-none ${className}`}
    />
  );
}

export function AdminSelect<T extends string>({
  value,
  onChange,
  options,
  className = "",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={`rounded-lg border border-border bg-background/70 px-2 py-1.5 text-xs text-foreground focus:border-brand/60 focus:outline-none ${className}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function AdminTabs<T extends string>({
  value,
  onChange,
  tabs,
}: {
  value: T;
  onChange: (v: T) => void;
  tabs: { value: T; label: string; badge?: number }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors ${
            value === tab.value
              ? "bg-brand/15 font-semibold text-brand"
              : "border border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab.label}
          {!!tab.badge && (
            <span className="rounded-full bg-brand/20 px-1.5 text-[10px] font-bold text-brand">
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function AdminEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
      {children}
    </p>
  );
}

export function AdminLoading() {
  return (
    <div className="grid place-items-center py-10">
      <Loader2 className="h-5 w-5 animate-spin text-brand" />
    </div>
  );
}

/** Minimal dependency-free bar chart for the statistics area. */
export function BarChart({
  data,
  label,
  unit = "",
}: {
  data: { label: string; value: number }[];
  label: string;
  unit?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <AdminPanel>
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-brand">{label}</h3>
      <div className="mt-3 flex h-32 items-end gap-[3px]">
        {data.map((d) => (
          <div
            key={d.label}
            className="group relative flex-1"
            title={`${d.label}: ${d.value}${unit}`}
          >
            <div
              className="w-full rounded-t bg-gradient-brand transition-all group-hover:opacity-80"
              style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[9px] text-muted-foreground">
        <span>{data[0]?.label ?? ""}</span>
        <span>
          Max {max}
          {unit}
        </span>
        <span>{data[data.length - 1]?.label ?? ""}</span>
      </div>
    </AdminPanel>
  );
}

export function DistributionList({
  data,
  label,
}: {
  data: { label: string; value: number }[];
  label: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <AdminPanel>
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-brand">{label}</h3>
      <ul className="mt-3 space-y-2">
        {data.length === 0 && <li className="text-xs text-muted-foreground">Keine Daten</li>}
        {data.map((d) => (
          <li key={d.label} className="text-[11px]">
            <div className="flex justify-between gap-2">
              <span className="truncate text-foreground">{d.label}</span>
              <span className="text-muted-foreground">{d.value}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-background">
              <div
                className="h-full rounded-full bg-gradient-brand"
                style={{ width: `${(d.value / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </AdminPanel>
  );
}
