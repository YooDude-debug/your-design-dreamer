/**
 * Admin-Cockpit – Sicherheitsbestätigung für kritische Aktionen.
 *
 * Der Dialog führt selbst **keine** Aktion aus: er sammelt nur die Bestätigung
 * (und optional Grund/Dauer bzw. eine Tippbestätigung des Benutzernamens) und
 * ruft `onConfirm` erst beim ausdrücklichen Klick auf den Bestätigen-Button.
 * Abbrechen, Klick auf den Hintergrund, ESC oder Zurück ändern nichts.
 *
 * Bewusst als Portal über dem Dashboard (fixed, eigener Scrollbereich), damit
 * er auf dem Smartphone zuverlässig sichtbar ist und nicht durch Scrollen im
 * Dashboard versehentlich ausgelöst werden kann.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AdminButton, AdminInput } from "./AdminUI";

export type AdminConfirmRequest = {
  /** Überschrift, z. B. „Benutzer sperren?“ */
  title: string;
  /** Frage mit betroffenem Benutzer, z. B. „Möchtest du @Pit86 wirklich sperren?“ */
  message: string;
  /** Zusätzlicher Warnhinweis (z. B. „kann nicht rückgängig gemacht werden“). */
  warning?: string;
  /** Beschriftung des Bestätigen-Buttons. */
  confirmLabel: string;
  variant?: "default" | "danger";
  /** Pflichtfeld „Grund“ (Verwarnung/Sperre). */
  reason?: { label: string; placeholder?: string };
  /** Optionales Dauerfeld in Tagen (0 = dauerhaft). */
  days?: { label: string; initial: string };
  /** Erst nach exakter Eingabe dieses Textes ist die Bestätigung aktiv. */
  requireText?: string;
  onConfirm: (input: { reason: string; days: number }) => void;
};

export function AdminConfirmDialog({
  request,
  onClose,
}: {
  request: AdminConfirmRequest | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("");
  const [typed, setTyped] = useState("");

  // Beim Öffnen immer mit leeren Feldern starten (keine Übernahme von vorher).
  useEffect(() => {
    if (!request) return;
    setReason("");
    setDays(request.days?.initial ?? "");
    setTyped("");
  }, [request]);

  useEffect(() => {
    if (!request) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [request, onClose]);

  if (!request || typeof document === "undefined") return null;

  const reasonOk = !request.reason || reason.trim().length > 0;
  const typedOk = !request.requireText || typed.trim() === request.requireText;
  const canConfirm = reasonOk && typedOk;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={request.title}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-background p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-foreground">{request.title}</p>
        <p className="mt-1.5 text-xs text-muted-foreground">{request.message}</p>
        {request.warning && (
          <p className="mt-1.5 text-xs font-semibold text-destructive">{request.warning}</p>
        )}

        {request.reason && (
          <label className="mt-3 block">
            <span className="text-[10px] uppercase tracking-widest text-brand">
              {request.reason.label}
            </span>
            <AdminInput
              value={reason}
              onChange={setReason}
              placeholder={request.reason.placeholder}
              className="mt-1 w-full"
            />
          </label>
        )}

        {request.days && (
          <label className="mt-3 block">
            <span className="text-[10px] uppercase tracking-widest text-brand">
              {request.days.label}
            </span>
            <AdminInput value={days} onChange={setDays} type="number" className="mt-1 w-full" />
          </label>
        )}

        {request.requireText && (
          <label className="mt-3 block">
            <span className="text-[10px] uppercase tracking-widest text-destructive">
              Gib {request.requireText} ein, um das Löschen zu bestätigen
            </span>
            <AdminInput
              value={typed}
              onChange={setTyped}
              placeholder={request.requireText}
              className="mt-1 w-full"
            />
          </label>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <AdminButton onClick={onClose}>Abbrechen</AdminButton>
          <AdminButton
            variant={request.variant === "danger" ? "danger" : "primary"}
            disabled={!canConfirm}
            onClick={() => {
              if (!canConfirm) return;
              const payload = { reason: reason.trim(), days: Number(days) || 0 };
              onClose();
              request.onConfirm(payload);
            }}
          >
            {request.confirmLabel}
          </AdminButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
