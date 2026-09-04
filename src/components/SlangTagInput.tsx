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
import { getAudio } from "@/lib/autoplay";
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
import { lockFeedMode } from "@/lib/feed-mode-lock";
import {
  holdPicker,
  isPickerHeld,
  isPickerLatched,
  latchPicker,
  releasePicker,
  unlatchPicker,
} from "@/lib/slangtag-picker-hold";

import { TOKEN_AT_CURSOR, TOKEN_GLOBAL, slangTagTheme } from "@/lib/slangtag-ui";
import { MENTION_AT_CURSOR, type MentionProfile } from "@/lib/mentions";
import { MentionPopover, MentionText } from "@/components/MentionSuggest";
import { isUserEdit, noAutofillProps } from "@/lib/no-autofill";
import { HASHTAG_COLOR } from "@/lib/tag-colors";
import { useKeyboardAnchor } from "@/lib/keyboard-anchor";
import { SlangTagRecorderPanel } from "@/components/SlangTagRecorderPanel";
import { dockMaxHeight, topDock, useVisibleViewport } from "@/lib/screen-dock";

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
/**
 * Huelle des Aufnahmebereichs: mit Anker ein eigenstaendiger, frei
 * verschiebbarer Container (tastaturunabhaengig), ohne Anker inline wie bisher.
 */
function CreateShell({
  theme,
  onClose,
  children,
}: {
  theme: ReturnType<typeof slangTagTheme>;
  onClose?: () => void;
  children: ReactNode;
}) {
  const hold = {
    onPointerDownCapture: () => holdPicker(),
    onTouchStartCapture: () => holdPicker(),
    onMouseDownCapture: () => holdPicker(),
  };
  return (
    <SlangTagRecorderPanel
      onClose={onClose}
      className={`border-dashed ${theme.borderDashed} ${theme.glow}`}
    >
      <div {...hold}>{children}</div>
    </SlangTagRecorderPanel>
  );
}

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
    myTags,
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
  // Vom Nutzer geschlossener Aufnahme-Container (nur dieser Container).
  const [recorderClosed, setRecorderClosed] = useState(false);
  // AUTO REC: rein lokaler UI-State im Dialog-Lifecycle (keine Persistenz).
  const [autoRec, setAutoRec] = useState(false);
  const autoStartedFor = useRef<string | null>(null);
  useEffect(() => {
    setRecorderClosed(false);
    autoStartedFor.current = null;
  }, [cleanName]);

  const recorderVisible = noMatch && !blocked && !recorderClosed;
  useEffect(() => {
    if (!autoRec || !recorderVisible) return;
    if (mode !== "record" || recording || recorded) return;
    if (autoStartedFor.current === cleanName) return;
    autoStartedFor.current = cleanName;
    void startRecording();
  }, [autoRec, recorderVisible, mode, recording, recorded, cleanName, startRecording]);

  const create = async () => {
    if (!cleanName) return toast.error(t.enterTagName);
    // Ohne Berechtigung bleibt die Option einfach ohne Wirkung (keine Fehlermeldung).
    if (blocked) return;
    const check = checkSlangTagName(cleanName, [...myTags, ...draftTags]);
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
    // Bewusster Abschluss: die Dauer-Sperre des Popups endet hier.
    unlatchPicker();
    // Erfolgsfall bleibt still: der Ablauf wird ueber das Status-Widget gezeigt.
    // Mobil: Tastatur schliessen, damit Aufnahme/Upload/Veroeffentlichen sichtbar sind.
    closeKeyboard();
    onSelect(tag);
  };

  const showList = !noMatch;

  return (
    <>
      {showList && (
        <div
          style={{ maxHeight: maxHeight ?? 320 }}
          // Jede Beruehrung im Popup haelt es offen, bis der Klick verarbeitet ist.
          onPointerDownCapture={() => holdPicker()}
          onTouchStartCapture={() => holdPicker()}
          onMouseDownCapture={() => holdPicker()}
          className={`w-full overflow-y-auto overscroll-contain rounded-xl border ${theme.border} bg-surface/95 p-1 ${theme.glow} backdrop-blur-xl`}
        >
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

          {results.length === 0 && (
            <div className="px-2.5 py-2 text-[11px] text-muted-foreground">{t.keepTyping}</div>
          )}
        </div>
      )}

      {noMatch && !blocked && !recorderClosed && (
        <CreateShell theme={theme} onClose={() => setRecorderClosed(true)}>
          <div className={`text-xs font-semibold ${theme.text}`}>{t.createNewTag}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {slangTagPrefix(kind)}
            {cleanName} {t.tagNotExists}
          </div>
          <AudioSourceSwitch
            mode={mode}
            onChange={(next) => {
              latchPicker();
              if (recording) stopRecording();
              setMode(next);
            }}
            className="mt-2"
          />
          {/* AUTO REC + Aufnahme-Controls nebeneinander auf Desktop,
              kontrolliert umbrechend auf Mobile. Beide Buttons behalten
              dieselbe visuelle Gewichtung. */}
          <div className="mt-2 flex min-h-[30px] flex-wrap items-center gap-2">
            <button
              type="button"
              {...noKeyboardProps}
              aria-pressed={autoRec}
              onClick={() => {
                latchPicker();
                setAutoRec((v) => {
                  if (v && recording) stopRecording();
                  if (!v) autoStartedFor.current = null;
                  return !v;
                });
              }}
              className={`inline-flex items-center gap-1.5 rounded-full border ${theme.borderStrong} px-3 py-1 text-xs font-semibold ${theme.text}`}
            >
              {t.autoRec}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${autoRec ? `${theme.solid}` : "bg-muted text-muted-foreground"}`}
              >
                {autoRec ? "ON" : "OFF"}
              </span>
            </button>

            {mode === "upload" ? (
              <AudioUploadPicker
                compact
                maxSeconds={maxSeconds}
                onReady={(res) => {
                  latchPicker();
                  setUploaded({ dataUrl: res.dataUrl, duration: res.duration });
                }}
              />
            ) : !recording ? (
              <button
                type="button"
                {...noKeyboardProps}
                onClick={() => {
                  // Nur die Tastatur schliessen – das Erstellen-Fenster bleibt
                  // durch die Dauer-Sperre offen, bis bewusst beendet wird.
                  latchPicker();
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
        </CreateShell>
      )}
    </>
  );
}

/**
 * Rendert das $-Popup als globales Portal am <body>. Dadurch kann es niemals
 * von Karten, Sidebars oder `overflow: hidden` abgeschnitten werden. Die
 * Position folgt dem Eingabefeld und klappt bei zu wenig Platz nach oben.
 */
export function SlangTagPopover({
  query,
  region,
  onSelect,
  kind = "community",
}: {
  /** Nur noch fuer Aufrufer-Kompatibilitaet: Position ist viewport-verankert. */
  anchor?: HTMLElement | null;
  query: string;
  region: string;
  onSelect: (tag: SlangTag) => void;
  kind?: SlangTagKind;
}) {
  const [style, setStyle] = useState<CSSProperties | null>(null);
  const [maxHeight, setMaxHeight] = useState(320);
  // Tastatur auf/zu verändert den sichtbaren Viewport – nur darauf reagieren.
  const vpTick = useVisibleViewport();

  // Noch vor dem ersten Paint sperren: Die native Keyboard-Scrollbewegung
  // darf nicht den automatischen Feed-Modus ausloesen.
  useLayoutEffect(() => lockFeedMode(), []);

  /**
   * Viewport-verankert: das Vorschlagsfenster sitzt am oberen *sichtbaren*
   * Bildschirmbereich. Basis ist `visualViewport` (offsetTop/height), damit die
   * mobile Tastatur das Fenster nie aus dem Blickfeld schiebt. Kein Listener auf
   * Dokument-Scroll – beim Scrollen bleibt die Position unverändert.
   */
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const d = topDock();
    setMaxHeight(dockMaxHeight());
    setStyle({ position: "fixed", left: d.left, top: d.top, width: d.width, zIndex: 9999 });
  }, [vpTick]);

  if (typeof document === "undefined" || !style) return null;

  return createPortal(
    <div style={style} data-slangtag-popover="">
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
  /** Textarea wächst automatisch mit dem Inhalt bis zu `maxRows` Zeilen. */
  autoGrow?: boolean;
  /** Maximale Zeilenanzahl bei Auto-Grow (Standard: 4). */
  maxRows?: number;
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
    autoGrow = false,
    maxRows = 4,
    ...rest
  },
  ref,
) {
  const { me } = useData();
  const { t } = useLang();
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [wrap, setWrap] = useState<HTMLDivElement | null>(null);
  type Token = { query: string; start: number; end: number; kind: SlangTagKind };
  const [token, setToken] = useState<Token | null>(null);
  /** Aktive @Erwähnung am Cursor (Autovervollständigung). */
  const [mention, setMention] = useState<{ query: string; start: number; end: number } | null>(
    null,
  );

  /**
   * Letzter erkannter `$`-Ausdruck. Auf Smartphones kann das Feld beim Antippen
   * eines Vorschlags den Fokus verlieren, bevor der Klick ankommt – dann ist
   * `token` bereits null. Ohne diesen Merker wuerde der SlangTag nur als Text
   * angehaengt werden.
   */
  const lastToken = useRef<Token | null>(null);

  /**
   * Eingabezeile bleibt der stabile Bildschirmanker – auch noch kurz nach dem
   * Auswaehlen, wenn die Tastatur schliesst und das Popup schon weg ist.
   */
  useKeyboardAnchor(wrap, !!token);

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }));

  /**
   * Auto-Grow: Textarea passt ihre Höhe automatisch an den Inhalt an,
   * bis die maximale Zeilenanzahl erreicht ist. Danach wird der Inhalt
   * scrollbar. Schrumpft auch wieder beim Löschen von Text.
   *
   * Mobile-Härtung: Android/iOS liefern für `line-height` teils `normal`
   * (nicht parsebar) – dann wird aus der Schriftgröße gerechnet statt
   * abgebrochen. Zusätzlich wird direkt auf die native `input`-,
   * `compositionend`- und Viewport-Events gehört, weil die virtuelle
   * Tastatur (IME) React-Updates verzögern kann.
   */
  const resizeRef = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    const resize = () => {
      if (!autoGrow || !multiline) return;
      const el = inputRef.current as HTMLTextAreaElement | null;
      if (!el) return;
      const computed = window.getComputedStyle(el);
      let lineHeight = parseFloat(computed.lineHeight);
      if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
        const fontSize = parseFloat(computed.fontSize);
        lineHeight = Number.isFinite(fontSize) && fontSize > 0 ? fontSize * 1.25 : 20;
      }
      const paddingTop = parseFloat(computed.paddingTop) || 0;
      const paddingBottom = parseFloat(computed.paddingBottom) || 0;
      const borderTop = parseFloat(computed.borderTopWidth) || 0;
      const borderBottom = parseFloat(computed.borderBottomWidth) || 0;
      const extra =
        computed.boxSizing === "border-box"
          ? paddingTop + paddingBottom + borderTop + borderBottom
          : 0;

      const minHeight = lineHeight + extra;
      const maxHeight = maxRows * lineHeight + extra;
      el.style.height = "auto";
      el.style.overflowY = "hidden";
      const naturalHeight = el.scrollHeight;
      const nextHeight = Math.min(Math.max(naturalHeight, minHeight), maxHeight);
      el.style.height = `${nextHeight}px`;
      el.style.maxHeight = `${maxHeight}px`;
      el.style.overflowY = naturalHeight > maxHeight ? "auto" : "hidden";
    };
    resizeRef.current = resize;
    resize();
  }, [autoGrow, multiline, value, maxRows]);

  useEffect(() => {
    if (!autoGrow || !multiline) return;
    const el = inputRef.current as HTMLTextAreaElement | null;
    if (!el) return;
    const run = () => resizeRef.current();
    el.addEventListener("input", run);
    el.addEventListener("compositionend", run);
    el.addEventListener("focus", run);
    window.addEventListener("resize", run);
    window.visualViewport?.addEventListener("resize", run);
    // Erst wenn die Webfont geladen ist, stimmt die gemessene Zeilenhöhe.
    void document.fonts?.ready.then(run).catch(() => {});
    return () => {
      el.removeEventListener("input", run);
      el.removeEventListener("compositionend", run);
      el.removeEventListener("focus", run);
      window.removeEventListener("resize", run);
      window.visualViewport?.removeEventListener("resize", run);
    };
  }, [autoGrow, multiline]);

  /**
   * Bewusster Abbruch: ein Tap ausserhalb von Feld und Popup beendet den
   * SlangTag-Modus. Solange innerhalb gearbeitet wird (Tastatur, Aufnahme,
   * Dialog), bleibt der Kontext vollstaendig erhalten.
   */
  useEffect(() => {
    if (!token) return;
    const onDown = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-slangtag-popover]")) return;
      if (wrap && wrap.contains(target)) return;
      unlatchPicker();
      setToken(null);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [token, wrap]);

  /** Tap ausserhalb von Feld und Mention-Popup beendet die Mention-Suche. */
  useEffect(() => {
    if (!mention) return;
    const onDown = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-mention-popover]")) return;
      if (wrap && wrap.contains(target)) return;
      setMention(null);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [mention, wrap]);

  /** Verlaesst der Nutzer das Feld komplett, endet auch die Dauer-Sperre. */
  useEffect(() => () => unlatchPicker(), []);

  /** Manuell geschlossene Suche: dieser Ausdruck oeffnet sich nicht erneut. */
  const dismissed = useRef<string | null>(null);

  const detect = (text: string, cursor: number) => {
    // @Erwähnungen sind unabhängig von SlangTags – sie haben Vorrang, solange
    // der Cursor direkt hinter einem `@handle` steht.
    const at = MENTION_AT_CURSOR.exec(text.slice(0, cursor));
    if (at) {
      setMention({ query: at[1] ?? "", start: cursor - (at[1] ?? "").length - 1, end: cursor });
      setToken(null);
      return;
    }
    setMention(null);

    const match = TOKEN_AT_CURSOR.exec(text.slice(0, cursor));
    if (!match) {
      dismissed.current = null;
      return setToken(null);
    }

    // `$$` schaltet live in den Unternehmermodus, `$` bleibt Community.
    const next: Token = {
      query: match[1],
      start: cursor - match[0].length,
      end: cursor,
      kind: match[0].startsWith("$$") ? "creator" : "community",
    };
    // Nach manuellem Schliessen bleibt das Fenster zu, bis weitergetippt wird.
    if (dismissed.current !== null) {
      if (next.query === dismissed.current) return setToken(null);
      dismissed.current = null;
    }
    lastToken.current = next;
    setToken(next);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // Autofill/Passwortmanager dürfen SlangTag-Felder nicht befüllen und damit
    // auch nicht das SlangTag-Fenster öffnen.
    if (!isUserEdit(e)) return;
    onChange(e.target.value);
    detect(e.target.value, e.target.selectionStart ?? e.target.value.length);
  };

  /** Ermittelt den zu ersetzenden Bereich – auch ohne aktiven Fokus. */
  const resolveToken = (): Token => {
    for (const candidate of [token, lastToken.current]) {
      if (!candidate) continue;
      const slice = value.slice(candidate.start, candidate.end);
      if (slice.startsWith("$")) return candidate;
    }
    // Notfall: letzten `$`-Ausdruck im Text suchen.
    const match = TOKEN_AT_CURSOR.exec(value);
    if (match) {
      return {
        query: match[1],
        start: value.length - match[0].length,
        end: value.length,
        kind: match[0].startsWith("$$") ? "creator" : "community",
      };
    }
    return { start: value.length, end: value.length, query: "", kind: "community" };
  };

  const insert = (tag: SlangTag) => {
    releasePicker();
    const t0 = resolveToken();

    const prefix = slangTagPrefix(tag.kind);
    const head = value.slice(0, t0.start);
    // Zwischen zwei SlangTags bleibt immer ein Trennzeichen.
    const gap = head && !/\s$/.test(head) ? " " : "";
    const next = `${head}${gap}${prefix}${tag.name} ${value.slice(t0.end)}`;
    onChange(next);
    setToken(null);
    lastToken.current = null;
    onTagInserted?.(tag);
    const pos = t0.start + gap.length + prefix.length + tag.name.length + 1;

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

  /** Fügt eine ausgewählte @Erwähnung an der Cursorposition ein. */
  const insertMention = (profile: MentionProfile) => {
    const m = mention;
    if (!m) return;
    const next = `${value.slice(0, m.start)}@${profile.username} ${value.slice(m.end)}`;
    onChange(next);
    setMention(null);
    const pos = m.start + profile.username.length + 2;
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
    ...noAutofillProps,
    onChange: handleChange,
    onKeyUp: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      detect(e.currentTarget.value, e.currentTarget.selectionStart ?? 0),
    onClick: (e: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      detect(e.currentTarget.value, e.currentTarget.selectionStart ?? 0),
    // Blur schliesst die Vorschlaege nur, wenn nicht gerade im Popup
    // getippt/aufgenommen wird (mobil verliert das Feld dabei den Fokus).
    onBlur: () => {
      // Waehrend einer laufenden Aufnahme/Upload-Auswahl bleibt der
      // SlangTag-Kontext erhalten: das Popup wird nur bewusst beendet.
      const close = (retries: number) => {
        window.setTimeout(() => {
          if (isPickerLatched()) return;
          if (isPickerHeld()) {
            if (retries > 0) close(retries - 1);
            return;
          }
          setToken(null);
        }, 200);
      };
      close(30);
    },

    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && mention) {
        e.preventDefault();
        setMention(null);
        return;
      }
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

    className: `${base} ${autoGrow && multiline ? "box-border block resize-none leading-5" : ""} ${className}`,
    ...rest,
  };

  return (
    <div
      className="relative w-full"
      ref={setWrap}
      data-slangtag-input=""
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
      {mention && !token && (
        <MentionPopover anchor={wrap} query={mention.query} onSelect={insertMention} />
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
    if (!part.startsWith("$")) return <HashtaggedText key={i} text={part} />;
    const tag = getTag(part.replace(/^\$\$?/, ""));
    if (!tag) return <span key={i}>{part}</span>;
    return <InlineSlangTag key={i} tag={tag} onOpen={onOpenTag} onPlay={registerPlay} />;
  });

  return <span className={className}>{nodes}</span>;
}

/**
 * Hashtags werden plattformweit rot dargestellt – auch in Kommentaren und
 * Antworten. Die Farbe kommt aus dem zentralen Token `--hashtag`.
 */
const HASHTAG_SPLIT = /(#[\p{L}\p{N}_-]+)/u;

function HashtaggedText({ text }: { text: string }) {
  if (!text) return null;
  return (
    <>
      {text.split(HASHTAG_SPLIT).map((part, i) =>
        part.startsWith("#") ? (
          <span key={i} style={{ color: HASHTAG_COLOR }} className="font-semibold">
            {part}
          </span>
        ) : (
          <MentionText key={i} text={part} />
        ),
      )}
    </>
  );
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
      // Gleiche Audioquelle wie im Feed/Chip: identische Wiedergabe.
      ref.current = getAudio(tag.audio);
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
