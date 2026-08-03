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
import { useData } from "@/lib/data";
import { useLang } from "@/lib/i18n";
import { formatStat, type SlangTag } from "@/lib/types";
import { SlangTagName } from "@/components/SlangTagName";
import { openUnlockPrompt } from "@/components/CreatorUnlockDialog";
import { useAudioRecorder } from "@/lib/use-audio-recorder";
import { checkSlangTagName, sanitizeSlangTagName, slangTagPrefix } from "@/lib/slangtag-rules";

/** Zeichen, die in einem SlangTag-Namen erlaubt sind (inkl. Emojis). */
const NAME_CLASS = "[\\p{L}\\p{N}\\p{M}\\p{Extended_Pictographic}\\u200d_.-]";
/** Erkennt Community- (`$`) und Creator-Tokens (`$$`). */
const TOKEN_AT_CURSOR = new RegExp(`\\$\\$?(${NAME_CLASS}*)$`, "u");
const TOKEN_GLOBAL = new RegExp(`(\\$\\$?${NAME_CLASS}+)`, "gu");

/** Findet alle in einem Text erwähnten SlangTag-IDs. */
export function extractTagIds(
  text: string,
  getTag: (idOrName: string) => SlangTag | undefined,
): string[] {
  const ids = new Set<string>();
  for (const part of text.split(TOKEN_GLOBAL)) {
    if (!part.startsWith("$")) continue;
    const tag = getTag(part.replace(/^\$\$?/, ""));
    if (tag) ids.add(tag.id);
  }
  return [...ids];
}

/** Kleiner Vorhör-Button für Audio-Schnipsel. */
export function PreviewPlay({ src, label }: { src: string | null; label?: string }) {
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => ref.current?.pause(), []);
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
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
 * Farbschema je SlangTag-Typ: Community bleibt grün (`brand`),
 * Unternehmer-/Creator-SlangTags wechseln vollständig in Marken-Blau
 * (`brand-cyan`). Wird für Rahmen, Glow, Buttons, Icons und Fokus genutzt.
 */
export function slangTagTheme(kind: SlangTagKind) {
  const business = kind === "creator";
  return {
    business,
    text: business ? "text-brand-cyan" : "text-brand",
    border: business ? "border-brand-cyan/30" : "border-brand/30",
    borderStrong: business ? "border-brand-cyan/60" : "border-brand/60",
    borderDashed: business ? "border-brand-cyan/40" : "border-brand/40",
    bgSoft: business ? "bg-brand-cyan/5" : "bg-brand/5",
    hover: business ? "hover:bg-brand-cyan/10" : "hover:bg-brand/10",
    glow: business
      ? "shadow-[0_0_20px_oklch(0.78_0.16_210/0.35)]"
      : "shadow-glow",
    solid: business
      ? "bg-brand-cyan text-background"
      : "bg-gradient-brand text-primary-foreground",
  };
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
  const { searchTags, createTag, isTagLocked, tags: allTags, canCreateBusinessTag } = useData();
  const { t } = useLang();
  const [saving, setSaving] = useState(false);
  const {
    audio,
    recording,
    seconds,
    duration,
    start: startRecording,
    stop: stopRecording,
    reset: resetRecording,
  } = useAudioRecorder(() => toast.error(t.micDenied));

  const theme = slangTagTheme(kind);
  const blocked = theme.business && !canCreateBusinessTag;

  const cleanName = sanitizeSlangTagName(query);
  const results = useMemo(() => {
    const list = searchTags(cleanName);
    // Im Unternehmermodus nur $$-SlangTags vorschlagen, sonst nur Community.
    return list.filter((tag) => (theme.business ? tag.kind === "creator" : tag.kind === "community"));
  }, [cleanName, searchTags, theme.business]);
  const noMatch = cleanName.length >= 2 && results.length === 0;

  const create = async () => {
    if (!cleanName) return toast.error(t.enterTagName);
    if (blocked) return toast.error(BUSINESS_DENIED);
    const check = checkSlangTagName(cleanName, allTags);
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
    setSaving(true);
    const tag = await createTag({
      name: cleanName,
      audioDataUrl: audio,
      region,
      duration,
      kind,
      ...(theme.business ? { ownerType: "creator" as const } : {}),
    });
    setSaving(false);
    if (!tag) return toast.error(t.tagSaveFailed);
    resetRecording();
    onSelect(tag);
    toast.success(`${slangTagPrefix(tag.kind)}${tag.name} ${t.tagCreated}`);
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
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => (locked ? openUnlockPrompt(tag) : onSelect(tag))}
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

      {noMatch && blocked && (
        <div className="rounded-lg border border-dashed border-destructive/50 bg-destructive/10 p-2.5">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-destructive">
            <ShieldAlert className="h-3.5 w-3.5" /> {BUSINESS_DENIED}
          </div>
        </div>
      )}

      {noMatch && !blocked && (
        <div className={`rounded-lg border border-dashed ${theme.borderDashed} ${theme.bgSoft} p-2.5`}>
          <div className={`text-xs font-semibold ${theme.text}`}>{t.createNewTag}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {slangTagPrefix(kind)}
            {cleanName} {t.tagNotExists}
          </div>
          <div className="mt-2 flex items-center gap-2">
            {!recording ? (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void startRecording()}
                className={`inline-flex items-center gap-1.5 rounded-full border ${theme.borderStrong} px-3 py-1 text-xs font-semibold ${theme.text}`}
              >
                <Mic className="h-3 w-3" /> {audio ? t.recordAgain : t.record}
              </button>
            ) : (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={stopRecording}
                className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-3 py-1 text-xs font-semibold text-white"
              >
                <Square className="h-3 w-3" /> {t.stop} {seconds}s
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
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void create()}
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
}: {
  anchor: HTMLElement | null;
  query: string;
  region: string;
  onSelect: (tag: SlangTag) => void;
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
      <SlangTagSuggest query={query} region={region} onSelect={onSelect} maxHeight={maxHeight} />
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
    onSubmit,
    ...rest
  },
  ref,
) {
  const { me } = useData();
  const { t } = useLang();
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [wrap, setWrap] = useState<HTMLDivElement | null>(null);
  const [token, setToken] = useState<{ query: string; start: number; end: number } | null>(null);

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }));

  const detect = (text: string, cursor: number) => {
    const match = TOKEN_AT_CURSOR.exec(text.slice(0, cursor));
    if (!match) return setToken(null);
    setToken({ query: match[1], start: cursor - match[0].length, end: cursor });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(e.target.value);
    detect(e.target.value, e.target.selectionStart ?? e.target.value.length);
  };

  const insert = (tag: SlangTag) => {
    const t0 = token ?? { start: value.length, end: value.length, query: "" };
    const prefix = slangTagPrefix(tag.kind);
    const next = `${value.slice(0, t0.start)}${prefix}${tag.name} ${value.slice(t0.end)}`;
    onChange(next);
    setToken(null);
    onTagInserted?.(tag);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      const pos = t0.start + prefix.length + tag.name.length + 1;
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
        return;
      }
      if (e.key === "Enter" && !e.shiftKey && !token && onSubmit) {
        e.preventDefault();
        onSubmit();
      }
    },
    className: `${base} ${className}`,
    ...rest,
  };

  return (
    <div className="relative" ref={setWrap}>
      {multiline ? <textarea {...shared} rows={rows} /> : <input {...shared} />}
      {token && (
        <SlangTagPopover
          anchor={wrap}
          query={token.query}
          region={region ?? me?.location ?? ""}
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
