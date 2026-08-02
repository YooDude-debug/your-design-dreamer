import { AlertTriangle } from "lucide-react";
import { useLang } from "@/lib/i18n";

/** Schlichter Bestätigungsdialog im Y-Dude-Look (Löschvorgänge, Logout). */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  busy = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useLang();
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] grid place-items-center bg-background/80 p-4 backdrop-blur"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-border bg-surface/95 p-5 shadow-glow"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
          <div className="space-y-1">
            <p className="text-sm font-semibold">{title}</p>
            {message && <p className="text-sm text-muted-foreground">{message}</p>}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {t.cancel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="rounded-full border border-brand bg-brand/15 px-4 py-1.5 text-xs font-bold text-brand hover:bg-brand/25 disabled:opacity-50"
          >
            {busy ? t.deleting : (confirmLabel ?? t.delete)}
          </button>
        </div>
      </div>
    </div>
  );
}
