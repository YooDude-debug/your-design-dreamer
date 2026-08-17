import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Mic, Pause, Play, RotateCcw, Square } from "lucide-react";
import { toast } from "sonner";

import { Waveform } from "@/components/Waveform";
import { useLang } from "@/lib/lang-context";
import { useAudioRecorder } from "@/lib/use-audio-recorder";
import { getPublicSlangTag } from "@/lib/public-slangtag.functions";
import { slangTagTheme } from "@/lib/slangtag-ui";

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
  },
} as const;

function useAudioPlayer(src: string | null) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [media, setMedia] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    setPlaying(false);
    ref.current?.pause();
  }, [src]);

  const toggle = () => {
    const el = ref.current;
    if (!el || !src) return;
    if (el.paused) {
      void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  const element = src ? (
    <audio
      ref={(el) => {
        ref.current = el;
        setMedia(el);
      }}
      src={src}
      preload="auto"
      onEnded={() => setPlaying(false)}
      onPause={() => setPlaying(false)}
      className="hidden"
    />
  ) : null;

  return { playing, toggle, element, media };
}

export function SlangTagTester({ tagId }: { tagId?: string }) {
  const { lang } = useLang();
  const t = TEXTS[lang as keyof typeof TEXTS] ?? TEXTS.de;

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

  const source = tag?.audio ?? recorded;
  const player = useAudioPlayer(source);
  const theme = slangTagTheme(tag?.kind === "creator" ? "creator" : "community");

  const accent = tag?.kind === "creator" ? "var(--brand-cyan)" : "var(--brand)";

  return (
    <section id="tester" className="px-4 pb-16 pt-4 sm:px-6 sm:pb-24">
      <div className="mx-auto w-full max-w-[620px]">
        <div className="rounded-3xl border border-border bg-surface/40 p-6 backdrop-blur-sm sm:p-9">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            {tag ? t.discovered : t.title}
          </p>

          {tag ? (
            <p className={`mt-4 text-center text-2xl font-bold sm:text-3xl ${theme.text}`}>
              ${tag.name}
            </p>
          ) : (
            <p className="mx-auto mt-4 max-w-[380px] text-center text-sm leading-relaxed text-muted-foreground">
              {tagMissing ? t.gone : t.lead}
            </p>
          )}

          {tagId && tagQuery.isPending ? (
            <p className="mt-8 text-center text-sm text-muted-foreground">{t.loading}</p>
          ) : (
            <>
              <div className="mt-7 flex h-16 items-end justify-center">
                <Waveform
                  bars={28}
                  color={accent}
                  animated={player.playing || recording}
                  media={player.playing ? player.media : null}
                  className="h-14 w-full max-w-[360px] justify-center"
                />
              </div>

              <div className="mt-7 flex flex-col items-center gap-3">
                {source ? (
                  <button
                    type="button"
                    onClick={player.toggle}
                    className={`inline-flex w-full max-w-[320px] items-center justify-center gap-3 rounded-full px-6 py-3 text-base font-bold ${theme.solid} transition-transform hover:scale-[1.02]`}
                  >
                    {player.playing ? (
                      <Pause className="h-5 w-5" />
                    ) : (
                      <Play className="h-5 w-5" />
                    )}
                    {player.playing ? t.pause : tag ? t.playTag : t.play}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => (recording ? stop() : start())}
                    className="inline-flex w-full max-w-[320px] items-center justify-center gap-3 rounded-full bg-gradient-brand px-6 py-3 text-base font-bold text-primary-foreground transition-transform hover:scale-[1.02]"
                  >
                    {recording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                    {recording ? t.stop : t.record}
                  </button>
                )}

                {!tag && recorded ? (
                  <button
                    type="button"
                    onClick={() => reset()}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2 text-sm text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand"
                  >
                    <RotateCcw className="h-4 w-4" />
                    {t.again}
                  </button>
                ) : null}

                <p className="text-center text-xs text-muted-foreground">
                  {recording ? `${t.listening} ${seconds}s` : tag ? tag.region : t.local}
                </p>
              </div>
            </>
          )}

          {player.element}
        </div>

        <div className="mt-7 text-center">
          <p className="text-sm text-muted-foreground">{t.like}</p>
          <Link
            to="/auth"
            search={{ mode: "register" }}
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-brand/60 px-6 py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-brand/10"
          >
            {t.discover}
          </Link>
        </div>
      </div>
    </section>
  );
}
