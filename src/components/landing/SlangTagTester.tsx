import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { PwaInstallInfo } from "@/components/landing/PwaInstallInfo";
import { usePwaInstall } from "@/lib/use-pwa-install";
import { useQuery } from "@tanstack/react-query";
import { Mic, RotateCcw, Square } from "lucide-react";
import { toast } from "sonner";

import { Waveform } from "@/components/Waveform";
import { PublicSlangTagPreview, makePreviewTag } from "@/components/landing/PublicSlangTagPreview";
import { useLang } from "@/lib/lang-context";
import { useAudioRecorder } from "@/lib/use-audio-recorder";
import { getPublicSlangTag } from "@/lib/public-slangtag.functions";
import { transcribeTestRecording } from "@/lib/public-transcribe.functions";
import { Turnstile } from "@/components/Turnstile";
import { useCaptchaGate } from "@/lib/use-captcha-gate";
import { slangTagTheme } from "@/lib/slangtag-ui";
import { pickTestImage, TESTER_IMAGES } from "@/lib/landing-test-images";

/**
 * Öffentlicher SlangTag Tester der Landingpage.
 *
 * - Aufnahme nutzt exakt die bestehende SlangTag-Technik (`useAudioRecorder`
 *   mit lokaler VAD aus `src/lib/vad.ts`). Es gibt hier keine zweite
 *   Aufnahme-/VAD-Logik.
 * - Testaufnahmen bleiben ausschließlich lokal im Browser: keine Datenbank,
 *   kein Storage, keine Statistik, kein SlangTag im Benutzerbestand.
 * - Kommt ein QR-Deep-Link (`/?slangtag=<id>`), wird der vorhandene SlangTag
 *   nur gelesen und abgespielt – ohne Registrierung und ohne Besitzwechsel.
 */

const TEXTS = {
  de: {
    title: "SlangTag Tester",
    lead: "Nimm einen SlangTag auf oder spiele einen vorhandenen ab.",
    record: "Aufnehmen",
    stop: "Stoppen",
    play: "Abspielen",
    pause: "Pause",
    again: "Neu aufnehmen",
    listening: "Sprich jetzt …",
    local: "Nur ein Test – die Aufnahme bleibt auf deinem Gerät.",
    discovered: "SlangTag entdeckt",
    playTag: "SlangTag abspielen",
    like: "Gefällt dir SlangTag?",
    discover: "Jetzt Y-Dude entdecken",
    gone: "Dieser SlangTag ist nicht mehr verfügbar.",
    loading: "SlangTag wird geladen …",
    denied: "Kein Zugriff auf das Mikrofon.",
    drag: "Ziehen, drehen, skalieren – tippe auf ▶ zum Hören.",
    place: "SlangTag platzieren",
    testName: "Testtag",
    hearing: "Text wird erkannt …",
    nameLabel: "SlangTag-Text",
    sttFailed: "Text konnte nicht erkannt werden.",
  },
  en: {
    title: "SlangTag Tester",
    lead: "Record a SlangTag or play an existing one.",
    record: "Record",
    stop: "Stop",
    play: "Play",
    pause: "Pause",
    again: "Record again",
    listening: "Speak now …",
    local: "Just a test – the recording stays on your device.",
    discovered: "SlangTag found",
    playTag: "Play SlangTag",
    like: "Like SlangTags?",
    discover: "Discover Y-Dude now",
    gone: "This SlangTag is no longer available.",
    loading: "Loading SlangTag …",
    denied: "No microphone access.",
    drag: "Drag, rotate, scale – tap ▶ to listen.",
    place: "Place SlangTag",
    testName: "TestTag",
    hearing: "Recognising text …",
    nameLabel: "SlangTag text",
    sttFailed: "Could not recognise the text.",
  },
  el: {
    title: "SlangTag Tester",
    lead: "Ηχογράφησε ένα SlangTag ή άκου ένα υπάρχον.",
    record: "Ηχογράφηση",
    stop: "Στοπ",
    play: "Αναπαραγωγή",
    pause: "Παύση",
    again: "Νέα ηχογράφηση",
    listening: "Μίλα τώρα …",
    local: "Απλή δοκιμή – η ηχογράφηση μένει στη συσκευή σου.",
    discovered: "Βρέθηκε SlangTag",
    playTag: "Αναπαραγωγή SlangTag",
    like: "Σου αρέσει το SlangTag;",
    discover: "Ανακάλυψε το Y-Dude",
    gone: "Αυτό το SlangTag δεν είναι πλέον διαθέσιμο.",
    loading: "Φόρτωση SlangTag …",
    denied: "Δεν υπάρχει πρόσβαση στο μικρόφωνο.",
    drag: "Σύρε, περίστρεψε, μεγέθυνε – πάτα ▶ για ακρόαση.",
    place: "Τοποθέτηση SlangTag",
    testName: "TestTag",
    hearing: "Αναγνώριση κειμένου …",
    nameLabel: "Κείμενο SlangTag",
    sttFailed: "Δεν αναγνωρίστηκε κείμενο.",
  },
} as const;

/** Öffentliches Demo-Audio ($Moinmoin) für die Vorschau ohne Deep-Link. */
const DEMO_AUDIO = "/__l5e/assets-v1/7f660c1f-9e90-4759-90ae-ae909fbe1039/moinmoin.m4a";

export function SlangTagTester({ tagId }: { tagId?: string }) {
  const { lang } = useLang();
  const t = TEXTS[lang as keyof typeof TEXTS] ?? TEXTS.de;
  const navigate = useNavigate();
  const { canPrompt, installed, device, promptInstall } = usePwaInstall();
  const [installGuideOpen, setInstallGuideOpen] = useState(false);

  /**
   * Der CTA behält seine Funktion (Registrierung) und führt zusätzlich die
   * bestehende PWA-Installationslogik aus: nativer Prompt wenn möglich,
   * sonst die vorhandene manuelle Anleitung (Android/Chrome bzw. iOS/Safari).
   */
  const handleDiscover = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (installed) return; // bereits installiert -> keine Aufforderung
    if (canPrompt) {
      event.preventDefault();
      await promptInstall();
      navigate({ to: "/auth", search: { mode: "register" } });
      return;
    }
    if (device === "ios" || device === "android") {
      event.preventDefault();
      setInstallGuideOpen(true);
    }
    // Desktop ohne Prompt: Button funktioniert unverändert normal weiter.
  };

  const tagQuery = useQuery({
    queryKey: ["public-slangtag", tagId],
    enabled: !!tagId,
    staleTime: 5 * 60 * 1000,
    queryFn: () => getPublicSlangTag({ data: { tagId: tagId as string } }),
  });
  const tag = tagQuery.data ?? null;
  const tagMissing = !!tagId && !tagQuery.isPending && !tag;

  const {
    audio: recorded,
    recording,
    seconds,
    start,
    stop,
    reset,
  } = useAudioRecorder(() => toast.error(t.denied));

  /**
   * Text-State der lokalen Testaufnahme. Jede erfolgreiche Transkription
   * ersetzt den Wert vollständig (`setName(text)`), auch bei der zweiten,
   * dritten … Aufnahme. Danach darf der Nutzer manuell weiter tippen.
   */
  const [name, setName] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  /**
   * Sicherheitsprüfung für die öffentliche Transkription. Der Server verlangt
   * ein gültiges Turnstile-Token; nach jeder Aufnahme wird das Widget
   * zurückgesetzt, damit die nächste Aufnahme ein frisches Token erhält.
   */
  const captcha = useCaptchaGate();
  /** Zählt jede neue Aufnahme – erzwingt frische Vorschau (Audio + Text). */
  const [take, setTake] = useState(0);
  const lastAudio = useRef<string | null>(null);

  /**
   * Testbild der Vorschau. Wechselt nur beim ersten Öffnen, bei einer neuen
   * Aufnahme und beim Laden eines QR-SlangTags – normale State-Updates
   * (Drag, Skalieren, Drehen, Abspielen, Texteingabe) lassen es unberührt.
   */
  // Start bewusst deterministisch (identisch zu SSR-HTML), erst nach dem
  // Mounten wird ein Zufallsbild gewählt – so entsteht kein Hydration-Mismatch.
  const [image, setImage] = useState<string>(TESTER_IMAGES[0]);
  const lastImageKey = useRef<string | null>(null);

  useEffect(() => {
    setImage((current) => pickTestImage(current));
  }, []);

  useEffect(() => {
    if (!recorded || recorded === lastAudio.current) return;
    lastAudio.current = recorded;
    // Alten Text sofort verwerfen, damit nie ein Wert der Vor-Aufnahme steht.
    setName("");
    setTake((n) => n + 1);
    setImage((current) => pickTestImage(current));
    setTranscribing(true);
    let active = true;
    void captcha
      .waitForToken(4000)
      .then((token) => {
        if (!token) throw new Error("captcha");
        return transcribeTestRecording({ data: { audioDataUrl: recorded, captchaToken: token } });
      })
      .then((res) => {
        if (!active) return;
        const text = res.text
          .replace(/\s+/g, " ")
          .replace(/[.,!?;:]+$/u, "")
          .trim();
        setName(text || t.testName);
      })
      .catch(() => {
        if (!active) return;
        setName(t.testName);
        toast.error(t.sttFailed);
      })
      .finally(() => {
        // Turnstile-Tokens sind einmalig – für die nächste Aufnahme neu holen.
        captcha.reset();
        if (active) setTranscribing(false);
      });
    return () => {
      active = false;
    };
    // captcha ist stabil (useCallback-basiert) und bewusst nicht in den Deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorded, t.testName, t.sttFailed]);

  const theme = slangTagTheme(tag?.kind);
  const accent = theme.accent;
  const waveformGlow = theme.waveGlow;

  /**
   * Anzeige-SlangTag für die Vorschau. Reine Ansicht: entweder der per
   * QR-Deep-Link gelesene SlangTag oder die lokale Testaufnahme.
   */
  useEffect(() => {
    if (!tag || lastImageKey.current === tag.id) return;
    lastImageKey.current = tag.id;
    setImage((current) => pickTestImage(current));
  }, [tag]);

  const previewTag = tag
    ? makePreviewTag({
        id: tag.id,
        name: tag.name,
        kind: tag.kind,
        audio: tag.audio,
        region: tag.region,
        duration: tag.duration,
      })
    : recorded
      ? makePreviewTag({
          // ID wechselt pro Aufnahme, damit Vorschau, Audio und Text neu greifen.
          id: `local-test-${take}`,
          name: name || t.testName,
          kind: "community",
          audio: recorded,
        })
      : makePreviewTag({
          id: "demo",
          name: "Moinmoin",
          kind: "community",
          audio: DEMO_AUDIO,
          region: "Norddeutschland",
        });

  const maxW = "max-w-[340px]";

  return (
    <section id="tester" className="px-4 pb-2 pt-2 sm:px-6 sm:pb-4 lg:pb-6">
      <div className={`mx-auto w-full ${maxW}`}>
        <div className="rounded-2xl border border-border bg-surface/40 p-3 backdrop-blur-sm sm:p-4">
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            {tag ? t.discovered : t.title}
          </p>

          {tag ? (
            <p className={`mt-1 text-center text-lg font-bold sm:text-xl ${theme.text}`}>
              ${tag.name}
            </p>
          ) : tagMissing ? (
            <p className="mx-auto mt-1 max-w-[280px] text-center text-xs leading-relaxed text-muted-foreground">
              {t.gone}
            </p>
          ) : null}

          {tagId && tagQuery.isPending ? (
            <p className="mt-5 text-center text-xs text-muted-foreground">{t.loading}</p>
          ) : (
            <>
              {recording ? (
                <div className="mt-4 flex h-10 items-end justify-center">
                  <Waveform
                    bars={18}
                    color={accent}
                    animated
                    media={null}
                    className={`h-7 w-full max-w-[220px] justify-center ${waveformGlow}`}
                  />
                </div>
              ) : (
                <PublicSlangTagPreview
                  tag={previewTag}
                  image={image}
                  hint={t.drag}
                  placeLabel={t.place}
                />
              )}

              {!tag && recorded ? (
                <div className="mt-2">
                  <label className="sr-only" htmlFor="tester-name">
                    {t.nameLabel}
                  </label>
                  <div className="flex items-center gap-1 rounded-xl border border-brand/40 bg-background/60 px-2 py-1.5">
                    <span className="text-sm font-bold text-brand">$</span>
                    <input
                      id="tester-name"
                      value={transcribing ? "" : name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={transcribing ? t.hearing : t.nameLabel}
                      className="w-full bg-transparent text-sm font-semibold text-brand outline-none placeholder:font-normal placeholder:text-muted-foreground"
                    />
                  </div>
                </div>
              ) : null}

              <div className="mt-2 flex flex-col items-center gap-1.5">
                {tag ? null : (
                  <Turnstile
                    onToken={captcha.setToken}
                    onUnavailable={captcha.setBlocked}
                    handleRef={captcha.handleRef}
                    className="w-full"
                  />
                )}
                {tag ? null : (
                  <button
                    type="button"
                    onClick={() => (recording ? stop() : start())}
                    className="inline-flex w-full max-w-[260px] items-center justify-center gap-2 rounded-full bg-gradient-brand px-4 py-2 text-sm font-bold text-primary-foreground transition-all hover:scale-[1.02] hover:shadow-glow-subtle active:shadow-glow-active"
                  >
                    {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    {recording ? t.stop : recorded ? t.again : t.record}
                  </button>
                )}

                {!tag && recorded ? (
                  <button
                    type="button"
                    onClick={() => {
                      lastAudio.current = null;
                      setName("");
                      reset();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-all hover:border-brand/40 hover:text-brand hover:shadow-glow-subtle"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {t.again}
                  </button>
                ) : null}

                <p className="text-center text-[10px] leading-snug text-muted-foreground">
                  {recording
                    ? `${t.listening} ${seconds}s`
                    : transcribing
                      ? t.hearing
                      : tag
                        ? tag.region
                        : t.local}
                </p>
              </div>
            </>
          )}
        </div>

        <div className="mt-2 text-center sm:mt-3">
          <p className="text-xs text-muted-foreground">{t.like}</p>
          <Link
            to="/auth"
            search={{ mode: "register" }}
            onClick={handleDiscover}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-brand/60 px-4 py-1.5 text-xs font-semibold text-brand transition-all hover:bg-brand/10 hover:shadow-glow-subtle active:shadow-glow-active"
          >
            {t.discover}
          </Link>
        </div>
      </div>

      <PwaInstallInfo
        lang={(["de", "en", "el"].includes(lang) ? lang : "de") as "de" | "en" | "el"}
        open={installGuideOpen}
        onClose={() => {
          setInstallGuideOpen(false);
          navigate({ to: "/auth", search: { mode: "register" } });
        }}
      />
    </section>
  );
}
