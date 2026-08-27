import { CloseButton } from "@/components/ui/nav-buttons";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, MessageSquarePlus, Send, Loader2, CheckCircle2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { feedbackListOwn, feedbackSubmit } from "@/lib/feedback.functions";
import {
  categoryLabel,
  clampFeedbackText,
  clientEnvironment,
  FEEDBACK_CATEGORIES,
  FEEDBACK_MAX_CHARS,
  FEEDBACK_MAX_LINES,
  FEEDBACK_MIN_CHARS,
  statusLabel,
  type FeedbackCategory,
  type FeedbackRow,
} from "@/lib/feedback.shared";

const STATUS_STYLE: Record<string, string> = {
  new: "border-brand/40 text-brand",
  in_progress: "border-accent/40 text-accent",
  done: "border-brand/60 bg-brand/10 text-brand",
  rejected: "border-border text-muted-foreground",
};

export function FeedbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const submit = useServerFn(feedbackSubmit);
  const loadOwn = useServerFn(feedbackListOwn);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [mounted, setMounted] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [message, setMessage] = useState("");
  const [area, setArea] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [own, setOwn] = useState<FeedbackRow[]>([]);
  const [rows, setRows] = useState(7);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onResize = () => setRows(window.innerWidth < 640 ? 4 : 7);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const env = useMemo(
    () =>
      typeof navigator === "undefined"
        ? { device: "", browser: "", os: "" }
        : clientEnvironment(navigator.userAgent, window.innerWidth),
    [open],
  );

  useEffect(() => {
    if (!open) return;
    setSent(false);
    setArea((prev) => prev || pathname);
    void loadOwn({})
      .then(setOwn)
      .catch(() => setOwn([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const lines = message ? message.split("\n").length : 0;
  const tooLong = message.length > FEEDBACK_MAX_CHARS || lines > FEEDBACK_MAX_LINES;
  const canSend = message.trim().length >= FEEDBACK_MIN_CHARS && !tooLong && !busy;

  async function send() {
    if (!canSend) return;
    setBusy(true);
    try {
      await submit({
        data: {
          category,
          message: clampFeedbackText(message),
          area: area.trim() || pathname,
          device: env.device,
          browser: env.browser,
          os: env.os,
        },
      });
      setSent(true);
      setMessage("");
      toast.success("Danke! Dein Feedback ist angekommen.");
      void loadOwn({})
        .then(setOwn)
        .catch(() => undefined);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Senden fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center overflow-hidden bg-black/85 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex h-full max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-[#000000] p-5 shadow-glow">
        {/* Header + Subtitle: bleibt auf Mobile sichtbar */}
        <div className="flex shrink-0 flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
            <h2 className="inline-flex items-center gap-2 text-lg font-black tracking-tight">
              <MessageSquarePlus className="h-5 w-5 text-brand" /> Feedback & Verbesserung
            </h2>
            <CloseButton onClick={onClose} label="Schließen" />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Sag uns, was gut läuft oder was wir verbessern sollen. Gerät, Browser und Bereich werden
            automatisch mitgesendet – ohne persönliche Inhalte.
          </p>
        </div>

        {/* Scrollbarer Inhalt: Kategorien, Formular, Buttons, Verlauf */}
        <div className="mt-4 flex-1 min-h-0 overflow-y-auto pr-1">
          {/* Kategorie */}
          <div className="flex flex-wrap gap-1.5">
            {FEEDBACK_CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                  category === c.value
                    ? "bg-brand/15 font-semibold text-brand"
                    : "border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={rows}
            placeholder="Was ist passiert? Was wünschst du dir? (max. 300 Zeilen)"
            className="mt-3 w-full resize-y rounded-xl border border-border bg-background/40 p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand/60 focus:outline-none"
          />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className={tooLong ? "text-red-400" : ""}>
              {message.length}/{FEEDBACK_MAX_CHARS} Zeichen · {lines}/{FEEDBACK_MAX_LINES} Zeilen
            </span>
          </div>

          <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Betroffener Bereich
          </label>
          <input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="z. B. Feed, Composer, Slang Globe"
            className="mt-1 w-full rounded-xl border border-border bg-background/40 px-3 py-2 text-sm focus:border-brand/60 focus:outline-none"
          />

          <div className="mt-3 rounded-xl border border-border bg-background/40 p-3 text-[11px] text-muted-foreground">
            Automatisch erfasst: {env.device || "—"} · {env.browser || "—"} · {env.os || "—"}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              Schließen
            </button>
            <button
              type="button"
              onClick={() => void send()}
              disabled={!canSend}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-background disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{" "}
              Absenden
            </button>
          </div>

          {sent && (
            <p className="mt-3 inline-flex items-center gap-2 text-xs text-brand">
              <CheckCircle2 className="h-4 w-4" /> Danke! Wir melden uns, sobald es umgesetzt ist.
            </p>
          )}

          {own.length > 0 && (
            <div className="mt-5 border-t border-border pt-4">
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Dein Feedback-Verlauf
              </h3>
              <div className="mt-2 space-y-2">
                {own.map((f) => (
                  <div key={f.id} className="rounded-xl border border-border bg-background/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-brand">
                        {categoryLabel(f.category)}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                          STATUS_STYLE[f.status] ?? "border-border text-muted-foreground"
                        }`}
                      >
                        {statusLabel(f.status)}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-xs text-foreground">{f.message}</p>
                    {f.adminNote && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Antwort: {f.adminNote}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
