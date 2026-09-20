/**
 * Eingabe und Verlauf des ORB Core.
 *
 * Die Entscheidung des ORB (antworten, nachfragen, erinnern, warnen,
 * schweigen) wird sichtbar mitgeführt – der Ablauf bleibt nachvollziehbar.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SendHorizontal } from "lucide-react";

import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  OrbComposerAttachments,
  type OrbAttachment,
} from "@/components/orb/OrbComposerAttachments";
import { Button } from "@/components/ui/button";

type Message = { id: string; role: "user" | "orb"; body: string; decision: string | null };

const DECISION_LABEL: Record<string, string> = {
  answer: "antworten",
  ask: "nachfragen",
  remind: "erinnern",
  warn: "warnen",
  // Interner Steuerwert: kein eigener Gesprächsimpuls – keine Pause.
  stay_silent: "kein eigener Impuls",
};

type Props = {
  messages: Message[];
  pending: boolean;
  onSend: (text: string, images: { mimeType: string; dataBase64: string }[]) => void;
  /** Der Benutzer tippt gerade (für die Kernpräsenz: dann keine Frage). */
  onTypingChange?: (typing: boolean) => void;
  /** Jede Benutzeraktivität im Chat (setzt die Leerlaufzeit zurück). */
  onActivity?: () => void;
  /** Bestehende Sprachsteuerung innerhalb derselben Eingabezone. */
  voiceControls?: ReactNode;
};

export function OrbChat({
  messages,
  pending,
  onSend,
  onTypingChange,
  onActivity,
  voiceControls,
}: Props) {
  const [text, setText] = useState("");
  // Bildanhänge der aktuellen Nachricht – flüchtig, nur Anfragekontext.
  const [attachments, setAttachments] = useState<OrbAttachment[]>([]);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  // Scrollbereich des Verlaufs – nur DIESER darf automatisch bewegt werden.
  const paneRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // preventScroll: Fokus darf die Seitenposition nicht verändern.
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const pane = paneRef.current;
    if (pane) {
      // Nur nachführen, wenn der Verlauf bereits (nahe) am Ende steht.
      const distance = pane.scrollHeight - pane.scrollTop - pane.clientHeight;
      if (distance <= 80) pane.scrollTop = pane.scrollHeight;
    }
    if (!pending) inputRef.current?.focus({ preventScroll: true });
  }, [messages.length, pending]);

  const typingTimer = useRef<number | null>(null);

  /** Tippen melden und nach kurzer Pause wieder zurücknehmen. */
  const markTyping = () => {
    onActivity?.();
    onTypingChange?.(true);
    if (typingTimer.current !== null) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => onTypingChange?.(false), 2500);
  };

  useEffect(() => {
    return () => {
      if (typingTimer.current !== null) window.clearTimeout(typingTimer.current);
    };
  }, []);

  const submit = () => {
    const value = text.trim();
    if (pending) return;
    // Text, Bild oder beides gemeinsam.
    if (!value && attachments.length === 0) return;
    onActivity?.();
    onTypingChange?.(false);
    onSend(
      value.slice(0, 1000),
      attachments.map((a) => ({ mimeType: a.mimeType, dataBase64: a.dataBase64 })),
    );
    setText("");
    setAttachments([]);
  };

  return (
    <section
      aria-label="Gespräch mit ORB"
      className="overflow-hidden rounded-lg border border-border bg-surface/70 shadow-subtle"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-brand">Gespräch</p>
          <h2 className="text-sm font-bold text-foreground">Mit ORB sprechen</h2>
        </div>
        <span className="text-[10px] text-muted-foreground">Text oder Stimme</span>
      </div>

      <div
        ref={paneRef}
        className="h-[20rem] overflow-y-auto bg-background/50 p-3 sm:h-[24rem] sm:p-4"
      >
        <div className="flex flex-col gap-3">
          {messages.length === 0 && (
            <div className="grid min-h-52 place-content-center gap-1 py-8 text-center">
              <p className="text-sm font-semibold text-foreground">ORB ist bereit</p>
              <p className="text-xs text-muted-foreground">
                Schreib eine Nachricht oder sprich direkt mit ORB.
              </p>
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={
                  m.role === "user"
                    ? "max-w-[85%] rounded-lg bg-primary px-3 py-2 text-primary-foreground"
                    : "max-w-[92%] px-1 py-1 text-foreground"
                }
              >
                {m.role === "orb" && m.decision && (
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {DECISION_LABEL[m.decision] ?? m.decision}
                  </span>
                )}
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.body}</p>
              </div>
            </div>
          ))}
          {pending && (
            <div className="px-1 py-1">
              <Shimmer className="text-sm">ORB denkt nach …</Shimmer>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t border-border p-2.5 sm:p-3">
        <div className="rounded-lg border border-border bg-background">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              markTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
            maxLength={1000}
            placeholder="Nachricht schreiben …"
            className="block min-h-14 w-full resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <div className="flex min-h-11 items-center justify-between gap-2 border-t border-border px-2 py-1.5">
            <OrbComposerAttachments
              attachments={attachments}
              onChange={setAttachments}
              disabled={pending}
              onActivity={onActivity}
            />
            <div className="min-w-0 flex-1">{voiceControls}</div>
            <Button
              type="button"
              size="icon"
              onClick={submit}
              disabled={pending || (text.trim().length === 0 && attachments.length === 0)}
              aria-label="Nachricht senden"
              className="size-9 rounded-full bg-brand text-primary-foreground hover:bg-brand/90"
            >
              <SendHorizontal className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
