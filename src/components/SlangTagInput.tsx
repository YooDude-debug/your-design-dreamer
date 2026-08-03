import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Mic, Square, MapPin, Play, Pause, Users, Repeat2, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/lib/data-context";
import { useLang } from "@/lib/lang-context";
import { formatStat, type SlangTag, type SlangTagKind } from "@/lib/types";
import { SlangTagName } from "@/components/SlangTagName";
import { openUnlockPrompt } from "@/lib/unlock-prompt";
import { useAudioRecorder } from "@/lib/use-audio-recorder";
import {
  closeKeyboard,
  dismissKeyboard,
  isTouchDevice,
  noKeyboardProps,
} from "@/lib/mobile-keyboard";
import { SLANGTAG_MAX_SECONDS_EXTENDED, slangTagMaxSeconds } from "@/lib/audio-format";

import {
  AudioSourceSwitch,
  AudioUploadPicker,
  type AudioSourceMode,
} from "@/components/AudioUploadPicker";

import { checkSlangTagName, sanitizeSlangTagName, slangTagPrefix } from "@/lib/slangtag-rules";
import { useDraftTagMode } from "@/lib/draft-tags";
import { TOKEN_AT_CURSOR, TOKEN_GLOBAL, extractTagIds, slangTagTheme } from "@/lib/slangtag-ui";

/** Kleiner Vorhör-Button für Audio-Schnipsel. */
export function PreviewPlay({ src, label }: { src: string | null; label?: string }) {
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => ref.current?.pause(), []);
  return (
    <button
      type="button"
      {...noKeyboardProps}
      onClick={(e) => {
        e.stopPropagation();
        if (!src) return;
        if (!ref.current) {
          ref.current = new Audio(src);
          ref.current.onended = () => setPlaying(false);
        }
        if (playing) {
          ref.current.pause();
          setPlaying(false);
        } else {
          void ref.current.play();
          setPlaying(true);
        }
      }}
      aria-label={label}
      className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-brand/60 bg-black/40 text-brand"
    >
      {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 fill-current" />}
    </button>
  );
}

/**
 * Gemeinsames $-Popup: Live-Suche über alle SlangTags und – ohne Treffer –
 * direkte Neuaufnahme (1–5 Sekunden). Wird plattformweit von jedem Textfeld
 * und vom Composer-Picker verwendet, damit das Verhalten identisch ist.
 *
 * `kind` kommt live aus der Eingabe: `$` → Community (grün),
 * `$$` → Unternehmer-/Creator-Modus (blau, nur mit Berechtigung).
 */
export function SlangTagSuggest({
  query,
  region,
  onSelect,
  maxHeight,
  kind = "community",
}: {
  query: string;
  region: string;
  onSelect: (tag: SlangTag) => void;
  maxHeight?: number;
  kind?: SlangTagKind;
}) {
  const {
    searchTags,
    createTag,
    addDraftTag,
    isTagLocked,
    tags: allTags,
    draftTags,
    canCreateBusinessTag,
    canUseExtendedAudio,
  } = useData();
  // Im Beitrags-Entwurf entsteht nur ein temporaerer SlangTag.
  const draftMode = useDraftTagMode();
  const { t } = useLang();
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<AudioSourceMode>("record");
  const [uploaded, setUploaded] = useState<{ dataUrl: string; duration: string } | null>(null);
  const theme = slangTagTheme(kind);
  const blocked = theme.business && !canCreateBusinessTag;
  // Community-SlangTags ($) immer 5 Sekunden, Creator-/Unternehmer-SlangTags ($$)
  // berechtigter Konten 10 Sekunden.
  const maxSeconds = slangTagMaxSeconds(kind, canUseExtendedAudio);
  const {
    audio: recorded,
    recording,
    seconds,
    duration: recordedDuration,
    start: startRecording,
    stop: stopRecording,
    reset: resetRecording,
  } = useAudioRecorder(() => toast.error(t.micDenied), maxSeconds);

  const audio = mode === "upload" ? (uploaded?.dataUrl ?? null) : recorded;
  const duration = mode === "upload" ? (uploaded?.duration ?? "0:01") : recordedDuration;

  const cleanName = sanitizeSlangTagName(query);
  const results = useMemo(() => {
    const matching = cleanName
      ? draftTags.filter((tag) => tag.name.toLowerCase().includes(cleanName.toLowerCase()))
      : draftTags;
    const list = [...(draftMode ? matching : []), ...searchTags(cleanName)];
    // Im Unternehmermodus nur $$-SlangTags vorschlagen, sonst nur Community.
    return list.filter((tag) =>
      theme.business ? tag.kind === "creator" : tag.kind === "community",
    );
  }, [cleanName, searchTags, theme.business, draftMode, draftTags]);
  const noMatch = cleanName.length >= 2 && results.length === 0;

  const create = async () => {
    if (!cleanName) return toast.error(t.enterTagName);
    // Ohne Berechtigung bleibt die Option einfach ohne Wirkung (keine Fehlermeldung).
    if (blocked) return;
    const check = checkSlangTagName(cleanName, [...allTags, ...draftTags]);
    if (!check.ok) {
      const msg =
        check.error === "space"
          ? t.tagNoSpaces
          : check.error === "short"
            ? t.tagTooShort
            : check.error === "long"
              ? t.tagTooLong
              : check.error === "duplicate"
                ? t.tagDuplicate
                : t.tagInvalidChars;
      return toast.error(msg);
    }
    if (!audio) return toast.error(t.recordFirst);
    const payload = {
      name: cleanName,
      audioDataUrl: audio,
      region,
      duration,
      kind,
      ...(theme.business ? { ownerType: "creator" as const } : {}),
    };
    setSaving(true);
    const tag = draftMode ? addDraftTag(payload) : await createTag(payload);
    setSaving(false);
    if (!tag) return toast.error(t.tagSaveFailed);
    resetRecording();
    setUploaded(null);
    // Erfolgsfall bleibt still: der Ablauf wird ueber das Status-Widget gezeigt.
    // Mobil: Tastatur schliessen, damit Aufnahme/Upload/Veroeffentlichen sichtbar sind.
    closeKeyboard();
    onSelect(tag);
  };

  return (
    <div
      style={{ maxHeight: maxHeight ?? 320 }}
      className={`w-full overflow-y-auto overscroll-contain rounded-xl border ${theme.border} bg-surface/95 p-1 ${theme.glow} backdrop-blur-xl`}
    >
      {/* Sichtbarer Modus */}
      {theme.business && (
        <div
          className={`mb-1 flex items-center gap-1.5 rounded-lg border ${theme.borderDashed} ${theme.bgSoft} px-2 py-1.5 text-[11px] font-bold ${theme.text}`}
        >
          <span aria-hidden>🔵</span> Unternehmer-SlangTag aktiv
        </div>
      )}

      {results.map((tag) => {
        const locked = isTagLocked(tag);
        return (
          <button
            key={tag.id}
            type="button"
            {...noKeyboardProps}
            onClick={() => {
              closeKeyboard();
              if (locked) openUnlockPrompt(tag);
              else onSelect(tag);
            }}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left ${theme.hover} ${
              locked ? "opacity-60" : ""
            }`}
          >
            <PreviewPlay src={tag.audio} label={t.listen} />
            <SlangTagName tag={tag} className="shrink-0 text-sm font-bold" />
            <span className="inline-flex min-w-0 items-center gap-1 truncate text-[11px] text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" /> {tag.region.split(",")[0]}
            </span>
            <span className="ml-auto inline-flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Repeat2 className="h-3 w-3" /> {formatStat(tag.stats.uses)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" /> @{tag.creator}
              </span>
            </span>
          </button>
        );
      })}

      {noMatch && !blocked && (
        <div
          className={`rounded-lg border border-dashed ${theme.borderDashed} ${theme.bgSoft} p-2.5`}
        >
          <div className={`text-xs font-semibold ${theme.text}`}>{t.createNewTag}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {slangTagPrefix(kind)}
            {cleanName} {t.tagNotExists}
          </div>
          <AudioSourceSwitch
            mode={mode}
            onChange={(next) => {
              if (recording) stopRecording();
              setMode(next);
            }}
            className="mt-2"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {mode === "upload" ? (
              <AudioUploadPicker
                compact
                maxSeconds={maxSeconds}
                onReady={(res) => setUploaded({ dataUrl: res.dataUrl, duration: res.duration })}
              />
            ) : !recording ? (
              <button
                type="button"
                {...noKeyboardProps}
                onClick={() => {
                  closeKeyboard();
                  void startRecording();
                }}
                className={`inline-flex items-center gap-1.5 rounded-full border ${theme.borderStrong} px-3 py-1 text-xs font-semibold ${theme.text}`}
              >
                <Mic className="h-3 w-3" /> {audio ? t.recordAgain : t.record}
              </button>
            ) : (
              <button
                type="button"
                {...noKeyboardProps}
                onClick={stopRecording}
                className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-3 py-1 text-xs font-semibold text-white"
              >
                <Square className="h-3 w-3" /> {t.stop} {seconds}s / {maxSeconds}s
              </button>
            )}
            {audio && !recording && (
              <>
                <PreviewPlay src={audio} label={t.listen} />
                <span className={`inline-flex items-center gap-1 text-[11px] ${theme.text}`}>
                  <Check className="h-3 w-3" /> {t.audioReady}
                </span>
              </>
            )}
            {recording && <Loader2 className={`h-3.5 w-3.5 animate-spin ${theme.text}`} />}
          </div>
          {mode === "upload" && (
            <p className="mt-1 text-[10px] text-muted-foreground">{t.audioUploadHint}</p>
          )}
          {maxSeconds === SLANGTAG_MAX_SECONDS_EXTENDED && (
            <p className={`mt-1 text-[10px] ${theme.text}`}>{t.tagTenSecondsHint}</p>
          )}

          <button
            type="button"
            {...noKeyboardProps}
            onClick={() => {
              closeKeyboard();
              void create();
            }}
            disabled={!audio || recording || saving}
            className={`mt-2 w-full rounded-full ${theme.solid} px-3 py-1.5 text-xs font-semibold disabled:opacity-40`}
          >
            {slangTagPrefix(kind)}
            {cleanName} {t.saveAndPlace}
          </button>
        </div>
      )}

      {!noMatch && results.length === 0 && (
        <div className="px-2.5 py-2 text-[11px] text-muted-foreground">{t.keepTyping}</div>
      )}
    </div>
  );
}

/**
 * Rendert das $-Popup als globales Portal am <body>. Dadurch kann es niemals
 * von Karten, Sidebars oder `overflow: hidden` abgeschnitten werden. Die
 * Position folgt dem Eingabefeld und klappt bei zu wenig Platz nach oben.
 */
export function SlangTagPopover({
  anchor,
  query,
  region,
  onSelect,
  kind = "community",
}: {
  anchor: HTMLElement | null;
  query: string;
  region: string;
  onSelect: (tag: SlangTag) => void;
  kind?: SlangTagKind;
}) {
  const [style, setStyle] = useState<CSSProperties | null>(null);
  const [maxHeight, setMaxHeight] = useState(320);

  useLayoutEffect(() => {
    if (!anchor || typeof window === "undefined") return;

    const update = () => {
      const r = anchor.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(Math.max(r.width, 260), vw - 16);
      const below = vh - r.bottom - 12;
      const above = r.top - 12;
      const openUp = below < 220 && above > below;
      const space = Math.max(160, Math.min(360, openUp ? above : below));
      let left = r.left;
      if (left + width > vw - 8) left = vw - 8 - width;
      if (left < 8) left = 8;
      setMaxHeight(space);
      setStyle({
        position: "fixed",
        left,
        width,
        zIndex: 9999,
        ...(openUp ? { bottom: vh - r.top + 6 } : { top: r.bottom + 6 }),
      });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const ro = new ResizeObserver(update);
    ro.observe(anchor);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      ro.disconnect();
    };
  }, [anchor, query]);

  if (typeof document === "undefined" || !style) return null;

  return createPortal(
    <div style={style}>
      <SlangTagSuggest
        query={query}
        region={region}
        onSelect={onSelect}
        maxHeight={maxHeight}
        kind={kind}
      />
    </div>,
    document.body,
  );
}

export type SlangTagFieldHandle = { focus: () => void };

type FieldProps = {
  value: string;
  onChange: (value: string) => void;
  /** Wird zusätzlich aufgerufen, wenn ein SlangTag eingefügt wurde. */
  onTagInserted?: (tag: SlangTag) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  region?: string;
  className?: string;
  disabled?: boolean;
  maxLength?: number;
  /**
   * Fokus und Cursor bleiben nach dem Einfügen eines SlangTags im Feld –
   * für Kommentare/Chats, in denen direkt weitergeschrieben wird.
   */
  keepFocus?: boolean;
  /** Enter (ohne Shift) löst diese Aktion aus, solange das Popup zu ist. */
  onSubmit?: () => void;
  "aria-label"?: string;
};


/**
 * Textfeld mit globalem $-Trigger. Sobald „$“ getippt wird, öffnet sich das
 * gemeinsame SlangTag-Popup direkt unter dem Feld. Wird plattformweit für
 * Beiträge, Kommentare, Chats, Bio und Captions verwendet.
 */
export const SlangTagField = forwardRef<SlangTagFieldHandle, FieldProps>(function SlangTagField(
  {
    value,
    onChange,
    onTagInserted,
    placeholder,
    multiline = false,
    rows = 3,
    region,
    className = "",
    disabled,
    maxLength,
    keepFocus = false,
    onSubmit,
    ...rest
  },
  ref,
) {
  const { me } = useData();
  const { t } = useLang();
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [wrap, setWrap] = useState<HTMLDivElement | null>(null);
  const [token, setToken] = useState<{
    query: string;
    start: number;
    end: number;
    kind: SlangTagKind;
  } | null>(null);

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }));

  const detect = (text: string, cursor: number) => {
    const match = TOKEN_AT_CURSOR.exec(text.slice(0, cursor));
    if (!match) return setToken(null);
    // `$$` schaltet live in den Unternehmermodus, `$` bleibt Community.
    setToken({
      query: match[1],
      start: cursor - match[0].length,
      end: cursor,
      kind: match[0].startsWith("$$") ? "creator" : "community",
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(e.target.value);
    detect(e.target.value, e.target.selectionStart ?? e.target.value.length);
  };

  const insert = (tag: SlangTag) => {
    const t0 = token ?? { start: value.length, end: value.length, query: "", kind: "community" };
    const prefix = slangTagPrefix(tag.kind);
    const next = `${value.slice(0, t0.start)}${prefix}${tag.name} ${value.slice(t0.end)}`;
    onChange(next);
    setToken(null);
    onTagInserted?.(tag);
    const pos = t0.start + prefix.length + tag.name.length + 1;

    // Kommentare/Chats: Cursor bleibt im Feld, damit direkt weitergeschrieben
    // werden kann – auch mobil. Im Composer bleibt die Tastatur geschlossen,
    // weil danach mit Aufnahme-/Upload-Buttons gearbeitet wird.
    if (!keepFocus && isTouchDevice()) {
      dismissKeyboard(inputRef.current);
      return;
    }

    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };


  const base =
    "w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60";

  const shared = {
    ref: inputRef as never,
    value,
    disabled,
    maxLength,
    placeholder: placeholder ?? t.slangTagSearchPh,
    // „Fertig“/„Weiter“ statt Zeilenumbruch auf mobilen Tastaturen.
    ...(multiline ? {} : { enterKeyHint: onSubmit ? ("send" as const) : ("done" as const) }),
    onChange: handleChange,
    onKeyUp: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      detect(e.currentTarget.value, e.currentTarget.selectionStart ?? 0),
    onClick: (e: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      detect(e.currentTarget.value, e.currentTarget.selectionStart ?? 0),
    onBlur: () => window.setTimeout(() => setToken(null), 150),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && token) {
        e.preventDefault();
        setToken(null);
        if (!keepFocus) dismissKeyboard(inputRef.current);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        // Offene SlangTag-Suche: Enter schliesst zuerst nur die Vorschlaege.
        if (token) {
          e.preventDefault();
          setToken(null);
          return;
        }
        if (onSubmit) {
          e.preventDefault();
          onSubmit();
          // Kommentare: Feld bleibt aktiv fuer den naechsten Kommentar.
          if (keepFocus) return;
        }
        if (!multiline) {
          // Bestaetigen: Vorschlaege zu UND Tastatur vollstaendig einklappen.
          e.preventDefault();
          setToken(null);
          dismissKeyboard(inputRef.current);
        }
      }
    },

    className: `${base} ${className}`,
    ...rest,
  };

  return (
    <div
      className="relative w-full"
      ref={setWrap}
      // Klick auf den Rand/Innenabstand des Feldes setzt den Cursor korrekt.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          const el = inputRef.current;
          if (!el) return;
          el.focus();
          const end = el.value.length;
          el.setSelectionRange(end, end);
        }
      }}
    >
      {multiline ? <textarea {...shared} rows={rows} /> : <input {...shared} />}
      {token && (
        <SlangTagPopover
          anchor={wrap}
          query={token.query}
          region={region ?? me?.location ?? ""}
          kind={token.kind}
          onSelect={insert}
        />
      )}
    </div>
  );

});

/**
 * Rendert Text und ersetzt jedes bekannte $SlangTag durch eine anklick- und
 * abspielbare Glass-Komponente.
 */
export function SlangText({
  text,
  onOpenTag,
  className = "",
}: {
  text: string;
  onOpenTag?: (tag: SlangTag) => void;
  className?: string;
}) {
  const { getTag, registerPlay } = useData();

  if (!text) return null;

  const nodes: ReactNode[] = text.split(TOKEN_GLOBAL).map((part, i) => {
    if (!part.startsWith("$")) return <span key={i}>{part}</span>;
    const tag = getTag(part.replace(/^\$\$?/, ""));
    if (!tag) return <span key={i}>{part}</span>;
    return <InlineSlangTag key={i} tag={tag} onOpen={onOpenTag} onPlay={registerPlay} />;
  });

  return <span className={className}>{nodes}</span>;
}

function InlineSlangTag({
  tag,
  onOpen,
  onPlay,
}: {
  tag: SlangTag;
  onOpen?: (tag: SlangTag) => void;
  onPlay: (tagId: string) => Promise<void>;
}) {
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => ref.current?.pause(), []);

  const toggle = () => {
    if (!tag.audio) return;
    if (!ref.current) {
      ref.current = new Audio(tag.audio);
      ref.current.onended = () => setPlaying(false);
    }
    if (playing) {
      ref.current.pause();
      setPlaying(false);
    } else {
      void ref.current.play();
      setPlaying(true);
      void onPlay(tag.id);
    }
  };

  return (
    <span className="mx-0.5 inline-flex items-center gap-1 rounded-full border border-brand/40 bg-white/10 px-1.5 py-0.5 align-middle backdrop-blur-md">
      <button
        type="button"
        onClick={toggle}
        aria-label={`$${tag.name}`}
        className="grid h-3.5 w-3.5 place-items-center rounded-full text-brand"
      >
        {playing ? (
          <Pause className="h-2.5 w-2.5" />
        ) : (
          <Play className="h-2.5 w-2.5 fill-current" />
        )}
      </button>
      <button
        type="button"
        onClick={() => onOpen?.(tag)}
        className="text-[11px] font-bold leading-none hover:underline"
      >
        <SlangTagName tag={tag} />
      </button>
    </span>
  );
}
