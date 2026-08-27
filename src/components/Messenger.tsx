import { CloseButton } from "@/components/ui/nav-buttons";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

/** Layout-Effekt im Browser, harmloser Effekt beim serverseitigen Rendern. */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
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
  Tag,
} from "lucide-react";
import { checkImageFile } from "@/lib/image-limits";
import { ImageWithSlangTag, SlangTagImagePlacer } from "@/components/MessengerImageTag";
import {
  IMAGE_TAG_COPY,
  defaultPlacement,
  type MediaTagPlacement,
} from "@/lib/messenger-image-tag";
import { toast } from "sonner";
import { useData } from "@/lib/data-context";
import { isMarketConversation, type ChatMessage, type ChatSlangTag } from "@/lib/social";
import {
  categoryForConversation,
  shouldResetMessengerState,
  syncCategoryForActive,
} from "@/lib/messenger-view";
import { useSocial } from "@/lib/social-context";
import { presenceDotClass, presenceLabel, presenceTextClass } from "@/lib/presence";
import { SlangTagField, SlangText, PreviewPlay } from "@/components/SlangTagInput";
import { MarketContextCard, MarketOfferCard } from "@/components/market/MarketChatCards";
import { MarketOfferDialog } from "@/components/market/MarketOfferDialog";
import {
  createMarketOffer,
  getMarketChatItems,
  listConversationOffers,
  respondMarketOffer,
} from "@/lib/market.functions";
import type { MarketChatItem, MarketOffer } from "@/lib/market-chat.server";
import { extractTagIds } from "@/lib/slangtag-ui";
import { useAudioRecorder, type RecorderError } from "@/lib/use-audio-recorder";
import { audioLog } from "@/lib/audio-log";
import { useActiveChatReporter } from "@/lib/push-active-chat";
import { sanitizeSlangTagName } from "@/lib/slangtag-rules";
import { firstWordFromTranscript } from "@/lib/slangtag-first-word";
import { transcribeChatRecording } from "@/lib/translate.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { signPaths, variantPath } from "@/lib/media";
import { marketTexts } from "@/lib/i18n-market";
import { SlangTagChip } from "@/components/SlangTagChip";
import { relativeTime, type PresenceStatus } from "@/lib/types";
import { useLang } from "@/lib/lang-context";
import { isVoiceMessage, useMessageTranslation } from "@/lib/use-message-translation";
import { MessageTranslationBar } from "@/components/MessageTranslationBar";
import { ChatLanguageBar } from "@/components/ChatLanguageBar";
import { useChatLanguage, type PartnerLang } from "@/lib/use-chat-language";
import type { TranslationLang } from "@/lib/lang-detect";

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
          <img
            src={src}
            alt={name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
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
  marketItems,
  marketCovers,
  marketOffers,
  onOfferAction,
}: {
  msg: ChatMessage;
  mine: boolean;
  myLang?: TranslationLang;
  partnerLang?: PartnerLang;
  /** Market-Artikel der Unterhaltung (nur bei Market-Nachrichten geladen). */
  marketItems?: Record<string, MarketChatItem>;
  marketCovers?: Record<string, string>;
  marketOffers?: Record<string, MarketOffer>;
  onOfferAction?: (offerId: string, action: "accept" | "decline" | "withdraw") => Promise<void>;
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
  // SlangTag-Overlay eines Bildes: oeffentlicher SlangTag (placement.tagId)
  // oder der private Chat-SlangTag dieser Nachricht.
  const publicOverlay = msg.mediaPlacement?.tagId ? getTag(msg.mediaPlacement.tagId) : undefined;
  const overlayTag = msg.mediaPlacement
    ? publicOverlay
      ? { name: publicOverlay.name, audio: publicOverlay.audio }
      : privateTag
        ? { name: privateTag.name, audio: privateTag.audio }
        : null
    : null;
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
        {msg.kind === "market_item" ? (
          msg.marketItemId && marketItems?.[msg.marketItemId] ? (
            <MarketContextCard
              item={marketItems[msg.marketItemId]}
              coverUrl={marketCovers?.[msg.marketItemId] ?? null}
              compact
            />
          ) : null
        ) : msg.kind === "market_offer" ? (
          msg.marketOfferId && marketOffers?.[msg.marketOfferId] ? (
            <MarketOfferCard
              offer={marketOffers[msg.marketOfferId]}
              isSeller={!mine}
              onRespond={async (action) => {
                if (msg.marketOfferId) await onOfferAction?.(msg.marketOfferId, action);
              }}
            />
          ) : null
        ) : msg.kind === "chat_slangtag" ? (
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
            <ImageWithSlangTag
              src={msg.media}
              placement={msg.mediaPlacement}
              name={overlayTag?.name ?? null}
              audio={overlayTag?.audio ?? null}
              playLabel={t.listen}
            />
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
  /** Manuelle Eingabe hat Vorrang: dann nie automatisch überschreiben. */
  const [nameTouched, setNameTouched] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [sttState, setSttState] = useState<"idle" | "running" | "suggested" | "none">("idle");
  const [sending, setSending] = useState(false);
  /** Konkrete Fehlermeldung je Ursache – nie ein wirkungsloser Button. */
  const recorderMessage = (reason: RecorderError) => {
    if (reason === "unsupported") return t.micUnsupported;
    if (reason === "permission") return t.micDenied;
    if (reason === "no-microphone") return t.micNoDevice;
    if (reason === "no-speech") return t.micNoSpeech;
    return t.micFailed;
  };
  const { audio, recording, seconds, duration, start, stop, reset } = useAudioRecorder(
    useCallback(
      (reason: RecorderError) => {
        toast.error(recorderMessage(reason));
      },
      // t ist pro Sprache stabil; recorderMessage liest nur daraus.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [t],
    ),
  );
  const transcribe = useServerFn(transcribeChatRecording);
  const analyzedRef = useRef<string | null>(null);

  /**
   * Nach jeder fertigen Aufnahme: Speech-to-Text auf dem Originalaudio.
   * Das erste erkannte Wort wird als SlangTag-Name vorgeschlagen – nur wenn
   * der Nutzer noch keinen Namen eingegeben hat. Keine Übersetzung.
   */
  useEffect(() => {
    if (!audio || recording || analyzedRef.current === audio) return;
    analyzedRef.current = audio;
    let cancelled = false;
    setSttState("running");
    audioLog("speech_to_text_started");
    void (async () => {
      let text = "";
      let failed = false;
      try {
        const res = await transcribe({ data: { audioDataUrl: audio } });
        text = res.text ?? "";
        audioLog("speech_to_text_success", `${text.length}chars`);
      } catch (error) {
        failed = true;
        text = "";
        audioLog("speech_to_text_error", (error as Error).message);
      }
      if (cancelled) return;
      setTranscript(text);
      // Erstes Wort aus dem ORIGINAL-Transkript (nie aus einer Uebersetzung).
      const first = firstWordFromTranscript(text);
      if (!first) {
        if (failed || !text.trim()) toast.error(t.sttFailed);
        return setSttState("none");
      }
      setName((prev) => (nameTouched || prev.trim() ? prev : first));
      setSttState("suggested");
    })();
    return () => {
      cancelled = true;
    };
  }, [audio, recording, transcribe, nameTouched, t]);

  const submit = async () => {
    const clean = sanitizeSlangTagName(name);
    if (!clean) return toast.error(t.enterTagName);
    if (!audio) return toast.error(t.recordFirst);
    setSending(true);
    audioLog("slangtag_creation_started");
    try {
      await onSend({ name: clean, audioDataUrl: audio, duration });
    } catch (error) {
      audioLog("slangtag_creation_error", (error as Error).message);
      setSending(false);
      return;
    }
    setSending(false);
    reset();
    setName("");
    setNameTouched(false);
    setTranscript("");
    setSttState("idle");
    analyzedRef.current = null;
    onClose();
  };

  return (
    <div className="mb-2 rounded-xl border border-brand/40 bg-brand/5 p-2.5">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand">
          <AudioLines className="h-3.5 w-3.5" /> {t.privateSlangTag}
        </span>
        <CloseButton onClick={onClose} label={t.close} />
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{t.privateSlangTagHint}</div>
      <div className="mt-2 flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 rounded-xl border border-border bg-background px-2.5 py-1.5">
          <span className="text-sm font-bold text-brand">$</span>
          <input
            value={name}
            onChange={(e) => {
              setNameTouched(true);
              setName(e.target.value);
            }}
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
      {sttState !== "idle" && (
        <div className="mt-1.5 text-[11px] text-muted-foreground">
          {sttState === "running" && t.sttAnalyzing}
          {sttState === "none" && t.sttNoWord}
          {sttState === "suggested" && (
            <>
              <span className="text-brand">{t.sttNameSuggested}</span>
              {transcript && (
                <span className="ml-1 opacity-80">
                  · {t.sttTranscript}: {transcript}
                </span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function Messenger({
  open,
  onClose,
  initialUserId,
  initialConversationId,
}: {
  open: boolean;
  onClose: () => void;
  initialUserId?: string | null;
  initialConversationId?: string | null;
}) {
  const { profiles, me, getTag, myTags, ensureProfileDirectory, ensureProfiles } = useData();

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
    createChatSlangTag,
    markConversationRead,
    presenceOf,
    emitTyping,
    typingIn,
    unreadInConversation,
    searchProfiles,
  } = useSocial();

  const [activeId, setActiveId] = useState<string | null>(null);
  /** Getrennte Kategorien: Connections (Standard) und Market. */
  const [view, setView] = useState<"connections" | "market">("connections");
  const chatLang = useChatLanguage(activeId);

  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showTagRecorder, setShowTagRecorder] = useState(false);
  /** Lokal ausgewähltes Bild – wird erst beim Senden hochgeladen. */
  const [pending, setPending] = useState<{
    dataUrl: string;
    isGif: boolean;
    name: string;
    placement: MediaTagPlacement | null;
    recorded: { name: string; audioDataUrl: string; duration: string } | null;
    overlay: { name: string; audio: string | null } | null;
  } | null>(null);
  // Auswahlliste vorhandener SlangTags fuer das Bild-Overlay.
  const [showTagPicker, setShowTagPicker] = useState(false);
  // Aufnahme eines neuen SlangTags fuer das Bild-Overlay.
  const [showImageRecorder, setShowImageRecorder] = useState(false);
  const [tagFilter, setTagFilter] = useState("");
  const imgTagCopy = IMAGE_TAG_COPY[lang];
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Personensuche im Messenger laeuft serverseitig und begrenzt (P-03): ohne
  // Suchbegriff nur die kleine Vorschlagsliste, mit Begriff die Treffer.
  // Die Eingabe wird kurz entprellt (eine Abfrage statt einer je Tastendruck).
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      void ensureProfileDirectory(filter);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [open, filter, ensureProfileDirectory]);

  /**
   * Chatpartner und eigene Connections gezielt per ID nachladen (P-03) –
   * unabhaengig davon, ob sie in der begrenzten Vorschlagsliste stecken.
   */
  useEffect(() => {
    if (!open) return;
    void ensureProfiles([...conversations.flatMap((c) => c.members), ...connectedIds]);
  }, [open, conversations, connectedIds, ensureProfiles]);

  // Beim Wechsel der Unterhaltung keine fremde Bildauswahl mitnehmen.
  useEffect(() => {
    setPending(null);
    setShowTagPicker(false);
    setShowImageRecorder(false);
    if (fileRef.current) fileRef.current.value = "";
  }, [activeId]);

  const openChat = async (userId: string, conversationId?: string) => {
    if (conversationId) {
      setActiveId(conversationId);
      return;
    }
    const id = await openDirectChat(userId);
    if (id) setActiveId(id);
  };

  // Zustand zuruecksetzen, wenn der Messenger ohne konkretes Ziel geoeffnet
  // oder geschlossen wird. Ohne diesen Reset blieben nach einem Market-Chat
  // sowohl die Market-Kategorie als auch die alte Unterhaltung aktiv – die
  // normalen Connection-Chats waren dann nicht erreichbar.
  useEffect(() => {
    if (
      !shouldResetMessengerState(open, {
        conversationId: initialConversationId,
        userId: initialUserId,
      })
    )
      return;
    setActiveId(null);
    setView("connections");
  }, [open, initialConversationId, initialUserId]);

  useEffect(() => {
    if (!open) return;
    // Direktes Ziel (z. B. Market-Chat): Kategorie passend mitschalten.
    if (initialConversationId) {
      setActiveId(initialConversationId);
      const conv = conversations.find((c) => c.id === initialConversationId);
      if (conv) setView(categoryForConversation(conv));
      return;
    }

    if (!initialUserId) return;
    void (async () => {
      const id = await openDirectChat(initialUserId);
      if (id) {
        setActiveId(id);
        setView("connections");
      }
    })();
    // conversations bewusst nicht als Abhaengigkeit: nur beim Oeffnen springen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialUserId, initialConversationId, openDirectChat]);

  // Kategorie folgt der tatsaechlich geoeffneten Unterhaltung, sobald diese
  // geladen ist: ein normaler Chat zeigt nie die Market-Liste und umgekehrt.
  // Pro Unterhaltung nur einmal – ein manueller Kategoriewechsel bleibt danach
  // erhalten, auch wenn die Chatliste per Realtime aktualisiert wird.
  const syncedViewFor = useRef<string | null>(null);
  useEffect(() => {
    const next = syncCategoryForActive({
      open,
      activeId,
      syncedFor: syncedViewFor.current,
      conversations,
    });
    syncedViewFor.current = next.syncedFor;
    if (next.category) setView(next.category);
  }, [open, activeId, conversations]);

  // Push-Unterdrueckung: der Worker erfaehrt, welcher Chat gerade sichtbar
  // geoeffnet ist. Feed, Hintergrund oder geschlossene App bleiben unberuehrt.
  useActiveChatReporter(open && activeId ? activeId : null);

  useEffect(() => {
    if (!activeId) return;
    void loadMessages(activeId);
    void markConversationRead(activeId);
  }, [activeId, loadMessages, markConversationRead]);

  const messages = activeId ? (messagesByConversation[activeId] ?? []) : [];

  /* ------------------------------- Market ---------------------------------- */
  // Artikelkontext und Angebote werden nur geladen, wenn die Unterhaltung
  // tatsaechlich Market-Nachrichten enthaelt.
  const marketItemIds = useMemo(
    () => Array.from(new Set(messages.map((x) => x.marketItemId).filter(Boolean) as string[])),
    [messages],
  );
  const hasMarket = marketItemIds.length > 0;
  const loadMarketItems = useServerFn(getMarketChatItems);
  const loadOffers = useServerFn(listConversationOffers);
  const sendOffer = useServerFn(createMarketOffer);
  const answerOffer = useServerFn(respondMarketOffer);

  const { data: marketItemList = [] } = useQuery({
    queryKey: ["market-chat-items", marketItemIds.join("|")],
    queryFn: () => loadMarketItems({ data: { itemIds: marketItemIds } }),
    enabled: hasMarket,
    staleTime: 60_000,
  });
  const { data: offerList = [], refetch: refetchOffers } = useQuery({
    queryKey: ["market-chat-offers", activeId],
    queryFn: () => loadOffers({ data: { conversationId: activeId! } }),
    enabled: hasMarket && !!activeId,
    staleTime: 15_000,
  });

  const marketItems = useMemo(
    () => Object.fromEntries(marketItemList.map((i) => [i.id, i])),
    [marketItemList],
  );
  const marketOffers = useMemo(
    () => Object.fromEntries(offerList.map((o) => [o.id, o])),
    [offerList],
  );
  const [marketCovers, setMarketCovers] = useState<Record<string, string>>({});
  const coverKey = marketItemList.map((i) => `${i.id}:${i.coverPath ?? ""}`).join("|");
  useEffect(() => {
    const withCover = marketItemList.filter((i) => i.coverPath);
    if (withCover.length === 0) {
      setMarketCovers({});
      return;
    }
    let alive = true;
    const paths = withCover.flatMap((i) => [variantPath(i.coverPath!, "thumb"), i.coverPath!]);
    void signPaths(paths).then((map) => {
      if (!alive) return;
      const next: Record<string, string> = {};
      for (const i of withCover) {
        const thumb = variantPath(i.coverPath!, "thumb");
        const url = (thumb && map[thumb]) ?? map[i.coverPath!];
        if (url) next[i.id] = url;
      }
      setMarketCovers(next);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coverKey]);

  /** Neuester Artikelkontext der Unterhaltung (fuer „Angebot machen“). */
  const contextItem = marketItemIds.length
    ? (marketItems[marketItemIds[marketItemIds.length - 1]] ?? null)
    : null;
  const canOffer =
    !!contextItem &&
    contextItem.sellerId !== me?.id &&
    contextItem.status !== "sold" &&
    contextItem.status !== "disabled";
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerBusy, setOfferBusy] = useState(false);

  const submitOffer = async (amountCents: number) => {
    if (!activeId || !contextItem) return;
    setOfferBusy(true);
    try {
      await sendOffer({
        data: { itemId: contextItem.id, conversationId: activeId, amountCents },
      });
      await loadMessages(activeId);
      await refetchOffers();
      setOfferOpen(false);
    } catch (err) {
      console.error("[market] offer failed", (err as Error).message);
      toast.error(marketTexts[lang].offerFailed);
    } finally {
      setOfferBusy(false);
    }
  };

  const onOfferAction = async (offerId: string, action: "accept" | "decline" | "withdraw") => {
    try {
      await answerOffer({ data: { offerId, action } });
      await refetchOffers();
    } catch (err) {
      console.error("[market] offer action failed", (err as Error).message);
      toast.error(marketTexts[lang].updateFailed);
    }
  };
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

  /** Aufraeumen der Beobachter des initialen Ans-Ende-Scrollens. */
  const anchorCleanupRef = useRef<(() => void) | null>(null);
  /** Steht das initiale Positionieren der offenen Unterhaltung noch aus? */
  const pendingInitialRef = useRef(false);

  const scrollToBottom = (smooth: boolean) => {
    const el = listRef.current;
    if (!el) return;
    // Exaktes Ende statt geschaetzter Position.
    el.scrollTo({ top: el.scrollHeight - el.clientHeight, behavior: smooth ? "smooth" : "auto" });
    nearBottomRef.current = true;
    setHasNewBelow(false);
  };

  /**
   * Initiales Positionieren: hart ans tatsaechliche Ende springen und dort
   * bleiben, solange sich die Hoehe durch nachladende Bilder, Audio oder
   * Schrift noch aendert. Endet nach kurzer Zeit oder sobald der Nutzer selbst
   * scrollt – keine Dauerueberwachung, keine Schleife.
   */
  const anchorToLatest = () => {
    const el = listRef.current;
    if (!el) return;
    anchorCleanupRef.current?.();
    pendingInitialRef.current = false;

    const pin = () => {
      el.scrollTop = el.scrollHeight - el.clientHeight;
      nearBottomRef.current = true;
    };
    pin();
    setHasNewBelow(false);

    let done = false;
    const stop = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      observer.disconnect();
      el.removeEventListener("wheel", stop);
      el.removeEventListener("touchstart", stop);
      el.removeEventListener("load", onMediaLoad, true);
      anchorCleanupRef.current = null;
    };
    const onMediaLoad = () => {
      if (!done) pin();
    };
    // Hoehenaenderungen des Inhalts (Bilder, Audio, Wellenformen) nachziehen.
    const observer = new ResizeObserver(() => {
      if (!done) pin();
    });
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);
    // Medien melden ihre fertige Groesse ueber load (Capture-Phase).
    el.addEventListener("load", onMediaLoad, true);
    el.addEventListener("wheel", stop, { passive: true });
    el.addEventListener("touchstart", stop, { passive: true });
    const timer = window.setTimeout(stop, 1500);
    anchorCleanupRef.current = stop;
  };

  // Beobachter beenden, wenn der Messenger verschwindet.
  useEffect(() => () => anchorCleanupRef.current?.(), []);

  // Nach dem tatsaechlichen Rendern der neuen Nachricht scrollen (Layout-Phase),
  // damit es keine Race Condition zwischen Eingang und Darstellung gibt.
  useIsoLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const count = messages.length;
    const switched = prevActiveRef.current !== activeId;
    prevActiveRef.current = activeId;

    if (switched) {
      prevCountRef.current = count;
      setHasNewBelow(false);
      nearBottomRef.current = true;
      anchorCleanupRef.current?.();
      // Beim Wechsel sind die Nachrichten oft noch nicht geladen – dann wird
      // das Positionieren nachgeholt, sobald sie da sind.
      if (count > 0) anchorToLatest();
      else pendingInitialRef.current = true;
      return;
    }
    // Erstes Eintreffen der Nachrichten der geoeffneten Unterhaltung.
    if (pendingInitialRef.current) {
      prevCountRef.current = count;
      if (count > 0) anchorToLatest();
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

  // Eingehende Nachricht bei geoeffnetem Chat sofort als gelesen markieren,
  // damit das Nachrichten-Symbol synchron bleibt. Nur einmal je neuer
  // Fremdnachricht – sonst entsteht eine Effekt-Schleife.
  const lastMarkedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open || !activeId) return;
    const last = messages[messages.length - 1];
    if (!last || last.senderId === me?.id) return;
    const key = `${activeId}:${last.id}`;
    if (lastMarkedRef.current === key) return;
    lastMarkedRef.current = key;
    void markConversationRead(activeId);
  }, [open, activeId, messages, me?.id, markConversationRead]);

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

  const allChats = useMemo(() => {
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

  /** Connection-Chats: alles ausser Market. */
  const chats = useMemo(
    () => allChats.filter(({ conv }) => !isMarketConversation(conv)),
    [allChats],
  );
  /** Market-Chats: ausschliesslich in der Market-Kategorie sichtbar. */
  const marketChats = useMemo(
    () => allChats.filter(({ conv }) => isMarketConversation(conv)),
    [allChats],
  );
  const marketUnread = useMemo(
    () => marketChats.reduce((sum, { conv }) => sum + unreadInConversation(conv.id), 0),
    [marketChats, unreadInConversation],
  );

  /** Nutzer, mit denen noch kein Chat existiert – bei Suche alle passenden Profile. */
  const startableIds = useMemo<string[]>(() => {
    const existing = new Set<string>(
      conversations
        .filter((c) => !isMarketConversation(c))
        .flatMap((c) => c.members.filter((m) => m !== me?.id)),
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
    if (!activeId || sending) return;
    const body = draft.trim();
    if (!body && !pending) return;
    setSending(true);
    // Frisch aufgenommenes Overlay-Audio zuerst als privaten Chat-SlangTag
    // ablegen - Bild und SlangTag bleiben getrennte Datensaetze.
    let chatSlangTagId: string | null = null;
    if (pending?.recorded) {
      chatSlangTagId = await createChatSlangTag(activeId, pending.recorded);
      if (!chatSlangTagId) {
        setSending(false);
        return;
      }
    }
    const ok = await sendMessage(activeId, {
      kind: pending ? (pending.isGif ? "gif" : "image") : "text",
      body,
      mediaDataUrl: pending?.dataUrl ?? null,
      slangTagIds: extractTagIds(body, getTag),
      chatSlangTagId,
      mediaPlacement: pending?.placement ?? null,
    });
    setSending(false);
    // Nur bei Erfolg leeren – bei Fehler bleiben Text und Bildauswahl erhalten.
    if (ok) {
      setDraft("");
      setPending(null);
      setShowTagPicker(false);
      setShowImageRecorder(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  /** Bild nur lokal als Vorschau übernehmen – Upload erst beim Senden. */
  const pickFile = async (file?: File) => {
    if (!file || !activeId) return;
    const check = await checkImageFile(file);
    if (!check.ok) {
      toast.error(
        check.reason === "bytes"
          ? t.imageTooBig
          : check.reason === "ratio"
            ? t.imageTooLong
            : t.imageTooLarge,
      );
      return;
    }
    const fr = new FileReader();
    fr.onerror = () => toast.error(t.msgSendFailed);
    fr.onload = () =>
      setPending({
        dataUrl: String(fr.result),
        isGif: file.type.includes("gif"),
        name: file.name,
        placement: null,
        recorded: null,
        overlay: null,
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
            {view === "market" ? (
              <button
                type="button"
                onClick={() => setView("connections")}
                className="inline-flex items-center gap-2 text-sm font-black tracking-tight text-brand-cyan"
              >
                <span className="text-xs text-muted-foreground">←</span>
                <Tag className="h-4 w-4" /> {marketTexts[lang].marketTitle}
              </button>
            ) : (
              <h2 className="inline-flex items-center gap-2 text-sm font-black tracking-tight">
                <MessageSquare className="h-4 w-4 text-brand" /> {t.messages}
              </h2>
            )}
            <CloseButton onClick={onClose} label={t.close} className="sm:hidden" />
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
            {/* Eigene Market-Karte: Market-Chats liegen ausschliesslich hier. */}
            {view === "connections" && (
              <button
                type="button"
                onClick={() => setView("market")}
                className="mb-2 flex w-full items-center gap-2.5 rounded-xl border border-brand-cyan/40 bg-brand-cyan/10 px-2 py-2 text-left transition-colors hover:bg-brand-cyan/20"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-brand-cyan/50 text-brand-cyan">
                  <Tag className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-brand-cyan">
                    {marketTexts[lang].marketTitle}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {marketChats.length}
                  </span>
                </span>
                {marketUnread > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-cyan px-1 text-[10px] font-bold text-primary-foreground">
                    {marketUnread}
                  </span>
                )}
              </button>
            )}

            {(view === "market" ? marketChats : chats).length === 0 && (
              <p className="px-2 py-3 text-[11px] text-muted-foreground">{t.noChats}</p>
            )}
            {(view === "market" ? marketChats : chats).map(({ conv, partner: p }) => {
              const unread = unreadInConversation(conv.id);
              const market = isMarketConversation(conv);
              return (
                <button
                  type="button"
                  key={conv.id}
                  onClick={() => {
                    if (p && !market) void openChat(p.id, conv.id);
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
                      {market ? (
                        <span className="text-brand-cyan">{marketTexts[lang].marketTitle}</span>
                      ) : p ? (
                        presenceLabel(lang, presenceOf(p.id))
                      ) : (
                        ""
                      )}{" "}
                      · {relativeTime(conv.lastMessageAt)}
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

            {view === "connections" && startableIds.length > 0 && (
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
                    <ChatLanguageBar
                      myLang={chatLang.myLang}
                      partnerLang={chatLang.partnerLang}
                      onMyLang={chatLang.setMyLang}
                      onPartnerLang={chatLang.setPartnerLang}
                    />
                  </div>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">{t.chooseChat}</span>
              )}
            </div>
            <CloseButton onClick={onClose} label={t.close} />
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
              <MessageBubble
                key={m.id}
                msg={m}
                mine={m.senderId === me?.id}
                myLang={chatLang.myLang}
                partnerLang={chatLang.partnerLang}
                marketItems={marketItems}
                marketCovers={marketCovers}
                marketOffers={marketOffers}
                onOfferAction={onOfferAction}
              />
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
              {canOffer && contextItem && (
                <div className="mb-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setOfferOpen(true)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-brand/50 px-3 text-xs font-semibold text-brand"
                  >
                    <Tag className="h-3.5 w-3.5" />
                    {marketTexts[lang].offerButton}
                  </button>
                </div>
              )}
              {contextItem && (
                <MarketOfferDialog
                  open={offerOpen}
                  itemTitle={contextItem.title}
                  itemPriceCents={contextItem.priceCents}
                  busy={offerBusy}
                  onCancel={() => setOfferOpen(false)}
                  onSubmit={(cents) => void submitOffer(cents)}
                />
              )}
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
              {pending && (
                <div className="mb-2 rounded-xl border border-border bg-background p-2">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                      {pending.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setPending(null);
                        setShowTagPicker(false);
                        setShowImageRecorder(false);
                        if (fileRef.current) fileRef.current.value = "";
                      }}
                      aria-label={t.removeImage}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:border-brand/50 hover:text-brand"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Vorschau: Bild + verschiebbares SlangTag-Overlay */}
                  <SlangTagImagePlacer
                    src={pending.dataUrl}
                    placement={pending.placement}
                    name={pending.overlay?.name ?? null}
                    audio={pending.overlay?.audio ?? null}
                    copy={imgTagCopy}
                    playLabel={t.listen}
                    onChange={(next) => setPending((p) => (p ? { ...p, placement: next } : p))}
                    onRemove={() =>
                      setPending((p) =>
                        p ? { ...p, placement: null, overlay: null, recorded: null } : p,
                      )
                    }
                  />

                  {!pending.placement && (
                    <>
                      <p className="mt-1.5 text-[10px] text-muted-foreground">{imgTagCopy.hint}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setShowImageRecorder(false);
                            setShowTagPicker((v) => !v);
                          }}
                          className="rounded-full border border-brand/50 px-2.5 py-1 text-[11px] font-semibold text-brand"
                        >
                          {imgTagCopy.chooseExisting}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowTagPicker(false);
                            setShowImageRecorder((v) => !v);
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:border-brand/50 hover:text-brand"
                        >
                          <Mic className="h-3 w-3" /> {imgTagCopy.recordNew}
                        </button>
                      </div>
                    </>
                  )}

                  {showTagPicker && (
                    <div className="mt-2 rounded-xl border border-border p-2">
                      <input
                        value={tagFilter}
                        onChange={(e) => setTagFilter(e.target.value)}
                        placeholder={imgTagCopy.searchPh}
                        aria-label={imgTagCopy.searchPh}
                        className="mb-1.5 w-full rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-brand"
                      />
                      <div className="max-h-32 space-y-1 overflow-y-auto">
                        {myTags.filter((tg) =>
                          tg.name.toLowerCase().includes(tagFilter.trim().toLowerCase()),
                        ).length === 0 && (
                          <p className="text-[11px] text-muted-foreground">{imgTagCopy.noTags}</p>
                        )}
                        {myTags
                          .filter((tg) =>
                            tg.name.toLowerCase().includes(tagFilter.trim().toLowerCase()),
                          )
                          .slice(0, 30)
                          .map((tg) => (
                            <button
                              type="button"
                              key={tg.id}
                              onClick={() => {
                                setPending((p) =>
                                  p
                                    ? {
                                        ...p,
                                        placement: defaultPlacement(tg.id),
                                        recorded: null,
                                        overlay: { name: tg.name, audio: tg.audio },
                                      }
                                    : p,
                                );
                                setShowTagPicker(false);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs hover:bg-brand/10"
                            >
                              <span className="font-bold text-brand">${tg.name}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {tg.duration}
                              </span>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  {showImageRecorder && (
                    <PrivateSlangTagRecorder
                      onSend={async (input) => {
                        setPending((p) =>
                          p
                            ? {
                                ...p,
                                recorded: input,
                                placement: defaultPlacement(null),
                                overlay: { name: input.name, audio: input.audioDataUrl },
                              }
                            : p,
                        );
                      }}
                      onClose={() => setShowImageRecorder(false)}
                    />
                  )}
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
                  onChange={(e) => void pickFile(e.target.files?.[0])}
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
                    autoGrow
                    maxRows={4}
                    value={draft}
                    onChange={(v) => {
                      setDraft(v);
                      emitTyping(activeId);
                    }}
                    onSubmit={() => void send()}
                    region={me?.location ?? ""}
                    placeholder={t.messagePh}
                    aria-label={t.messagePh}
                    className="resize-none"
                  />
                </div>
                <button
                  onClick={() => void send()}
                  disabled={(!draft.trim() && !pending) || sending}
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
