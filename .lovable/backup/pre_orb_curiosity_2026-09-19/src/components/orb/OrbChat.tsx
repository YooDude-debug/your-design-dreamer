/**
 * Eingabe und Verlauf des ORB Core.
 *
 * Die Entscheidung des ORB (antworten, nachfragen, erinnern, warnen,
 * schweigen) wird sichtbar mitgeführt – der Ablauf bleibt nachvollziehbar.
 */

import { useEffect, useRef, useState } from "react";
import { Loader2, SendHorizontal } from "lucide-react";

type Message = { id: string; role: "user" | "orb"; body: string; decision: string | null };

const DECISION_LABEL: Record<string, string> = {
  answer: "antworten",
  ask: "nachfragen",
  remind: "erinnern",
  warn: "warnen",
  stay_silent: "schweigen",
};

type Props = {
  messages: Message[];
  pending: boolean;
  onSend: (text: string) => void;
};

export function OrbChat({ messages, pending, onSend }: Props) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
    if (!pending) inputRef.current?.focus();
  }, [messages.length, pending]);

  const submit = () => {
    const value = text.trim();
    if (!value || pending) return;
    onSend(value.slice(0, 1000));
    setText("");
  };

  return (
    <div className="space-y-3">
      <div className="max-h-[22rem] space-y-2 overflow-y-auto rounded-xl border border-border bg-background p-3">
        {messages.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Sprich mit dem ORB. Bedeutende Erfahrungen bleiben in seinem Gedächtnis.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
            {m.role === "user" ? (
              <p className="max-w-[85%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground">
                {m.body}
              </p>
            ) : (
              <div className="max-w-[92%]">
                {m.decision && (
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {DECISION_LABEL[m.decision] ?? m.decision}
                  </span>
                )}
                <p className="text-sm leading-relaxed text-foreground">{m.body}</p>
              </div>
            )}
          </div>
        ))}
        {pending && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> ORB denkt nach …
          </p>
        )}
        <div ref={endRef} />
      </div>

      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={2}
          maxLength={1000}
          placeholder="Erfahrung, Frage oder Hinweis …"
          className="min-h-[3rem] flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <button
          onClick={submit}
          disabled={pending || text.trim().length === 0}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-primary-foreground disabled:opacity-40"
          aria-label="Senden"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizontal className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
