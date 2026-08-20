import { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Send,
  Smile,
  Image as ImageIcon,
  AudioLines,
  Mic,
  Square,
  Globe,
  Search,
  MessageSquare,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/lib/data-context";
import { type ChatMessage, type ChatSlangTag } from "@/lib/social";
import { useSocial } from "@/lib/social-context";
import { presenceDotClass, presenceLabel, presenceTextClass } from "@/lib/presence";
import { SlangTagField, SlangText, PreviewPlay } from "@/components/SlangTagInput";
import { extractTagIds } from "@/lib/slangtag-ui";
import { useAudioRecorder } from "@/lib/use-audio-recorder";
import { sanitizeSlangTagName } from "@/lib/slangtag-rules";
import { SlangTagChip } from "@/components/SlangTagChip";
import { relativeTime, type PresenceStatus } from "@/lib/types";
import { useLang } from "@/lib/lang-context";
import { isVoiceMessage, useMessageTranslation } from "@/lib/use-message-translation";
import { MessageTranslationBar } from "@/components/MessageTranslationBar";

const EMOJIS = ["😀", "😂", "🔥", "❤️", "🎧", "🙌", "👀", "💚", "✌️", "🤙", "🌍", "🎤"];

function Avatar({
  src,
  name,
  status,
}: {
  src: string | null;
  name: string;
  status?: PresenceStatus;
}) {
  return (
    <div className="relative h-9 w-9 shrink-0">
      <div className="h-9 w-9 overflow-hidden rounded-full border border-brand/40 bg-gradient-to-br from-brand/40 to-brand-cyan/40">
        {src ? (
          <img src={src} alt={name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-xs font-black text-brand">
            {name.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      {status !== undefined && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${presenceDotClass(status)}`}
        />
      )}
    </div>
  );
}

/** Privater Chat-SlangTag – gleiches Audiosystem, aber nur im Chat sichtbar. */
function PrivateSlangTagBubble({ tag }: { tag: ChatSlangTag }) {
  const { t } = useLang();
  return (
    <div className="flex items-center gap-2 rounded-xl border border-brand/40 bg-brand/10 px-2 py-1.5 backdrop-blur-xl">
      <PreviewPlay src={tag.audio} label={t.listen} />
      <span className="min-w-0 truncate text-sm font-bold text-brand">${tag.name}</span>
      <span className="shrink-0 text-[10px] text-muted-foreground">{tag.duration}</span>
      <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
    </div>
  );
}

function MessageBubble({
  msg,
  mine,
  myLang,
  partnerLang,
}: {
  msg: ChatMessage;
  mine: boolean;
  myLang?: TranslationLang;
  partnerLang?: PartnerLang;
}) {
  const { getTag } = useData();
  const { chatSlangTags } = useSocial();
  const { t, locale } = useLang();
  const privateTag = msg.chatSlangTagId ? chatSlangTags[msg.chatSlangTagId] : undefined;
  // Übersetzung nur für empfangene Nachrichten – eigene Texte bleiben im Original.
  const tr = useMessageTranslation(msg, !mine, {
    target: myLang,
    assumedSource: partnerLang === "auto" ? undefined : partnerLang,
  });
  const isVoice = isVoiceMessage(msg);
  const bodyText = isVoice ? (msg.body ?? "") : tr.displayText;

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl border px-3 py-2 backdrop-blur-xl ${
          mine
            ? "border-[var(--msg-mine-border)] bg-[var(--msg-mine-bg)]"
            : "border-[var(--msg-theirs-border)] bg-[var(--msg-theirs-bg)]"
        }`}
      >
        {msg.kind === "chat_slangtag" ? (
          privateTag ? (
            <PrivateSlangTagBubble tag={privateTag} />
          ) : null
        ) : msg.kind === "slangtag" ? (
          <div className="flex flex-wrap gap-2">
            {msg.slangTagIds.map((id) => {
              const tag = getTag(id);
              return tag ? (
                <SlangTagChip key={id} tag={tag} variant="compact" showStats={false} />
              ) : null;
            })}
          </div>
        ) : msg.kind === "audio" ? (
          msg.media ? (
            <audio controls preload="none" src={msg.media} className="h-9 w-56" />
          ) : null
        ) : msg.kind === "image" || msg.kind === "gif" ? (
          msg.media ? (
            <img src={msg.media} alt="" loading="lazy" decoding="async" className="max-h-64 rounded-xl object-cover" />
          ) : null
        ) : null}

        {bodyText && (
          <p className="whitespace-pre-wrap break-words text-sm text-foreground">
            <SlangText text={bodyText} />
          </p>
        )}

        {/* Sprachnachricht: Transkript (Original) und Übersetzung als Text */}
        {isVoice && tr.state.transcript && (
          <p className="mt-1 whitespace-pre-wrap break-words text-xs italic text-muted-foreground">
            <span className="not-italic font-semibold">{t.trTranscript}: </span>
            {tr.state.transcript}
          </p>
        )}
        {isVoice && tr.hasTranslation && !tr.showOriginal && (
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">
            {tr.translation}
          </p>
        )}

        {!mine && (
          <MessageTranslationBar
            state={tr.state}
            target={tr.target}
            showOriginal={tr.showOriginal}
            onToggleOriginal={tr.toggleOriginal}
            onTranslate={() => void tr.translate()}
            isVoice={isVoice}
          />
        )}

        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
          {new Date(msg.createdAt).toLocaleTimeString(locale, {
            hour: "2-digit",
            minute: "2-digit",
          })}
          {mine && (
            <Globe
              className={`h-3 w-3 ${msg.readAt ? "text-brand-cyan" : "text-muted-foreground/60"}`}
              aria-label={msg.readAt ? "gelesen" : "gesendet"}
            />
          )}
        </div>
      </div>
    </div>
  );
}


/** Aufnahme-Panel für private Chat-SlangTags (ersetzt Sprachnachrichten). */
function PrivateSlangTagRecorder({
  onSend,
  onClose,
}: {
  onSend: (input: { name: string; audioDataUrl: string; duration: string }) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useLang();
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  const { audio, recording, seconds, duration, start, stop, reset } = useAudioRecorder(() =>
    toast.error(t.micDenied),
  );

  const submit = async () => {
    const clean = sanitizeSlangTagName(name);
    if (!clean) return toast.error(t.enterTagName);
    if (!audio) return toast.error(t.recordFirst);
    setSending(true);
    await onSend({ name: clean, audioDataUrl: audio, duration });
    setSending(false);
    reset();
    setName("");
    onClose();
  };

  return (
    <div className="mb-2 rounded-xl border border-brand/40 bg-brand/5 p-2.5">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand">
          <AudioLines className="h-3.5 w-3.5" /> {t.privateSlangTag}
        </span>
        <button
          onClick={onClose}
          aria-label={t.close}
          className="text-muted-foreground hover:text-brand"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{t.privateSlangTagHint}</div>
      <div className="mt-2 flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 rounded-xl border border-border bg-background px-2.5 py-1.5">
          <span className="text-sm font-bold text-brand">$</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.namePh}
            aria-label={t.namePh}
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
        {!recording ? (
          <button
            type="button"
            onClick={() => void start()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-brand/60 px-3 py-1.5 text-xs font-semibold text-brand"
          >
            <Mic className="h-3 w-3" /> {audio ? t.recordAgain : t.record}
          </button>
        ) : (
          <button
            type="button"
            onClick={stop}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-destructive px-3 py-1.5 text-xs font-semibold text-white"
          >
            <Square className="h-3 w-3" /> {t.stop} {seconds}s
          </button>
        )}
        {audio && !recording && <PreviewPlay src={audio} label={t.listen} />}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!audio || recording || sending}
          aria-label={t.send}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-brand text-primary-foreground disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function Messenger({
  open,
  onClose,
  initialUserId,
}: {
  open: boolean;
  onClose: () => void;
  initialUserId?: string | null;
}) {
  const { profiles, me, getTag } = useData();
  const { t, lang } = useLang();
  const {
    conversations,
    messagesByConversation,
    connectedIds,
    openDirectChat,
    loadMessages,
    loadOlderMessages,
    hasMoreMessages,
    sendMessage,
    sendChatSlangTag,
    markConversationRead,
    presenceOf,
    emitTyping,
    typingIn,
    unreadInConversation,
    searchProfiles,
  } = useSocial();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showTagRecorder, setShowTagRecorder] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const openChat = async (userId: string, conversationId?: string) => {
    if (conversationId) {
      setActiveId(conversationId);
      return;
    }
    const id = await openDirectChat(userId);
    if (id) setActiveId(id);
  };

  useEffect(() => {
    if (!open || !initialUserId) return;
    void (async () => {
      const id = await openDirectChat(initialUserId);
      if (id) setActiveId(id);
    })();
  }, [open, initialUserId, openDirectChat]);

  useEffect(() => {
    if (!activeId) return;
    void loadMessages(activeId);
    void markConversationRead(activeId);
  }, [activeId, loadMessages, markConversationRead]);

  const messages = activeId ? (messagesByConversation[activeId] ?? []) : [];
  const canLoadOlder = activeId ? Boolean(hasMoreMessages[activeId]) : false;
  const [loadingOlder, setLoadingOlder] = useState(false);

  /**
   * Scroll-Verhalten: unten bleiben, wenn der Nutzer unten ist – sonst
   * Leseposition halten und nur einen Hinweis anzeigen.
   */
  const nearBottomRef = useRef(true);
  const prevCountRef = useRef(0);
  const prevActiveRef = useRef<string | null>(null);
  const [hasNewBelow, setHasNewBelow] = useState(false);

  const scrollToBottom = (smooth: boolean) => {
    const el = listRef.current;
    if (!el) return;
    const jump = () => el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    jump();
    // Bilder/Medien aendern die Hoehe erst nach dem Laden – zwei Nachlaeufe.
    requestAnimationFrame(jump);
    window.setTimeout(jump, 250);
    nearBottomRef.current = true;
    setHasNewBelow(false);
  };

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const count = messages.length;
    const switched = prevActiveRef.current !== activeId;
    prevActiveRef.current = activeId;

    if (switched) {
      prevCountRef.current = count;
      setHasNewBelow(false);
      nearBottomRef.current = true;
      if (count > 0) scrollToBottom(false);
      return;
    }
    if (count <= prevCountRef.current) {
      prevCountRef.current = count;
      return;
    }
    prevCountRef.current = count;
    const last = messages[count - 1];
    const mine = last?.senderId === me?.id;
    if (mine || nearBottomRef.current) scrollToBottom(true);
    else setHasNewBelow(true);
  }, [messages, activeId, me?.id]);


  const showOlder = async () => {
    if (!activeId || loadingOlder) return;
    setLoadingOlder(true);
    const el = listRef.current;
    const before = el?.scrollHeight ?? 0;
    await loadOlderMessages(activeId);
    setLoadingOlder(false);
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - before;
    });
  };

  const chats = useMemo(() => {
    const key = filter.trim().toLowerCase();
    return conversations
      .map((c) => {
        const partnerId = c.members.find((m) => m !== me?.id) ?? null;
        return { conv: c, partner: partnerId ? profiles[partnerId] : undefined };
      })
      .filter(({ partner }) =>
        !key
          ? true
          : (partner?.username ?? "").toLowerCase().includes(key) ||
            (partner?.displayName ?? "").toLowerCase().includes(key),
      );
  }, [conversations, profiles, me, filter]);

  /** Nutzer, mit denen noch kein Chat existiert – bei Suche alle passenden Profile. */
  const startableIds = useMemo<string[]>(() => {
    const existing = new Set<string>(
      conversations.flatMap((c) => c.members.filter((m) => m !== me?.id)),
    );
    const base: string[] = filter.trim() ? searchProfiles(filter).map((p) => p.id) : connectedIds;
    return Array.from(new Set(base)).filter((id) => id !== me?.id && !existing.has(id));
  }, [conversations, me, filter, searchProfiles, connectedIds]);

  const activeConv = conversations.find((c) => c.id === activeId) ?? null;
  const partnerId = activeConv?.members.find((m) => m !== me?.id) ?? null;
  const partner = partnerId ? profiles[partnerId] : undefined;
  const partnerTyping = activeId ? (typingIn[activeId] ?? []).length > 0 : false;

  if (!open) return null;

  const send = async () => {
    if (!activeId || !draft.trim()) return;
    const body = draft.trim();
    setDraft("");
    await sendMessage(activeId, { kind: "text", body, slangTagIds: extractTagIds(body, getTag) });
  };

  const pickFile = (file?: File) => {
    if (!file || !activeId) return;
    const fr = new FileReader();
    fr.onload = () =>
      void sendMessage(activeId, {
        kind: file.type.includes("gif") ? "gif" : "image",
        mediaDataUrl: String(fr.result),
      });
    fr.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-2 backdrop-blur-sm sm:p-4">
      <div className="flex h-full max-h-[860px] w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-surface shadow-glow">
        {/* Chatliste */}
        <div
          className={`w-full shrink-0 border-r border-border sm:w-[280px] ${activeId ? "hidden sm:block" : "block"}`}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="inline-flex items-center gap-2 text-sm font-black tracking-tight">
              <MessageSquare className="h-4 w-4 text-brand" /> {t.messages}
            </h2>
            <button
              onClick={onClose}
              aria-label={t.close}
              className="text-muted-foreground hover:text-brand sm:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="px-3 py-2">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5">
              <Search className="h-3.5 w-3.5 text-brand" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t.searchConnection}
                className="w-full bg-transparent text-xs outline-none"
              />
            </div>
          </div>
          <div className="max-h-[calc(100%-104px)] overflow-y-auto px-2 pb-3">
            {chats.length === 0 && (
              <p className="px-2 py-3 text-[11px] text-muted-foreground">{t.noChats}</p>
            )}
            {chats.map(({ conv, partner: p }) => {
              const unread = unreadInConversation(conv.id);
              return (
                <button
                  type="button"
                  key={conv.id}
                  onClick={() => {
                    if (p) void openChat(p.id, conv.id);
                    else setActiveId(conv.id);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-brand/10 ${
                    activeId === conv.id ? "bg-brand/10" : ""
                  }`}
                >
                  <Avatar
                    src={p?.avatar ?? null}
                    name={p?.displayName ?? "?"}
                    status={p ? presenceOf(p.id) : undefined}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      @{p?.username ?? t.unknown}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {p ? presenceLabel(lang, presenceOf(p.id)) : ""} ·{" "}
                      {relativeTime(conv.lastMessageAt)}
                    </div>
                  </div>
                  {unread > 0 && (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-primary-foreground">
                      {unread}
                    </span>
                  )}
                </button>
              );
            })}

            {startableIds.length > 0 && (
              <>
                <div className="mt-3 px-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {t.newConversation}
                </div>
                {startableIds.map((id) => {
                  const p = profiles[id];
                  if (!p) return null;
                  return (
                    <button
                      type="button"
                      key={id}
                      onClick={() => void openChat(id)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-brand/10"
                    >
                      <Avatar src={p.avatar} name={p.displayName} status={presenceOf(id)} />
                      <span className="truncate text-xs">@{p.username}</span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {/* Chatfenster */}
        <div className={`flex min-w-0 flex-1 flex-col ${activeId ? "flex" : "hidden sm:flex"}`}>
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <button
                onClick={() => setActiveId(null)}
                className="text-xs text-muted-foreground sm:hidden"
              >
                ←
              </button>
              {partner ? (
                <>
                  <Avatar
                    src={partner.avatar}
                    name={partner.displayName}
                    status={presenceOf(partner.id)}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">@{partner.username}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {partnerTyping ? (
                        <span className="text-brand">{t.typing}</span>
                      ) : presenceOf(partner.id) !== "offline" ? (
                        <span className={presenceTextClass(presenceOf(partner.id))}>
                          {presenceLabel(lang, presenceOf(partner.id))}
                        </span>
                      ) : (
                        `${t.lastActive} ${relativeTime(activeConv?.lastMessageAt ?? Date.now())}`
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">{t.chooseChat}</span>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label={t.close}
              className="text-muted-foreground hover:text-brand"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div
            ref={listRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
              nearBottomRef.current = near;
              if (near && hasNewBelow) setHasNewBelow(false);
              if (el.scrollTop < 40 && canLoadOlder && !loadingOlder) void showOlder();
            }}
            className="relative flex-1 space-y-2 overflow-y-auto px-4 py-4"
          >
            {activeId && canLoadOlder && (
              <div className="flex justify-center">
                <button
                  onClick={() => void showOlder()}
                  disabled={loadingOlder}
                  className="rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground transition-colors hover:border-brand/50 hover:text-brand disabled:opacity-50"
                >
                  {t.loadMore}
                </button>
              </div>
            )}
            {activeId && messages.length === 0 && (
              <p className="text-center text-xs text-muted-foreground">{t.noMessages}</p>
            )}
            {messages.map((m) => (
              <MessageBubble key={m.id} msg={m} mine={m.senderId === me?.id} />
            ))}
          </div>

          {activeId && hasNewBelow && (
            <div className="pointer-events-none relative">
              <button
                onClick={() => scrollToBottom(true)}
                className="pointer-events-auto absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-brand/50 bg-background/95 px-3 py-1 text-[11px] font-bold text-brand shadow-lg backdrop-blur"
              >
                {t.newMessageHint}
              </button>
            </div>
          )}

          {activeId && (
            <div className="relative border-t border-border px-3 py-2.5">
              {showTagRecorder && (
                <PrivateSlangTagRecorder
                  onSend={(input) => sendChatSlangTag(activeId, input)}
                  onClose={() => setShowTagRecorder(false)}
                />
              )}
              {showEmoji && (
                <div className="mb-2 flex flex-wrap gap-1 rounded-xl border border-border bg-background p-2">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={() => setDraft((d) => d + e)}
                      className="text-lg hover:scale-110"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2">
                <button
                  onClick={() => setShowEmoji((v) => !v)}
                  aria-label={t.emojis}
                  className="p-1.5 text-muted-foreground hover:text-brand"
                >
                  <Smile className="h-4 w-4" />
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  aria-label={t.imageOrGif}
                  className="p-1.5 text-muted-foreground hover:text-brand"
                >
                  <ImageIcon className="h-4 w-4" />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,image/gif"
                  className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0])}
                />
                <button
                  onClick={() => setShowTagRecorder((v) => !v)}
                  aria-label={t.privateSlangTag}
                  className={`p-1.5 ${showTagRecorder ? "text-brand" : "text-muted-foreground hover:text-brand"}`}
                >
                  <AudioLines className="h-4 w-4" />
                </button>
                <div className="min-h-9 flex-1 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-brand">
                  <SlangTagField
                    multiline
                    rows={1}
                    value={draft}
                    onChange={(v) => {
                      setDraft(v);
                      emitTyping(activeId);
                    }}
                    onSubmit={() => void send()}
                    region={me?.location ?? ""}
                    placeholder={t.messagePh}
                    aria-label={t.messagePh}
                    className="max-h-28 resize-none"
                  />
                </div>
                <button
                  onClick={() => void send()}
                  disabled={!draft.trim()}
                  aria-label={t.send}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-brand text-primary-foreground disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
