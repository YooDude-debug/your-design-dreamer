import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Flame, MapPin, Mic, Trophy } from "lucide-react";

import { useLang } from "@/lib/lang-context";
import { challengeTexts, EXAMPLE_REGIONS } from "@/lib/i18n-challenge";
import { getChallengeSnapshot } from "@/lib/challenge.functions";
import { markChallengeOnboarding, trackChallenge } from "@/lib/challenge-tracking";

const STEP_ICONS = { mic: Mic, pin: MapPin, cup: Trophy } as const;

/** Dezenter Audio-Visualizer: reine CSS-Animation, kein Audio, kein Layout-Sprung. */
function MiniWave({ bars = 14 }: { bars?: number }) {
  return (
    <div aria-hidden className="flex h-6 items-end gap-[3px]">
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-brand/70 motion-safe:animate-pulse"
          style={{
            height: `${30 + ((i * 37) % 70)}%`,
            animationDelay: `${(i % 7) * 110}ms`,
            animationDuration: "1.4s",
          }}
        />
      ))}
    </div>
  );
}

/**
 * "The Slang Challenge" – Einstieg für nicht eingeloggte Besucher.
 * Zeigt nur echte Daten (Globe-Einträge); ist noch nichts vorhanden,
 * bleiben Social-Proof-Bereiche leer bzw. klar als Beispiel markiert.
 */
export function SlangChallenge() {
  const { lang } = useLang();
  const c = challengeTexts[lang];
  const sectionRef = useRef<HTMLElement | null>(null);

  const { data } = useQuery({
    queryKey: ["challenge-snapshot"],
    queryFn: () => getChallengeSnapshot(),
    staleTime: 5 * 60_000,
  });

  // "Challenge gesehen" erst melden, wenn der Bereich wirklich sichtbar ist.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          trackChallenge("challenge_seen", {}, true);
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const onCta = (place: string) => {
    markChallengeOnboarding();
    trackChallenge("challenge_cta_clicked", { place });
  };

  const liveRegions = data?.regions ?? [];
  const trending = data?.trending ?? [];
  const regions = liveRegions.length
    ? liveRegions.map((r) => ({ flag: "🌍", region: r.region }))
    : EXAMPLE_REGIONS;

  return (
    <section
      ref={sectionRef}
      id="challenge"
      className="px-4 pb-4 pt-10 sm:px-6 sm:pt-14"
    >
      <div className="mx-auto max-w-[860px]">
        <h2 className="text-center text-2xl font-black leading-tight sm:text-4xl">
          {c.headline}
        </h2>
        <p className="mx-auto mt-3 max-w-[560px] text-center text-sm font-semibold text-brand sm:text-base">
          {c.sub}
        </p>
        <p className="mx-auto mt-3 max-w-[560px] text-center text-sm leading-relaxed text-muted-foreground">
          {c.emotion}
        </p>

        {/* Challenge-Karte */}
        <div className="relative mt-7 overflow-hidden rounded-2xl border border-brand/40 bg-black px-4 py-5 shadow-[0_0_34px_-12px_oklch(0.82_0.24_150/0.35)] sm:px-6 sm:py-7">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/50 bg-brand/10 px-2.5 py-1 text-[10px] font-black tracking-wide text-brand sm:text-xs">
              <Flame className="h-3.5 w-3.5" /> {c.badge}
            </span>
            <MiniWave />
          </div>

          <p className="mt-3 text-lg font-bold leading-snug sm:text-2xl">{c.challengeTitle}</p>

          <ol className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
            {c.steps.map((step, i) => {
              const Icon = STEP_ICONS[step.icon as keyof typeof STEP_ICONS];
              return (
                <li
                  key={step.title}
                  className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-surface/40 px-3 py-2.5"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-brand/50 text-brand">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[10px] font-bold text-brand">{i + 1}</span>
                    <span className="block text-xs font-semibold leading-snug sm:text-sm">
                      {step.title}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>

          <Link
            to="/auth"
            search={{ mode: "register" }}
            onClick={() => onCta("challenge_card")}
            className="group mt-5 flex w-full items-center justify-center gap-3 rounded-full bg-gradient-brand px-5 py-3.5 text-base font-black text-primary-foreground transition-transform motion-safe:animate-[pulse_3s_ease-in-out_infinite] hover:scale-[1.02] sm:text-lg"
          >
            {c.cta}
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <p className="mt-2.5 text-center text-xs text-muted-foreground sm:text-sm">
            {c.ctaHint}
          </p>
        </div>

        {/* Regionen-Wettbewerb */}
        <div className="mt-6 rounded-2xl border border-border bg-surface/40 px-4 py-4 sm:px-6 sm:py-5">
          <h3 className="text-sm font-bold sm:text-base">{c.contestTitle}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {regions.map((r) => (
              <span
                key={r.region}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-black px-3 py-1.5 text-xs font-semibold"
              >
                <span aria-hidden>{r.flag}</span>
                <span className="max-w-[10rem] truncate">{r.region}</span>
              </span>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            {liveRegions.length ? c.contestLive : c.contestExampleNote}
          </p>
        </div>

        {/* Social Proof nur mit echten Daten */}
        {trending.length > 0 && (
          <div className="mt-6 rounded-2xl border border-border bg-surface/40 px-4 py-4 sm:px-6 sm:py-5">
            <h3 className="inline-flex items-center gap-1.5 text-sm font-bold sm:text-base">
              <Flame className="h-4 w-4 text-brand" /> {c.trendingTitle}
            </h3>
            <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {trending.map((tag) => (
                <li
                  key={`${tag.name}-${tag.region ?? ""}`}
                  className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border bg-black px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold text-brand sm:text-sm">
                      ${tag.name}
                    </span>
                    {tag.region && (
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {tag.region}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">
                    {tag.up} {c.votes}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 text-center">
          <p className="text-sm text-muted-foreground">
            {c.trendingEmptyA}{" "}
            <span className="font-bold text-foreground">{c.trendingEmptyB}</span>
          </p>
          <Link
            to="/auth"
            search={{ mode: "register" }}
            onClick={() => onCta("trending_footer")}
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-brand/60 px-5 py-2.5 text-sm font-black text-brand transition-colors hover:bg-brand/10"
          >
            <Mic className="h-4 w-4" />
            {c.trendingCta}
          </Link>
        </div>
      </div>
    </section>
  );
}
