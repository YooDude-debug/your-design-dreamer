import { CloseButton } from "@/components/ui/nav-buttons";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Mail, User, Calendar, MapPin, Clock } from "lucide-react";
import type { AdminUserRow } from "@/lib/admin.shared";
import { formatDateTime } from "@/lib/format-date";
import { AdminButton } from "./AdminUI";

export type AdminUserDetailDialogProps = {
  user: AdminUserRow | null;
  onClose: () => void;
  /** Übersetzte Labels – kommen aus dem zentralen i18n-System. */
  labels: {
    title: string;
    emailAddress: string;
    noEmail: string;
    registered: string;
    lastSeen: string;
    locationLanguage: string;
    roles: string;
    roleAdmin: string;
    roleCreator: string;
    roleBusiness: string;
    statusVerified: string;
    statusBanned: string;
    warnings: string;
    close: string;
  };
};

export function AdminUserDetailDialog({ user, onClose, labels }: AdminUserDetailDialogProps) {
  useEffect(() => {
    if (!user) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [user, onClose]);

  if (!user || typeof document === "undefined") return null;

  const Row = ({
    icon: Icon,
    label,
    value,
    tone,
  }: {
    icon: React.ElementType;
    label: string;
    value: React.ReactNode;
    tone?: "default" | "muted" | "danger" | "brand";
  }) => {
    const valueClass =
      tone === "danger"
        ? "text-destructive"
        : tone === "brand"
          ? "text-brand"
          : tone === "muted"
            ? "text-muted-foreground"
            : "text-foreground";
    return (
      <div className="flex items-start gap-3 py-2">
        <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className={`mt-0.5 text-sm font-medium break-words ${valueClass}`}>{value}</p>
        </div>
      </div>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={labels.title}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-background p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{labels.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              @{user.username} · {user.displayName}
            </p>
          </div>
          <CloseButton onClick={onClose} label={labels.close} />
        </div>

        <div className="mt-4 space-y-1">
          <Row
            icon={Mail}
            label={labels.emailAddress}
            value={user.email ?? labels.noEmail}
            tone={user.email ? "default" : "muted"}
          />
          <Row
            icon={User}
            label={labels.roles}
            value={
              <span className="flex flex-wrap gap-1.5">
                {user.isAdmin && (
                  <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold text-brand">
                    {labels.roleAdmin}
                  </span>
                )}
                {user.isCreator && (
                  <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold text-brand">
                    {labels.roleCreator}
                  </span>
                )}
                {user.isBusiness && (
                  <span className="rounded-full bg-brand-cyan/15 px-2 py-0.5 text-[10px] font-bold text-brand-cyan">
                    {labels.roleBusiness}
                  </span>
                )}
                {user.verified && (
                  <span className="rounded-full bg-brand-cyan/15 px-2 py-0.5 text-[10px] font-bold text-brand-cyan">
                    {labels.statusVerified}
                  </span>
                )}
                {user.banned && (
                  <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">
                    {labels.statusBanned}
                  </span>
                )}
                {user.warnings > 0 && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] text-accent-foreground">
                    {user.warnings} {labels.warnings}
                  </span>
                )}
                {!user.isAdmin &&
                  !user.isCreator &&
                  !user.isBusiness &&
                  !user.verified &&
                  !user.banned &&
                  user.warnings === 0 && <span className="text-xs text-muted-foreground">—</span>}
              </span>
            }
          />
          <Row
            icon={MapPin}
            label={labels.locationLanguage}
            value={`${user.location || "—"} · ${user.language || "—"}`}
            tone="muted"
          />
          <Row icon={Calendar} label={labels.registered} value={formatDateTime(user.createdAt)} />
          {user.lastSeenAt && (
            <Row icon={Clock} label={labels.lastSeen} value={formatDateTime(user.lastSeenAt)} />
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <AdminButton onClick={onClose}>{labels.close}</AdminButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
