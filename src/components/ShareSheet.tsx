import { CloseButton } from "@/components/ui/nav-buttons";
import { useEffect } from "react";
import { Check, Copy, Mail, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/lang-context";
import {
  SHARE_TARGETS,
  canWebShare,
  copyLink,
  nativeShare,
  openShareTarget,
  type SharePayload,
  type ShareTargetId,
} from "@/lib/share";

/** Plattform-Icons: Lucide für generische Kanäle, schlanke Marken-SVGs für X/Facebook. */
function TargetIcon({ id }: { id: ShareTargetId }) {
  if (id === "whatsapp") return <MessageCircle className="h-5 w-5" />;
  if (id === "email") return <Mail className="h-5 w-5" />;
  if (id === "x")
    return (
      <svg viewBox="0 0 24 24" aria-hidden className="h-4.5 w-4.5 fill-current">
        <path d="M18.9 2h3.3l-7.2 8.3L23 22h-6.6l-5.2-6.8L5.3 22H2l7.7-8.8L1.6 2h6.7l4.8 6.4L18.9 2Zm-1.2 18h1.8L7.4 3.9H5.5L17.7 20Z" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 fill-current">
      <path d="M13.5 22v-8h2.8l.4-3.3h-3.2V8.6c0-.9.3-1.6 1.6-1.6h1.7V4c-.3 0-1.3-.1-2.4-.1-2.4 0-4.1 1.5-4.1 4.2v2.6H7.5V14h2.8v8h3.2Z" />
    </svg>
  );
}

/**
 * Teilen-Menü: Bottom Sheet auf Mobilgeräten, Dialog auf Desktop.
 * Wird nur für öffentliche Beiträge geöffnet.
 */
export function ShareSheet({
  payload,
  onClose,
  onShared,
}: {
  payload: SharePayload;
  onClose: () => void;
  onShared?: () => void;
}) {
  const { t } = useLang();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const finish = () => {
    onShared?.();
  };

  const handleCopy = async () => {
    const ok = await copyLink(payload.url);
    if (ok) {
      toast.success("Link erfolgreich kopiert.");
      finish();
      onClose();
    } else {
      toast.error("Link konnte nicht kopiert werden.");
    }
  };

  const handleNative = async () => {
    const ok = await nativeShare(payload);
    if (ok) {
      finish();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[220] flex items-end justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t.share}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full animate-in slide-in-from-bottom-6 duration-200 overflow-hidden rounded-t-2xl border border-border bg-surface/95 shadow-glow sm:max-w-md sm:rounded-2xl sm:slide-in-from-bottom-2"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border/60 p-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
              <Share2 className="h-4 w-4 text-brand" /> {t.share}
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {payload.title} · {payload.author}
            </p>
          </div>
          <CloseButton onClick={onClose} label="Schließen" className="shrink-0" />
        </div>

        <div className="flex items-center gap-3 p-4">
          {payload.image ? (
            <img
              src={payload.image}
              alt=""
              loading="lazy"
              className="h-14 w-14 shrink-0 rounded-xl border border-border object-cover"
            />
          ) : (
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-dashed border-border text-muted-foreground">
              <Share2 className="h-5 w-5" />
            </div>
          )}
          <p className="min-w-0 flex-1 break-all rounded-xl border border-border bg-background/60 px-3 py-2 text-[11px] text-muted-foreground">
            {payload.url}
          </p>
        </div>

        <div className="grid grid-cols-4 gap-2 px-4">
          {SHARE_TARGETS.map((target) => (
            <button
              key={target.id}
              type="button"
              onClick={() => {
                openShareTarget(target, payload);
                finish();
                onClose();
              }}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-transparent p-2 transition-colors hover:border-border hover:bg-brand/5"
            >
              <span
                className={`grid h-11 w-11 place-items-center rounded-full border transition-transform hover:scale-105 ${target.accent}`}
              >
                <TargetIcon id={target.id} />
              </span>
              <span className="text-[10px] text-muted-foreground">{target.label}</span>
            </button>
          ))}
        </div>

        <div className="space-y-2 p-4">
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="flex w-full items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-xs text-foreground transition-colors hover:border-brand/60 hover:text-brand"
          >
            <Copy className="h-4 w-4 text-brand" /> Link kopieren
          </button>
          {canWebShare() && (
            <button
              type="button"
              onClick={() => void handleNative()}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-brand px-4 py-2.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Check className="h-4 w-4" /> Mit anderen Apps teilen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
