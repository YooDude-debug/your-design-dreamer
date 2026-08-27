import { CloseButton } from "@/components/ui/nav-buttons";
import { X, Download } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

import { SLANGTAG_INFO_DOC } from "@/lib/slangtag-docs";

/**
 * PDF-Viewer innerhalb der Y-Dude-Oberflaeche (kein neues Browserfenster).
 * Wird von Creator- und Unternehmer-Bereich gemeinsam genutzt.
 */
export function SlangTagInfoViewer({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#000000]">
      <header className="flex items-center gap-3 border-b border-border px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{SLANGTAG_INFO_DOC.title}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {SLANGTAG_INFO_DOC.documentTitle}
          </p>
        </div>
        <a
          href={SLANGTAG_INFO_DOC.path}
          download
          aria-label="PDF herunterladen"
          title="PDF herunterladen"
          className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-brand/60 hover:text-brand"
        >
          <Download className="h-4 w-4" />
        </a>
        <CloseButton onClick={onClose} label="Schließen" />
      </header>
      <div className="min-h-0 flex-1 bg-[#000000]">
        <object
          data={`${SLANGTAG_INFO_DOC.path}#view=FitH`}
          type="application/pdf"
          className="h-full w-full"
          aria-label={SLANGTAG_INFO_DOC.documentTitle}
        >
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
            <p>Die Vorschau kann auf diesem Gerät nicht angezeigt werden.</p>
            <a
              href={SLANGTAG_INFO_DOC.path}
              download
              className="rounded-full border border-brand/50 px-4 py-2 text-brand"
            >
              PDF herunterladen
            </a>
          </div>
        </object>
      </div>
    </div>,
    document.body,
  );
}
