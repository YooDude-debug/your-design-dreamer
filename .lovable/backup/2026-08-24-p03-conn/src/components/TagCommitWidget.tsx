import { Loader2, Check, AlertTriangle, X, Upload, Bot } from "lucide-react";
import type { TagCommitStatus } from "@/lib/tag-commit-status";

/**
 * Kleines Status-Widget: fuehrt freundlich durch Upload und KI-Pruefung neuer
 * SlangTags. Waehrend der Verarbeitung erscheinen keine Fehlermeldungen.
 */
export function TagCommitWidget({ status }: { status: TagCommitStatus }) {
  const map = {
    upload: {
      icon: <Upload className="h-5 w-5 text-brand" />,
      title: "📤 SlangTag wird hinzugefügt...",
      text: "Der SlangTag wird sicher hochgeladen und verarbeitet.",
    },
    moderation: {
      icon: <Bot className="h-5 w-5 text-brand-cyan" />,
      title: "🤖 SlangTag wird von der KI geprüft...",
      text: "Die Moderation prüft den Inhalt automatisch. Das dauert nur einen Moment.",
    },
    success: {
      icon: <Check className="h-5 w-5 text-brand" />,
      title: "✅ SlangTag erfolgreich geprüft",
      text: "Dein SlangTag ist bereit und wurde deiner SlangBox hinzugefügt. Der Beitrag wird jetzt veröffentlicht.",
    },
    error: {
      icon: <X className="h-5 w-5 text-destructive" />,
      title: "❌ Upload fehlgeschlagen",
      text: status.detail || "Bitte versuche es in einem Moment erneut.",
    },
    rejected: {
      icon: <AlertTriangle className="h-5 w-5 text-destructive" />,
      title: "⚠️ Der SlangTag konnte nicht freigegeben werden.",
      text: status.detail || "Bitte überprüfe den Inhalt und versuche es erneut.",
    },
  } as const;

  const view = map[status.phase];
  const busy = status.phase === "upload" || status.phase === "moderation";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-[200] w-[min(92vw,20rem)] animate-scale-in rounded-2xl border border-border bg-surface/95 p-4 shadow-glow backdrop-blur-sm"
    >
      <div className="flex items-start gap-3">
        <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-background">
          {busy ? (
            <>
              <Loader2 className="absolute h-8 w-8 animate-spin text-brand/40" />
              {view.icon}
            </>
          ) : (
            <span className={status.phase === "success" ? "animate-scale-in" : ""}>
              {view.icon}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug">{view.title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{view.text}</p>
        </div>
      </div>
      {busy && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-border">
          <div className="h-full w-1/2 animate-[slide-in-right_1.2s_ease-in-out_infinite] rounded-full bg-gradient-brand" />
        </div>
      )}
    </div>
  );
}
