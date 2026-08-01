import { Bot } from "lucide-react";

/** Unverwechselbare Kennzeichnung für Testbot-Konten. */
export function TestBotBadge({ className = "" }: { className?: string }) {
  return (
    <span
      title="Dieses Konto ist ein Testbot (nur Entwicklungsmodus)"
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-destructive/50 bg-destructive/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-destructive ${className}`}
    >
      <Bot className="h-3 w-3" /> Testbot
    </span>
  );
}
