/**
 * Eingabe und Verlauf des ORB Core.
 *
 * Die Entscheidung des ORB (antworten, nachfragen, erinnern, warnen,
 * schweigen) wird sichtbar mitgeführt – der Ablauf bleibt nachvollziehbar.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { SendHorizontal } from "lucide-react";

import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  OrbComposerAttachments,
  type OrbAttachment,
} from "@/components/orb/OrbComposerAttachments";
import { OrbVisualMessage, type OrbVisualItem } from "@/components/orb/OrbVisualMessage";
import { Button } from "@/components/ui/button";
import { isTouchDevice } from "@/lib/mobile-keyboard";
import { ORB_MESSAGE_MAX_CHARS, ORB_MESSAGE_TOO_LONG } from "@/lib/orb-attachments";
import { toast } from "sonner";

type Message = { id: string; role: "user" | "orb"; body: string; decision: string | null };

const CHAT_BOTTOM_THRESHOLD = 80;

/**
 * Vom Nutzer gesendete Bilder – nur für die laufende Sitzung im Speicher
 * des Browsers (Data-URLs). Nie gespeichert, nie Teil des Nachrichtentexts.
 */
export type SentImageGroup = {
  key: string;
  images: string[];
  /** Nachrichten-IDs, die beim Absenden bereits existierten. */
  knownIds: string[];
  status: "sending" | "sent" | "failed";
  sawPending: boolean;
  messageId: string | null;
};

/** Ordnet jede offene Bildgruppe der ersten neuen eigenen Nachricht zu. */
// eslint-disable-next-line react-refresh/only-export-components
export function bindSentImages(
  groups: SentImageGroup[],
  messages: { id: string; role: string }[],
  pending: boolean,
): SentImageGroup[] {
  let changed = false;
  const bound = new Set(groups.map((g) => g.messageId).filter(Boolean));
  const next = groups.map((g) => {
    if (g.status !== "sending") return g;
    const known = new Set(g.knownIds);
    const hit = messages.find((m) => m.role === "user" && !known.has(m.id) && !bound.has(m.id));
    if (hit) {
      bound.add(hit.id);
      changed = true;
      return { ...g, status: "sent" as const, messageId: hit.id };
    }
    if (pending && !g.sawPending) {
      changed = true;
      return { ...g, sawPending: true };
    }
    if (!pending && g.sawPending) {
      changed = true;
      return { ...g, status: "failed" as const };
    }
    return g;
  });
  return changed ? next : groups;
}

function SentImageThumbs({ images }: { images: string[] }) {
  return (
    <div className="mb-1.5 flex flex-wrap justify-end gap-1.5" data-testid="orb-sent-images">
      {images.map((src, i) => (
        <img
          key={i}
          src={src}
          alt={`Gesendetes Bild ${i + 1}`}
          className="size-20 rounded-md border border-primary-foreground/20 object-cover"
        />
      ))}
    </div>
  );
}
const LIVE_TEXT_INTERVAL_MS = 42;

/** Wort-/Whitespace-Blöcke, deren Verkettung den gelieferten Text exakt erhält. */
// Testbare UI-Helfer bleiben hier, weil sie ausschließlich dieses Rendering steuern.
// eslint-disable-next-line react-refresh/only-export-components
export function splitLiveText(text: string): string[] {
  return text.match(/[^\s]+\s*|\s+/g) ?? [];
}

// eslint-disable-next-line react-refresh/only-export-components
export function isNearChatBottom({
  scrollHeight,
  scrollTop,
  clientHeight,
}: {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
}): boolean {
  return scrollHeight - scrollTop - clientHeight <= CHAT_BOTTOM_THRESHOLD;
}

/**
 * Programmatischer Fokus nur auf Desktop: Auf Touch-Geräten öffnet jeder
 * Fokusaufruf die Bildschirmtastatur – der Input darf dort nur durch
 * bewusstes Antippen des Nutzers fokussiert werden, niemals durch eine
 * ORB-Antwort.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function shouldAutoFocusInput(): boolean {
  return !isTouchDevice();
}

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

function OrbMessageBody({
  body,
  animate,
  onLiveStart,
  onLiveProgress,
  onLiveComplete,
}: {
  body: string;
  animate: boolean;
  onLiveStart: () => void;
  onLiveProgress: () => void;
  onLiveComplete: () => void;
}) {
  // Ob diese konkrete Nachricht live erscheint, wird beim Einfügen festgelegt.
  // Spätere Parent-Renders dürfen eine laufende Ausgabe nicht zurücksetzen.
  const [shouldAnimate] = useState(animate);
  const [visibleBody, setVisibleBody] = useState(shouldAnimate ? "" : body);

  useEffect(() => {
    if (!shouldAnimate) {
      setVisibleBody(body);
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisibleBody(body);
      onLiveStart();
      onLiveProgress();
      onLiveComplete();
      return;
    }

    const chunks = splitLiveText(body);
    if (chunks.length === 0) {
      setVisibleBody(body);
      onLiveComplete();
      return;
    }

    let index = 0;
    let visible = "";
    let timer: number | null = null;
    onLiveStart();

    const revealNext = () => {
      visible += chunks[index] ?? "";
      index += 1;
      setVisibleBody(index === chunks.length ? body : visible);
      onLiveProgress();

      if (index < chunks.length) {
        timer = window.setTimeout(revealNext, LIVE_TEXT_INTERVAL_MS);
      } else {
        onLiveComplete();
      }
    };

    revealNext();
    return () => {
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [body, onLiveComplete, onLiveProgress, onLiveStart, shouldAnimate]);

  return (
    <p aria-busy={visibleBody !== body} className="whitespace-pre-wrap text-sm leading-relaxed">
      {visibleBody}
    </p>
  );
}

export function OrbChat({
  messages,
  pending,
  onSend,
  onTypingChange,
  onActivity,
  voiceControls,
  headerActions,
  glass = false,
  visuals = [],
}: Props & { glass?: boolean; visuals?: OrbVisualItem[]; headerActions?: ReactNode }) {
  const [text, setText] = useState("");
  // Bildanhänge der aktuellen Nachricht – flüchtig, nur Anfragekontext.
  const [attachments, setAttachments] = useState<OrbAttachment[]>([]);
  // Bereits gesendete Bilder: nur diese Sitzung, nach Neuladen nicht mehr da.
  const [sentImages, setSentImages] = useState<SentImageGroup[]>([]);
  useEffect(() => {
    setSentImages((prev) => bindSentImages(prev, messages, pending));
  }, [messages, pending]);
  const imagesByMessage = new Map(
    sentImages.filter((g) => g.messageId).map((g) => [g.messageId as string, g.images]),
  );
  const openImageGroups = sentImages.filter((g) => g.status !== "sent");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  // Scrollbereich des Verlaufs – nur DIESER darf automatisch bewegt werden.
  const paneRef = useRef<HTMLDivElement | null>(null);
  const autoFollowRef = useRef(true);
  const followFrameRef = useRef<number | null>(null);
  const pendingCycleRef = useRef(pending);
  const knownMessageIdsRef = useRef(new Set(messages.map((message) => message.id)));

  useEffect(() => {
    // preventScroll: Fokus darf die Seitenposition nicht verändern.
    // Touch: kein Auto-Fokus – sonst öffnet sich die Tastatur ungewollt.
    if (shouldAutoFocusInput()) inputRef.current?.focus({ preventScroll: true });
  }, []);

  // Erstes Befüllen des Verlaufs: einmalig ans Ende scrollen, danach gilt
  // die 80px-Nähe. (Beim ersten Rendern steht scrollTop auf 0, obwohl die
  // vorhandene Historie bereits gerendert ist – die Nähe-Prüfung würde dort
  // niemals greifen.)
  const initialScrollDone = useRef(false);

  const scheduleFollow = useCallback((force = false) => {
    if (!force && !autoFollowRef.current) return;
    if (followFrameRef.current !== null) return;

    followFrameRef.current = window.requestAnimationFrame(() => {
      followFrameRef.current = null;
      const pane = paneRef.current;
      if (pane && (force || autoFollowRef.current)) pane.scrollTop = pane.scrollHeight;
    });
  }, []);

  const handleLiveStart = useCallback(() => {
    // Jede neu beginnende ORB-Antwort hängt zunächst am unteren Ende.
    autoFollowRef.current = true;
    scheduleFollow(true);
  }, [scheduleFollow]);

  const handleLiveProgress = useCallback(() => {
    scheduleFollow();
  }, [scheduleFollow]);

  const handleLiveComplete = useCallback(() => {
    scheduleFollow();
  }, [scheduleFollow]);

  useEffect(() => {
    if (pending) pendingCycleRef.current = true;
  }, [pending]);

  useEffect(() => {
    const hasNewOrbMessage = messages.some(
      (message) => message.role === "orb" && !knownMessageIdsRef.current.has(message.id),
    );
    if (pendingCycleRef.current && hasNewOrbMessage) pendingCycleRef.current = false;
    for (const message of messages) knownMessageIdsRef.current.add(message.id);
  }, [messages]);

  useEffect(() => {
    return () => {
      if (followFrameRef.current !== null) window.cancelAnimationFrame(followFrameRef.current);
    };
  }, []);

  useEffect(() => {
    const pane = paneRef.current;
    if (pane) {
      if (!initialScrollDone.current) {
        if (messages.length > 0) {
          initialScrollDone.current = true;
          pane.scrollTop = pane.scrollHeight;
        }
      } else {
        // Nur nachführen, wenn der Verlauf bereits (nahe) am Ende steht.
        const distance = pane.scrollHeight - pane.scrollTop - pane.clientHeight;
        if (distance <= 80) pane.scrollTop = pane.scrollHeight;
      }
    }
    // Re-Fokus nach eintreffender ORB-Antwort nur auf Desktop; auf Touch
    // würde hier die Tastatur aufgehen, ohne dass der Nutzer tippte.
    if (!pending && shouldAutoFocusInput()) inputRef.current?.focus({ preventScroll: true });
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

  // UTF-16-Zählung wie String.length – identisch zur Server-Prüfung.
  const charCount = text.trim().length;
  const tooLong = charCount > ORB_MESSAGE_MAX_CHARS;

  const submit = () => {
    const value = text.trim();
    if (pending) return;
    // Text, Bild oder beides gemeinsam.
    if (!value && attachments.length === 0) return;
    // Nie still kürzen: zu lange Nachricht bleibt im Feld, Hinweis erklärt warum.
    if (value.length > ORB_MESSAGE_MAX_CHARS) {
      toast.error(ORB_MESSAGE_TOO_LONG);
      return;
    }
    onActivity?.();
    onTypingChange?.(false);
    if (attachments.length > 0) {
      setSentImages((prev) => [
        ...prev,
        {
          key: `${Date.now()}-${prev.length}`,
          images: attachments.map((a) => `data:${a.mimeType};base64,${a.dataBase64}`),
          knownIds: messages.map((m) => m.id),
          status: "sending",
          sawPending: false,
          messageId: null,
        },
      ]);
    }
    onSend(
      value,
      attachments.map((a) => ({ mimeType: a.mimeType, dataBase64: a.dataBase64 })),
    );
    setText("");
    setAttachments([]);
  };

  return (
    <section
      aria-label="Gespräch mit ORB"
      className={
        glass
          ? "overflow-hidden rounded-lg border border-border/60 bg-surface/35 shadow-subtle backdrop-blur-[3px]"
          : "overflow-hidden rounded-lg border border-border bg-surface/70 shadow-subtle"
      }
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-brand">Gespräch</p>
          <h2 className="text-sm font-bold text-foreground">Mit ORB sprechen</h2>
        </div>
        {headerActions ?? (
          <span className="text-[10px] text-muted-foreground">Text oder Stimme</span>
        )}
      </div>

      <div
        ref={paneRef}
        onScroll={(event) => {
          autoFollowRef.current = isNearChatBottom(event.currentTarget);
        }}
        className={`h-[20rem] overflow-y-auto p-3 sm:h-[24rem] sm:p-4 lg:h-[max(12rem,calc(100dvh-30rem))] ${glass ? "bg-background/20" : "bg-background/50"}`}
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
          {messages.map((m) => {
            const animate =
              m.role === "orb" && pendingCycleRef.current && !knownMessageIdsRef.current.has(m.id);

            const visualsHere = visuals.filter((v) => v.afterMessageId === m.id);
            return (
              <div key={m.id} className="flex flex-col gap-3">
                <div className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
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
                    {m.role === "orb" ? (
                      <OrbMessageBody
                        body={m.body}
                        animate={animate}
                        onLiveStart={handleLiveStart}
                        onLiveProgress={handleLiveProgress}
                        onLiveComplete={handleLiveComplete}
                      />
                    ) : (
                      <>
                        {imagesByMessage.has(m.id) && (
                          <SentImageThumbs images={imagesByMessage.get(m.id) ?? []} />
                        )}
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.body}</p>
                      </>
                    )}
                  </div>
                </div>
                {visualsHere.map((v) => (
                  <OrbVisualMessage key={v.key} item={v} />
                ))}
              </div>
            );
          })}
          {visuals
            .filter((v) => !messages.some((m) => m.id === v.afterMessageId))
            .map((v) => (
              <OrbVisualMessage key={v.key} item={v} />
            ))}
          {openImageGroups.map((g) => (
            <div key={g.key} className="flex justify-end" data-testid="orb-sent-images-open">
              <div className="max-w-[85%] rounded-lg bg-primary px-3 py-2 text-primary-foreground">
                <SentImageThumbs images={g.images} />
                <p className="text-right text-[11px] opacity-80" role="status">
                  {g.status === "failed"
                    ? "Senden fehlgeschlagen – Bilder wurden nicht übertragen."
                    : "Wird gesendet …"}
                </p>
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

      <div className="border-t border-border p-2.5 sm:p-3 lg:p-2">
        <div
          className={`rounded-lg border border-border ${glass ? "bg-background/85 backdrop-blur-md" : "bg-background"}`}
        >
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
            aria-describedby="orb-char-count"
            aria-invalid={tooLong || undefined}
            placeholder="Nachricht schreiben …"
            className="block min-h-14 w-full resize-none bg-transparent px-3 py-2.5 lg:min-h-10 lg:py-2 text-sm outline-none placeholder:text-muted-foreground"
          />
          <div className="flex min-h-11 items-center justify-between gap-2 border-t border-border px-2 py-1.5">
            <OrbComposerAttachments
              attachments={attachments}
              onChange={setAttachments}
              disabled={pending}
              onActivity={onActivity}
            />
            <div className="min-w-0 flex-1">{voiceControls}</div>
            <span
              id="orb-char-count"
              data-testid="orb-char-count"
              aria-live="polite"
              className={`shrink-0 text-[11px] tabular-nums ${tooLong ? "font-medium text-destructive" : "text-muted-foreground"}`}
              title={tooLong ? ORB_MESSAGE_TOO_LONG : undefined}
            >
              {charCount.toLocaleString("de-DE")} / {ORB_MESSAGE_MAX_CHARS.toLocaleString("de-DE")}
            </span>
            <Button
              type="button"
              size="icon"
              onClick={submit}
              disabled={
                pending || tooLong || (text.trim().length === 0 && attachments.length === 0)
              }
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
