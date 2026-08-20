import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AudioLines, Globe, Image as ImageIcon, Send, Smile, X } from "lucide-react";
import { MessageTranslationBar } from "@/components/MessageTranslationBar";
import type { TranslationState } from "@/lib/use-message-translation";

/**
 * Reine Demo-Ansicht für Social-Media-Clips: statischer Beispiel-Chat mit
 * einem fiktiven Testnutzer (@nikos_demo). Es werden keine echten Nutzer,
 * Namen oder Nachrichten geladen und die echte Übersetzungsfunktion bleibt
 * unangetastet – hier werden nur vorbereitete Texte angezeigt.
 */
export const Route = createFileRoute("/demo/messenger")({
  head: () => ({
    meta: [
      { title: "Y-Dude Messenger Demo – Deutsch ↔ Griechisch" },
      {
        name: "description",
        content:
          "Demo-Ansicht des Y-Dude Messengers: Nachrichten werden automatisch zwischen Deutsch und Griechisch übersetzt.",
      },
      { property: "og:title", content: "Y-Dude Messenger Demo – Deutsch ↔ Griechisch" },
      {
        property: "og:description",
        content: "Deutsch schreiben, Griechisch verstehen – der Y-Dude Messenger in der Demo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DemoMessenger,
});

const DEMO_USER = "nikos_demo";

/** Empfangene Nachricht mit Original/Übersetzung – Optik wie im echten Chat. */
function IncomingDemoBubble({
  original,
  translation,
  time,
}: {
  original: string;
  translation: string;
  time: string;
}) {
  const [showOriginal, setShowOriginal] = useState(false);
  const state: TranslationState = {
    status: "ready",
    sourceLanguage: "el",
    transcript: null,
    text: translation,
  };

  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] rounded-2xl border border-[var(--msg-theirs-border)] bg-[var(--msg-theirs-bg)] px-3 py-2 backdrop-blur-xl">
        <p className="whitespace-pre-wrap break-words text-sm text-foreground">
          {showOriginal ? original : translation}
        </p>
        <MessageTranslationBar
          state={state}
          target="de"
          showOriginal={showOriginal}
          onToggleOriginal={() => setShowOriginal((v) => !v)}
          onTranslate={() => {}}
          isVoice={false}
        />
        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
          {time}
        </div>
      </div>
    </div>
  );
}

/** Eigene Nachricht – bleibt immer im Original. */
function OutgoingDemoBubble({ body, time }: { body: string; time: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl border border-[var(--msg-mine-border)] bg-[var(--msg-mine-bg)] px-3 py-2 backdrop-blur-xl">
        <p className="whitespace-pre-wrap break-words text-sm text-foreground">{body}</p>
        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
          {time}
          <Globe className="h-3 w-3 text-brand-cyan" aria-label="gelesen" />
        </div>
      </div>
    </div>
  );
}

function DemoMessenger() {
  const [draft, setDraft] = useState("");

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-2 sm:p-4">
      <div className="flex h-[100dvh] max-h-[860px] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-glow">
        {/* Kopfzeile */}
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="text-xs text-muted-foreground">←</span>
            <div className="relative h-9 w-9 shrink-0">
              <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-brand/40 bg-gradient-to-br from-brand/40 to-brand-cyan/40 text-xs font-black text-brand">
                N
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-brand" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">@{DEMO_USER}</div>
              <div className="truncate text-[11px] text-muted-foreground">zuletzt aktiv jetzt</div>
              <div className="inline-flex max-w-full items-center gap-1 truncate text-[11px] font-semibold text-muted-foreground">
                <Globe className="h-3 w-3 shrink-0 text-brand" />
                <span className="truncate">🇩🇪 Deutsch → 🌐 Automatisch</span>
              </div>
            </div>
          </div>
          <span className="text-muted-foreground">
            <X className="h-4 w-4" />
          </span>
        </div>

        {/* Verlauf */}
        <div className="relative flex-1 space-y-2 overflow-y-auto px-4 py-4">
          <IncomingDemoBubble
            original="Γεια σου φίλε, τώρα είμαι καλά 😂 έχουμε πολλά να πούμε."
            translation="Na Alter, mir geht's jetzt gut, wir haben uns echt viel zu erzählen 😂"
            time="21:06"
          />
          <OutgoingDemoBubble body="Ja, war eine gute Idee von dir mit dem Übersetzer 😂" time="21:08" />
          <IncomingDemoBubble
            original="Έχεις ταλέντο, θα έπρεπε να γίνεις προγραμματιστής."
            translation="Du verschwendest dein Talent, du hättest Programmierer werden sollen."
            time="21:10"
          />
        </div>

        {/* Eingabe */}
        <div className="relative border-t border-border px-3 py-2.5">
          <div className="flex items-end gap-2">
            <span className="p-1.5 text-muted-foreground">
              <Smile className="h-4 w-4" />
            </span>
            <span className="p-1.5 text-muted-foreground">
              <ImageIcon className="h-4 w-4" />
            </span>
            <span className="p-1.5 text-muted-foreground">
              <AudioLines className="h-4 w-4" />
            </span>
            <div className="min-h-9 flex-1 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-brand">
              <textarea
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Nachricht schreiben — $ für SlangTag"
                aria-label="Nachricht schreiben"
                className="block w-full resize-none bg-transparent text-sm leading-5 outline-none"
              />
            </div>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-brand text-primary-foreground">
              <Send className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
