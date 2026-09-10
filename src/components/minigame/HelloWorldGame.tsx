import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Globe2, Heart, Play, RotateCcw, Trophy, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LEVELS, LEVEL_IDS, levelGreetings, type GameWord } from "@/lib/minigame/levels";
import {
  HelloWorldGame as Engine,
  MAX_ERRORS,
  MAX_LIVES,
  type GameStats,
} from "@/lib/minigame/hello-world-engine";
import { speakWord, stopSpeakingWord } from "@/lib/minigame/speak";

const HIGHSCORE_KEY = "ydude.minigame.hello-world.highscore";
const UNLOCK_KEY = "ydude.minigame.unlocked-level";

const EMPTY: GameStats = {
  score: 0,
  correct: 0,
  errors: 0,
  combo: 0,
  lives: 0,
  goal: 0,
  mistakes: [],
};

function readNumber(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    const n = raw ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : fallback;
  } catch {
    return fallback;
  }
}

function writeNumber(key: string, value: number) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    /* Speichern ist optional – das Spiel laeuft auch ohne. */
  }
}

/** Mini-Game "Y-Dude JUMP" – Levelkarten, Leben und Sprachlernen. */
export default function HelloWorldGameView() {
  const [levelId, setLevelId] = useState(1);
  const level = LEVELS[levelId] ?? LEVELS[1];
  const greetings = levelGreetings(level);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const [phase, setPhase] = useState<"idle" | "playing" | "over" | "complete">("idle");
  const [stats, setStats] = useState<GameStats>(EMPTY);
  const [result, setResult] = useState<GameStats | null>(null);
  const [highscore, setHighscore] = useState(0);
  const [unlocked, setUnlocked] = useState(1);
  const [learn, setLearn] = useState<GameWord | null>(null);
  const [lifePop, setLifePop] = useState(0);
  const learnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setHighscore(readNumber(HIGHSCORE_KEY, 0));
    setUnlocked(readNumber(UNLOCK_KEY, 1));
  }, []);

  const start = useCallback(
    (id: number = levelId) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const lvl = LEVELS[id] ?? LEVELS[1];
      engineRef.current?.stop();
      const finish = (final: GameStats) => {
        setResult(final);
        setHighscore((prev) => {
          if (final.score > prev) {
            writeNumber(HIGHSCORE_KEY, final.score);
            return final.score;
          }
          return prev;
        });
      };
      const engine = new Engine({
        canvas,
        level: lvl,
        onStats: setStats,
        onGameOver: (final) => {
          finish(final);
          setPhase("over");
        },
        onLevelComplete: (final) => {
          finish(final);
          setPhase("complete");
          const next = Math.min(LEVEL_IDS[LEVEL_IDS.length - 1], lvl.id + 1);
          setUnlocked((prev) => {
            if (next > prev) {
              writeNumber(UNLOCK_KEY, next);
              return next;
            }
            return prev;
          });
        },
        onLearn: (word) => {
          setLearn(word);
          if (learnTimer.current) clearTimeout(learnTimer.current);
          learnTimer.current = setTimeout(() => setLearn(null), 1400);
        },
        onLife: () => setLifePop((n) => n + 1),
      });
      engineRef.current = engine;
      setLevelId(id);
      setResult(null);
      setLearn(null);
      setStats({ ...EMPTY, goal: lvl.goal });
      setPhase("playing");
      engine.start();
    },
    [levelId],
  );

  useEffect(() => {
    const onResize = () => engineRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      engineRef.current?.stop();
      if (learnTimer.current) clearTimeout(learnTimer.current);
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

  const jump = () => engineRef.current?.jump();

  return (
    <div className="mx-auto w-full max-w-[720px] px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-4">
      <header className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-black uppercase tracking-wide">
            🎮 Level {level.id} · {level.title}
          </h1>
          <p className="text-xs text-muted-foreground">
            {level.focus} – sammle nur echte Begrüßungen ein.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0 rounded-full">
          <Link to="/globe">
            <Globe2 className="h-4 w-4" /> Globe
          </Link>
        </Button>
      </header>

      {/* Levelkarten */}
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {LEVEL_IDS.map((id) => {
          const l = LEVELS[id];
          const locked = id > unlocked;
          const active = id === levelId;
          return (
            <button
              key={id}
              type="button"
              disabled={locked || phase === "playing"}
              onClick={() => (phase === "playing" ? undefined : start(id))}
              className={`shrink-0 rounded-2xl border px-3 py-2 text-left transition ${
                active ? "border-brand bg-brand/10" : "border-border bg-surface/50"
              } ${locked ? "opacity-40" : "hover:border-brand/60"}`}
            >
              <span className="block text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                {locked ? "🔒 " : ""}Level {id}
              </span>
              <span className="block text-sm font-bold">{l.title}</span>
            </button>
          );
        })}
      </div>

      {/* HUD */}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider">
        <span className="rounded-full border border-border bg-surface/60 px-3 py-1">
          ⭐ {stats.score.toLocaleString("de-DE")}
        </span>
        <span className="rounded-full border border-border bg-surface/60 px-3 py-1">
          ✅ {stats.correct} / {stats.goal || level.goal}
        </span>
        <span
          key={lifePop}
          className="animate-in zoom-in-50 rounded-full border border-border bg-surface/60 px-3 py-1"
        >
          {Array.from({ length: MAX_LIVES }, (_, i) => (
            <Heart
              key={i}
              className={`mr-0.5 inline h-3.5 w-3.5 ${
                i < stats.lives ? "fill-current text-red-500" : "text-muted-foreground/40"
              }`}
            />
          ))}
        </span>
        <span className="rounded-full border border-border bg-surface/60 px-3 py-1">
          ❌ {stats.errors} / {MAX_ERRORS}
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
          if (phase === "playing") jump();
          else if (phase === "idle") start();
        }}
      >
        <canvas ref={canvasRef} className="h-full w-full" />

        {learn && phase === "playing" && (
          <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full border border-border bg-background/85 px-3 py-1 text-xs font-bold backdrop-blur-sm">
            {learn.flag} {learn.word} = {learn.meaning}
          </div>
        )}

        {phase === "idle" && (
          <div className="absolute inset-0 grid place-items-center bg-background/70 backdrop-blur-sm">
            <Button size="lg" className="rounded-full" onClick={() => start()}>
              <Play className="h-5 w-5" /> Spielen
            </Button>
          </div>
        )}
      </div>

      {/* Mobile JUMP-Taste – identische Sprungfunktion wie SPACE */}
      <div className="mt-3 flex justify-center sm:hidden">
        <button
          type="button"
          aria-label="Springen"
          disabled={phase !== "playing"}
          onPointerDown={(e) => {
            e.preventDefault();
            jump();
          }}
          className="h-16 w-44 select-none rounded-full bg-brand text-lg font-black uppercase tracking-widest text-brand-foreground shadow-lg active:scale-95 disabled:opacity-40"
        >
          JUMP
        </button>
      </div>
      <p className="mt-2 hidden text-center text-xs text-muted-foreground sm:block">
        SPACE / ↑ = JUMP
      </p>

      {(phase === "over" || phase === "complete") && result && (
        <section className="mt-4 space-y-4">
          <div className="rounded-2xl border border-border bg-surface/60 p-4">
            <h2 className="text-base font-black uppercase tracking-wide">
              {phase === "complete" ? `Level ${level.id} complete` : "Game Over"}
            </h2>
            <p className="mt-1 text-2xl font-black text-brand">
              ⭐ {result.score.toLocaleString("de-DE")} Punkte
            </p>
            <p className="text-sm text-muted-foreground">
              ✅ {result.correct} Begrüßungen · ❌ {result.errors} / {MAX_ERRORS} · ❤️{" "}
              {result.lives} übrig
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              🏆 Highscore: {highscore.toLocaleString("de-DE")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {phase === "complete" && level.id < LEVEL_IDS[LEVEL_IDS.length - 1] && (
                <Button className="rounded-full" onClick={() => start(level.id + 1)}>
                  <Play className="h-4 w-4" /> Nächstes Level
                </Button>
              )}
              <Button
                variant={phase === "complete" ? "outline" : "default"}
                className="rounded-full"
                onClick={() => start(level.id)}
              >
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
