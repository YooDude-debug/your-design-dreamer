/**
 * Spiellogik "Hello World" (Level 1) – bewusst getrennt von der Y-Dude-UI.
 *
 * Die Engine rendert auf ein Canvas und meldet Zustandsaenderungen ueber
 * Callbacks. Kein React-State pro Frame, ein einziger requestAnimationFrame.
 */
import type { GameLevel, GameWord } from "./levels";
import {
  SPEEDRUN_COOLDOWN,
  SPEEDRUN_DURATION,
  SPEEDRUN_COUNTDOWN,
  SPEEDRUN_HIT_SCORE,
  SPEEDRUN_MAX_WORDS,
  SPEEDRUN_PERFECT_BONUS,
  SPEEDRUN_SPAWN_GAP,
  SPEEDRUN_WORD_TTL,
  STAIR_FIRST_AT,
  STAIR_RISE,
  stairLayout,
} from "./speedrun";

export type GameStats = {
  score: number;
  correct: number;
  errors: number;
  combo: number;
  /** Zusaetzliche Leben (fangen je einen Fehler ab). */
  lives: number;
  /** Ziel an richtigen Woertern fuer den Levelabschluss. */
  goal: number;
  /** Faelschlich eingesammelte Woerter (Fehleranalyse). */
  mistakes: GameWord[];
};

/** Anzeigezustand des Speedruns (nur fuer das HUD-Overlay). */
export type SpeedrunHud = {
  phase: "countdown" | "active";
  timeLeft: number;
  hits: number;
  target: number;
  bonus: number;
};

export const MAX_ERRORS = 5;
export const MAX_LIVES = 3;

type Token = {
  x: number;
  y: number;
  w: number;
  h: number;
  data: GameWord;
  hit: boolean;
  flash: number;
  ok: boolean;
};

type Life = { x: number; y: number; w: number; h: number; hit: boolean; flash: number };

type Obstacle = { x: number; y: number; w: number; h: number };

/** Eine Stufe der Steintreppe – `y` ist die begehbare Oberkante. */
type Step = { x: number; y: number; w: number; top: boolean; triggered: boolean };

/** Anklickbares Wort waehrend des Speedruns (Canvas, kein DOM). */
type SpeedWord = {
  x: number;
  y: number;
  w: number;
  h: number;
  data: GameWord;
  slot: number;
  ttl: number;
  hit: boolean;
  flash: number;
  ok: boolean;
};

type Options = {
  canvas: HTMLCanvasElement;
  level: GameLevel;
  onStats: (stats: GameStats) => void;
  onGameOver: (stats: GameStats) => void;
  onLevelComplete?: (stats: GameStats) => void;
  /** Kurzer Lernhinweis nach einem richtigen Wort. */
  onLearn?: (word: GameWord) => void;
  /** Positives Feedback beim Einsammeln eines Lebens. */
  onLife?: () => void;
  /** Speedrun-Overlay (null = kein Speedrun aktiv). */
  onSpeedrun?: (state: SpeedrunHud | null) => void;
};

const GRAVITY = 2000;
const JUMP_V = -700;

export class HelloWorldGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private level: GameLevel;
  private onStats: (s: GameStats) => void;
  private onGameOver: (s: GameStats) => void;
  private onLevelComplete?: (s: GameStats) => void;
  private onLearn?: (w: GameWord) => void;
  private onLife?: () => void;
  private onSpeedrun?: (s: SpeedrunHud | null) => void;

  private raf = 0;
  private last = 0;
  private elapsed = 0;
  private spawnIn = 0.8;
  private running = false;

  private w = 0;
  private h = 0;

  private playerY = 0;
  private vy = 0;
  private grounded = true;
  private runPhase = 0;

  private tokens: Token[] = [];
  private lifeItems: Life[] = [];
  private obstacles: Obstacle[] = [];
  private stumble = 0;
  /** Gemischter Wort-Beutel – verhindert Wiederholungen und Muster. */
  private bag: GameWord[] = [];

  // ---- Steintreppe / Speedrun ----
  private steps: Step[] = [];
  private stairIn = STAIR_FIRST_AT;
  private mode: "run" | "countdown" | "speedrun" = "run";
  private srTime = 0;
  private srSpawnIn = 0;
  private srWords: SpeedWord[] = [];
  private srHits = 0;
  private srMisses = 0;
  private srBonus = 0;
  private srEmitIn = 0;
  private pendingComplete = false;

  private stats: GameStats = {
    score: 0,
    correct: 0,
    errors: 0,
    combo: 0,
    lives: 0,
    goal: 0,
    mistakes: [],
  };

  constructor(opts: Options) {
    this.canvas = opts.canvas;
    const ctx = opts.canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d context unavailable");
    this.ctx = ctx;
    this.level = opts.level;
    this.onStats = opts.onStats;
    this.onGameOver = opts.onGameOver;
    this.onLevelComplete = opts.onLevelComplete;
    this.onLearn = opts.onLearn;
    this.onLife = opts.onLife;
    this.onSpeedrun = opts.onSpeedrun;
    this.resize();
  }

  /** Logische Groesse an den Container anpassen (DPR-scharf). */
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio || 1, 2);
    this.w = Math.max(240, rect.width);
    this.h = Math.max(180, rect.height);
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.grounded && this.steps.length === 0) this.playerY = this.groundY();
  }

  private groundY() {
    return this.h - 46;
  }

  private speed() {
    // Level-abhaengig: ruhiger Start, langsame Steigerung (fair spielbar).
    return Math.min(this.level.maxSpeed, this.level.baseSpeed + this.elapsed * 1.6);
  }

  /** True, solange Speedrun/Countdown laeuft (Tap-Vorrang in der UI). */
  isSpeedrunActive() {
    return this.mode !== "run";
  }

  start() {
    this.stats = {
      score: 0,
      correct: 0,
      errors: 0,
      combo: 0,
      lives: 0,
      goal: this.level.goal,
      mistakes: [],
    };
    this.tokens = [];
    this.lifeItems = [];
    this.obstacles = [];
    this.steps = [];
    this.srWords = [];
    this.mode = "run";
    this.srTime = 0;
    this.srHits = 0;
    this.srMisses = 0;
    this.srBonus = 0;
    this.pendingComplete = false;
    this.stairIn = STAIR_FIRST_AT;
    this.bag = [];
    this.elapsed = 0;
    this.spawnIn = 0.8;
    this.vy = 0;
    this.grounded = true;
    this.playerY = this.groundY();
    this.running = true;
    this.last = 0;
    this.onStats({ ...this.stats });
    this.onSpeedrun?.(null);
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  jump() {
    if (!this.running) return;
    if (this.mode !== "run") return;
    if (!this.grounded) return;
    this.vy = JUMP_V;
    this.grounded = false;
  }

  private pick(): GameWord {
    if (this.bag.length === 0) {
      const words = [...this.level.words];
      for (let i = words.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [words[i], words[j]] = [words[j], words[i]];
      }
      this.bag = words;
    }
    return this.bag.pop()!;
  }

  private pickWhere(greeting: boolean): GameWord {
    const pool = this.level.words.filter((word) => word.isGreeting === greeting);
    if (pool.length === 0) return this.pick();
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private spawn() {
    const ctx = this.ctx;
    const data = this.pick();
    ctx.font = "600 16px system-ui, sans-serif";
    const tw = ctx.measureText(data.word).width;
    const w = tw + 26;
    const h = 32;
    const high = Math.random() < this.level.highRatio;
    const y = high ? this.groundY() - 96 : this.groundY() - 34;
    this.tokens.push({ x: this.w + 20, y, w, h, data, hit: false, flash: 0, ok: false });

    // Selten ein Extra-Leben – bewusst an einer Sprungposition.
    if (this.stats.lives < MAX_LIVES && Math.random() < this.level.lifeChance) {
      this.lifeItems.push({
        x: this.w + 20 + w + 180,
        y: this.groundY() - 104,
        w: 30,
        h: 30,
        hit: false,
        flash: 0,
      });
    }

    // Gelegentlich ein Hindernis – kein Fehler, nur kurzes Stolpern.
    if (this.elapsed > 12 && Math.random() < 0.25) {
      this.obstacles.push({ x: this.w + 20 + w + 120, y: this.groundY() - 18, w: 14, h: 18 });
    }
  }

  /** Steintreppe einsetzen – Stufenbreite/-anzahl haengt an der Canvasbreite. */
  private spawnStairs() {
    const { count, stepW } = stairLayout(this.w);
    const startX = this.w + 60;
    const g = this.groundY();
    for (let i = 0; i < count; i++) {
      this.steps.push({
        x: startX + i * stepW,
        y: g - (i + 1) * STAIR_RISE,
        w: stepW,
        top: i === count - 1,
        triggered: false,
      });
    }
  }

  /** Hoechste begehbare Flaeche unter dem Spieler (Boden oder Stufe). */
  private supportY(prevFeet: number) {
    const px = 34;
    const pw = 26;
    let support = this.groundY();
    if (this.vy < 0) return support; // nur von oben landen
    for (const s of this.steps) {
      if (px + pw <= s.x || px >= s.x + s.w) continue;
      if (s.y < support && prevFeet <= s.y + 2) support = s.y;
    }
    return support;
  }

  private collide(t: { x: number; y: number; w: number; h: number }) {
    const px = 34;
    const pw = 26;
    const ph = 30;
    const py = this.playerY - ph;
    return px < t.x + t.w && px + pw > t.x && py < t.y + t.h && py + ph > t.y;
  }

  private emit() {
    this.onStats({ ...this.stats, mistakes: [...this.stats.mistakes] });
  }

  private emitSpeedrun(force = false) {
    if (!this.onSpeedrun) return;
    if (this.mode === "run") {
      this.onSpeedrun(null);
      return;
    }
    if (!force && this.srEmitIn > 0) return;
    this.srEmitIn = 0.1;
    this.onSpeedrun({
      phase: this.mode === "countdown" ? "countdown" : "active",
      timeLeft: Math.max(0, this.srTime),
      hits: this.srHits,
      target: SPEEDRUN_MAX_WORDS * 2,
      bonus: this.srBonus,
    });
  }

  /** Richtiges/falsches Wort verbuchen – identische Logik fuer beide Modi. */
  private scoreWord(data: GameWord, ok: boolean): "ok" | "over" {
    if (ok) {
      this.stats.combo += 1;
      this.stats.correct += 1;
      this.stats.score += 100 + Math.min(100, (this.stats.combo - 1) * 25);
      this.onLearn?.(data);
    } else {
      this.stats.combo = 0;
      if (this.stats.lives > 0) this.stats.lives -= 1;
      else this.stats.errors += 1;
      this.stats.mistakes.push(data);
    }
    this.emit();
    return this.stats.errors >= MAX_ERRORS ? "over" : "ok";
  }

  private finishGameOver() {
    this.running = false;
    this.draw();
    this.stop();
    this.onSpeedrun?.(null);
    this.onGameOver({ ...this.stats, mistakes: [...this.stats.mistakes] });
  }

  private finishLevel() {
    this.running = false;
    this.draw();
    this.stop();
    this.onSpeedrun?.(null);
    this.onLevelComplete?.({ ...this.stats, mistakes: [...this.stats.mistakes] });
  }

  /** Klick/Tap auf das Canvas – nur im Speedrun relevant. */
  handlePointer(cx: number, cy: number): boolean {
    if (!this.running || this.mode !== "speedrun") return false;
    for (let i = this.srWords.length - 1; i >= 0; i--) {
      const word = this.srWords[i];
      if (word.hit) continue;
      if (cx < word.x || cx > word.x + word.w || cy < word.y || cy > word.y + word.h) continue;
      word.hit = true;
      word.flash = 0.4;
      word.ok = word.data.isGreeting;
      if (word.ok) {
        this.srHits += 1;
        this.srBonus += SPEEDRUN_HIT_SCORE;
        this.stats.score += SPEEDRUN_HIT_SCORE;
      } else {
        this.srMisses += 1;
      }
      const state = this.scoreWord(word.data, word.ok);
      this.emitSpeedrun(true);
      if (state === "over") this.finishGameOver();
      return true;
    }
    return true; // Tap im Speedrun nie als Sprung werten
  }

  private startCountdown() {
    this.mode = "countdown";
    this.srTime = SPEEDRUN_COUNTDOWN;
    this.srHits = 0;
    this.srMisses = 0;
    this.srBonus = 0;
    this.srWords = [];
    this.srSpawnIn = 0;
    this.vy = 0;
    this.grounded = true;
    this.emitSpeedrun(true);
  }

  private spawnSpeedWord() {
    if (this.srWords.length >= SPEEDRUN_MAX_WORDS) return;
    const used = new Set(this.srWords.map((word) => word.slot));
    const free: number[] = [];
    for (let i = 0; i < SPEEDRUN_MAX_WORDS; i++) if (!used.has(i)) free.push(i);
    if (free.length === 0) return;
    const slot = free[Math.floor(Math.random() * free.length)];

    const correctOnScreen = this.srWords.filter((word) => !word.hit && word.data.isGreeting).length;
    const wantGreeting = correctOnScreen < 1 ? true : Math.random() < 0.45;
    const data = this.pickWhere(wantGreeting);

    const ctx = this.ctx;
    ctx.font = "700 17px system-ui, sans-serif";
    const w = Math.max(96, ctx.measureText(data.word).width + 34);
    const h = 46; // Trefferflaeche >= 44px
    const cols = 2;
    const rows = Math.ceil(SPEEDRUN_MAX_WORDS / cols);
    const col = slot % cols;
    const row = Math.floor(slot / cols);
    const cellW = this.w / cols;
    const cellH = Math.max(58, (this.h - 40) / rows);
    const jitter = (Math.random() - 0.5) * Math.max(0, cellW - w - 16);
    const x = Math.min(this.w - w - 8, Math.max(8, col * cellW + (cellW - w) / 2 + jitter));
    const y = Math.min(this.h - h - 8, 18 + row * cellH);

    this.srWords.push({
      x,
      y,
      w,
      h,
      data,
      slot,
      ttl: SPEEDRUN_WORD_TTL,
      hit: false,
      flash: 0,
      ok: false,
    });
  }

  private endSpeedrun() {
    if (this.srMisses === 0 && this.srHits > 0) {
      this.srBonus += SPEEDRUN_PERFECT_BONUS;
      this.stats.score += SPEEDRUN_PERFECT_BONUS;
    }
    this.emit();
    this.mode = "run";
    this.srWords = [];
    this.srTime = 0;
    this.stairIn = SPEEDRUN_COOLDOWN + Math.random() * 15;
    this.spawnIn = Math.max(this.spawnIn, 0.8);
    // Kleiner Absprung zurueck in den normalen Lauf.
    this.vy = -420;
    this.grounded = false;
    this.onSpeedrun?.(null);
    if (this.pendingComplete) {
      this.pendingComplete = false;
      this.finishLevel();
    }
  }

  private frame = (ts: number) => {
    if (!this.running) return;
    if (!this.last) this.last = ts;
    const dt = Math.min(0.05, (ts - this.last) / 1000);
    this.last = ts;
    if (this.srEmitIn > 0) this.srEmitIn -= dt;

    // ---- Speedrun / Countdown: Welt steht still ----
    if (this.mode !== "run") {
      this.srTime -= dt;
      if (this.mode === "countdown") {
        this.emitSpeedrun();
        if (this.srTime <= 0) {
          this.mode = "speedrun";
          this.srTime = SPEEDRUN_DURATION;
          this.srSpawnIn = 0;
          this.emitSpeedrun(true);
        }
      } else {
        this.srSpawnIn -= dt;
        if (this.srSpawnIn <= 0) {
          this.spawnSpeedWord();
          this.srSpawnIn =
            SPEEDRUN_SPAWN_GAP.min +
            Math.random() * (SPEEDRUN_SPAWN_GAP.max - SPEEDRUN_SPAWN_GAP.min);
        }
        for (const word of this.srWords) {
          if (word.hit) word.flash -= dt;
          else word.ttl -= dt;
        }
        this.srWords = this.srWords.filter((word) => (word.hit ? word.flash > 0 : word.ttl > 0));
        this.emitSpeedrun();
        if (this.stats.correct >= this.stats.goal) this.pendingComplete = true;
        if (this.srTime <= 0) this.endSpeedrun();
      }
      this.draw();
      this.raf = requestAnimationFrame(this.frame);
      return;
    }

    this.elapsed += dt;
    this.runPhase += dt * 10;

    // Spieler
    const prevFeet = this.playerY;
    this.vy += GRAVITY * dt;
    this.playerY += this.vy * dt;
    const support = this.supportY(prevFeet);
    if (this.playerY >= support) {
      this.playerY = support;
      this.vy = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    const speed = this.speed() * (this.stumble > 0 ? 0.6 : 1);
    if (this.stumble > 0) this.stumble -= dt;

    // Steintreppe
    this.stairIn -= dt;
    if (this.stairIn <= 0 && this.steps.length === 0) {
      this.spawnStairs();
      this.stairIn = SPEEDRUN_COOLDOWN;
    }
    for (const s of this.steps) {
      s.x -= speed * dt;
      if (
        s.top &&
        !s.triggered &&
        this.grounded &&
        Math.abs(this.playerY - s.y) < 1.5 &&
        34 + 26 > s.x &&
        34 < s.x + s.w
      ) {
        s.triggered = true;
        this.startCountdown();
      }
    }
    this.steps = this.steps.filter((s) => s.x + s.w > -20);

    // Woerter – waehrend der Treppenpassage pausiert
    const stairsActive = this.steps.length > 0;
    this.spawnIn -= dt;
    if (this.spawnIn <= 0) {
      if (!stairsActive) this.spawn();
      this.spawnIn = stairsActive ? 0.4 : Math.max(0.7, this.level.spawnGap - this.elapsed * 0.006);
    }

    for (const t of this.tokens) {
      t.x -= speed * dt;
      if (t.flash > 0) t.flash -= dt;
      if (!t.hit && this.collide(t)) {
        t.hit = true;
        t.flash = 0.45;
        t.ok = t.data.isGreeting;
        const state = this.scoreWord(t.data, t.ok);
        if (state === "over") {
          this.finishGameOver();
          return;
        }
        if (this.stats.correct >= this.stats.goal) {
          this.finishLevel();
          return;
        }
      }
    }
    this.tokens = this.tokens.filter((t) => t.x + t.w > -40 && !(t.hit && t.flash <= 0));

    for (const l of this.lifeItems) {
      l.x -= speed * dt;
      if (l.flash > 0) l.flash -= dt;
      if (!l.hit && this.collide(l)) {
        l.hit = true;
        l.flash = 0.5;
        if (this.stats.lives < MAX_LIVES) {
          this.stats.lives += 1;
          this.stats.score += 50;
          this.onLife?.();
          this.emit();
        }
      }
    }
    this.lifeItems = this.lifeItems.filter((l) => l.x + l.w > -40 && !(l.hit && l.flash <= 0));

    for (const o of this.obstacles) {
      o.x -= speed * dt;
      if (this.collide(o) && this.stumble <= 0) this.stumble = 0.5;
    }
    this.obstacles = this.obstacles.filter((o) => o.x + o.w > -20);

    this.draw();
    this.raf = requestAnimationFrame(this.frame);
  };

  private draw() {
    const ctx = this.ctx;
    const g = this.groundY();
    ctx.clearRect(0, 0, this.w, this.h);

    // Boden
    ctx.strokeStyle = "rgba(148,163,184,0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, g + 2);
    ctx.lineTo(this.w, g + 2);
    ctx.stroke();

    // Steintreppe
    for (const s of this.steps) {
      ctx.fillStyle = s.top ? "rgba(148,163,184,0.55)" : "rgba(100,116,139,0.5)";
      ctx.fillRect(s.x, s.y, s.w, g + 2 - s.y);
      ctx.strokeStyle = "rgba(203,213,225,0.55)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(s.x + 0.75, s.y + 0.75, s.w - 1.5, g + 2 - s.y - 1.5);
      if (s.top && !s.triggered) {
        ctx.font = "16px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#ffffff";
        ctx.fillText("⚡", s.x + s.w / 2, s.y - 14);
      }
    }

    // Woerter
    for (const t of this.tokens) {
      const alpha = t.hit ? Math.max(0, t.flash / 0.45) : 1;
      ctx.globalAlpha = alpha;
      const fill = t.hit
        ? t.ok
          ? "rgba(34,197,94,0.9)"
          : "rgba(239,68,68,0.9)"
        : "rgba(15,23,42,0.72)";
      const stroke = t.hit ? "rgba(255,255,255,0.6)" : "rgba(148,163,184,0.55)";
      roundRect(ctx, t.x, t.y, t.w, t.h, 14);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "600 16px system-ui, sans-serif";
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillText(t.data.word, t.x + t.w / 2, t.y + t.h / 2 + 1);
      ctx.globalAlpha = 1;
    }

    // Extra-Leben (kleine Aufwaerts-Animation beim Einsammeln)
    for (const l of this.lifeItems) {
      const p = l.hit ? Math.max(0, l.flash / 0.5) : 1;
      ctx.globalAlpha = l.hit ? p : 1;
      const lift = l.hit ? (1 - p) * 26 : 0;
      const size = l.hit ? 24 + (1 - p) * 10 : 24;
      ctx.font = `${size}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("❤️", l.x + l.w / 2, l.y + l.h / 2 - lift);
      ctx.globalAlpha = 1;
    }

    // Hindernisse
    ctx.fillStyle = "rgba(148,163,184,0.75)";
    for (const o of this.obstacles) ctx.fillRect(o.x, o.y, o.w, o.h);

    // Speedrun-Woerter (anklickbar)
    if (this.mode !== "run") {
      ctx.fillStyle = "rgba(2,6,23,0.45)";
      ctx.fillRect(0, 0, this.w, this.h);
    }
    for (const word of this.srWords) {
      const p = word.hit ? Math.max(0, word.flash / 0.4) : 1;
      ctx.globalAlpha = word.hit ? p : 1;
      roundRect(ctx, word.x, word.y, word.w, word.h, 16);
      ctx.fillStyle = word.hit
        ? word.ok
          ? "rgba(34,197,94,0.95)"
          : "rgba(239,68,68,0.95)"
        : "rgba(15,23,42,0.92)";
      ctx.fill();
      ctx.strokeStyle = "rgba(226,232,240,0.7)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 17px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(word.data.word, word.x + word.w / 2, word.y + word.h / 2 + 1);
      ctx.globalAlpha = 1;
    }

    // Spieler
    const px = 34;
    const py = this.playerY - 30;
    ctx.fillStyle = "oklch(0.78 0.19 150)";
    roundRect(ctx, px, py, 26, 30, 9);
    ctx.fill();
    ctx.fillStyle = "rgba(2,6,23,0.85)";
    ctx.beginPath();
    ctx.arc(px + 17, py + 11, 3, 0, Math.PI * 2);
    ctx.fill();
    // Beine (kleine Laufbewegung)
    const swing = this.grounded && this.mode === "run" ? Math.sin(this.runPhase) * 4 : 2;
    ctx.strokeStyle = "oklch(0.78 0.19 150)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px + 8, py + 30);
    ctx.lineTo(px + 8 - swing, py + 38);
    ctx.moveTo(px + 18, py + 30);
    ctx.lineTo(px + 18 + swing, py + 38);
    ctx.stroke();
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
