import { CloseButton } from "@/components/ui/nav-buttons";
import { useEffect, useRef, useState } from "react";
import { Flag, MoreHorizontal, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useData } from "@/lib/data-context";
import { REPORT_REASONS } from "@/lib/report-reasons";
import { DropdownPortal } from "@/components/DropdownPortal";

export type ReportableType = "post" | "slang_tag";

type Target = {
  targetType: ReportableType;
  targetId: string;
  /** Ersteller des Inhalts */
  targetUserId?: string | null;
};

/** Drei-Punkte-Menü mit dem Menüpunkt „Inhalt melden“. */
export function ReportMenu({
  targetType,
  targetId,
  targetUserId,
  className = "",
}: Target & { className?: string }) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        ref={btnRef}
        type="button"
        aria-label="Weitere Optionen"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen((v) => !v);
        }}
        className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-brand/60 hover:text-brand"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      <DropdownPortal
        anchorRef={btnRef}
        open={open}
        onClose={() => setOpen(false)}
        align="right"
        width={192}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
            setDialog(true);
          }}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs text-foreground transition-colors hover:bg-brand/10 hover:text-brand"
        >
          <Flag className="h-3.5 w-3.5 text-brand" /> 🚩 Inhalt melden
        </button>
      </DropdownPortal>
      {dialog && (
        <ReportDialog
          targetType={targetType}
          targetId={targetId}
          targetUserId={targetUserId}
          onClose={() => setDialog(false)}
        />
      )}
    </span>
  );
}

/** Meldedialog mit Gründen und optionalem Freitext. */
export function ReportDialog({
  targetType,
  targetId,
  targetUserId,
  onClose,
}: Target & { onClose: () => void }) {
  const { user } = useData();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    if (!reason || busy) return;
    if (!user) {
      toast.error("Bitte melde dich an, um Inhalte zu melden.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("reports").insert({
      target_type: targetType,
      target_id: targetId,
      target_user_id: targetUserId ?? null,
      reporter_id: user.id,
      reason,
      details: details.trim().slice(0, 1000),
      status: "open",
    } as never);
    setBusy(false);

    if (error) {
      if (error.code === "23505") {
        toast.error("Du hast diesen Inhalt bereits gemeldet.");
      } else if (/Meldungen in kurzer Zeit/i.test(error.message)) {
        toast.error("Zu viele Meldungen in kurzer Zeit. Bitte später erneut versuchen.");
      } else {
        toast.error("Meldung konnte nicht gesendet werden.");
      }
      return;
    }
    toast.success("Vielen Dank. Deine Meldung wurde erfolgreich an das Moderationsteam gesendet.");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-border bg-surface/95 p-4 shadow-glow sm:max-w-md sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
              <Flag className="h-4 w-4 text-brand" /> Inhalt melden
            </h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {targetType === "post" ? "Beitrag" : "SlangTag"} · Warum meldest du diesen Inhalt?
            </p>
          </div>
          <CloseButton onClick={onClose} label="Schließen" className="shrink-0" />
        </div>

        <div className="mt-3 space-y-1.5">
          {REPORT_REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setReason(r.value)}
              className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                reason === r.value
                  ? "border-brand/60 bg-brand/10 text-brand"
                  : "border-border text-muted-foreground hover:border-brand/40 hover:text-foreground"
              }`}
            >
              <span>{r.label}</span>
              <span
                className={`h-3 w-3 shrink-0 rounded-full border ${
                  reason === r.value ? "border-brand bg-brand" : "border-border"
                }`}
              />
            </button>
          ))}
        </div>

        <label className="mt-3 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Weitere Informationen (optional)
        </label>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Beschreibe kurz, was das Problem ist …"
          className="mt-1 w-full resize-none rounded-xl border border-border bg-background/70 p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-brand/60 focus:outline-none"
        />

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Abbrechen
          </button>
          <button
            type="button"
            disabled={!reason || busy}
            onClick={() => void submit()}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Meldung senden
          </button>
        </div>
      </div>
    </div>
  );
}
