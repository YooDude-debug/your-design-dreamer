import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Globe2, Play, RotateCcw, Trophy, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LEVELS, levelGreetings, type GameWord } from "@/lib/minigame/levels";
import {
  HelloWorldGame as Engine,
  MAX_ERRORS,
  type GameStats,
} from "@/lib/minigame/hello-world-engine";
import { speakWord, stopSpeakingWord } from "@/lib/minigame/speak";

const HIGHSCORE_KEY = "ydude.minigame.hello-world.highscore";

const EMPTY: GameStats = { score: 0, correct: 0, errors: 0, combo: 0, mistakes: [] };

function readHighscore(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(HIGHSCORE_KEY);
    const n = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeHighscore(score: number) {
  try {
    window.localStorage.setItem(HIGHSCORE_KEY, String(score));
  } catch {
    /* Speichern ist optional – das Spiel laeuft auch ohne. */
  }
}

/** Level 1 "Hello World" – vollstaendig eigenstaendige Mini-Game-Ansicht. */
export default function HelloWorldGameView() {
  const level = LEVELS[1];
  const greetings = levelGreetings(level);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const [phase, setPhase] = useState<"idle" | "playing" | "over">("idle");
  const [stats, setStats] = useState<GameStats>(EMPTY);
  const [result, setResult] = useState<GameStats | null>(null);
  const [highscore, setHighscore] = useState(0);

  useEffect(() => setHighscore(readHighscore()), []);

  const start = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    engineRef.current?.stop();
    const engine = new Engine({
      canvas,
      level,
      onStats: setStats,
      onGameOver: (final) => {
        setResult(final);
        setPhase("over");
        setHighscore((prev) => {
          if (final.score > prev) {
            writeHighscore(final.score);
            return final.score;
          }
          return prev;
        });
      },
    });
    engineRef.current = engine;
    setResult(null);
    setStats(EMPTY);
    setPhase("playing");
    engine.start();
  }, [level]);

  useEffect(() => {
    const onResize = () => engineRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      engineRef.current?.stop();
      stopSpeakingWord();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.code !== "ArrowUp") return;
      e.preventDefault();
      if (phase === "playing") engineRef.current?.jump();
      else if (phase === "idle") start();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, start]);

  return (
    <div className="mx-auto w-full max-w-[720px] px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-4">
      <header className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-black uppercase tracking-wide">🎮 {level.title}</h1>
          <p className="text-xs text-muted-foreground">
            Sammle nur echte Begrüßungen ein – Sprünge mit Leertaste oder Tap.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0 rounded-full">
          <Link to="/globe">
            <Globe2 className="h-4 w-4" /> Globe
          </Link>
        </Button>
      </header>

      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider">
        <span className="rounded-full border border-border bg-surface/60 px-3 py-1">
          Score: {stats.score.toLocaleString("de-DE")}
        </span>
        <span className="rounded-full border border-border bg-surface/60 px-3 py-1">
          Richtig: {stats.correct}
        </span>
        <span className="rounded-full border border-border bg-surface/60 px-3 py-1">
          Fehler: {stats.errors} / {MAX_ERRORS}
        </span>
        <span className="rounded-full border border-border bg-surface/60 px-3 py-1 text-brand">
          <Trophy className="mr-1 inline h-3.5 w-3.5" />
          {highscore.toLocaleString("de-DE")}
        </span>
      </div>

      <div
        className="relative w-full touch-none select-none overflow-hidden rounded-2xl border border-border bg-surface/50"
        style={{ height: "clamp(240px, 42svh, 380px)" }}
        onPointerDown={(e) => {
          e.preventDefault();
          if (phase === "playing") engineRef.current?.jump();
          else if (phase === "idle") start();
        }}
      >
        <canvas ref={canvasRef} className="h-full w-full" />

        {phase === "idle" && (
          <div className="absolute inset-0 grid place-items-center bg-background/70 backdrop-blur-sm">
            <Button size="lg" className="rounded-full" onClick={start}>
              <Play className="h-5 w-5" /> Spielen
            </Button>
          </div>
        )}
      </div>

      {phase === "over" && result && (
        <section className="mt-4 space-y-4">
          <div className="rounded-2xl border border-border bg-surface/60 p-4">
            <h2 className="text-base font-black uppercase tracking-wide">Game Over</h2>
            <p className="mt-1 text-2xl font-black text-brand">
              {result.score.toLocaleString("de-DE")} Punkte
            </p>
            <p className="text-sm text-muted-foreground">
              Richtig: {result.correct} · Fehler: {result.errors} / {MAX_ERRORS}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              🏆 Highscore: {highscore.toLocaleString("de-DE")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button className="rounded-full" onClick={start}>
                <RotateCcw className="h-4 w-4" /> Nochmal spielen
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/globe">
                  <Globe2 className="h-4 w-4" /> Zurück zu Globe
                </Link>
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface/60 p-4">
            <h3 className="text-sm font-black uppercase tracking-wide">🧠 Deine Fehler</h3>
            {result.mistakes.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Keine falschen Wörter – stark!</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {result.mistakes.map((m, i) => (
                  <li key={`${m.word}-${i}`}>❌ {m.word}</li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Das wären echte Begrüßungen gewesen
            </p>
            <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
              {greetings.slice(0, 6).map((g) => (
                <li key={g.word}>
                  <span className="text-foreground">{g.word}</span> → {g.language} → {g.meaning}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-surface/60 p-4">
            <h3 className="text-sm font-black uppercase tracking-wide">
              🌍 Hör dir die Begrüßungen an
            </h3>
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {greetings.map((g) => (
                <GreetingRow key={g.word} word={g} />
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}

function GreetingRow({ word }: { word: GameWord }) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-xl border border-border/60 px-3 py-1.5">
      <span className="text-sm">
        {word.flag} {word.word}
        <span className="ml-2 text-xs text-muted-foreground">{word.language}</span>
      </span>
      <button
        type="button"
        aria-label={`${word.word} anhören`}
        onClick={() => speakWord(word.word, word.locale)}
        className="tap-safe grid h-11 w-11 place-items-center rounded-full text-muted-foreground hover:text-brand"
      >
        <Volume2 className="h-5 w-5" />
      </button>
    </li>
  );
}
