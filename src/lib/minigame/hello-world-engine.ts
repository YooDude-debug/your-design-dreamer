/**
 * Spiellogik "Hello World" (Level 1) – bewusst getrennt von der Y-Dude-UI.
 *
 * Die Engine rendert auf ein Canvas und meldet Zustandsaenderungen ueber
 * Callbacks. Kein React-State pro Frame, ein einziger requestAnimationFrame.
 */
import type { GameLevel, GameWord } from "./levels";

export type GameStats = {
  score: number;
  correct: number;
  errors: number;
  combo: number;
  /** Faelschlich eingesammelte Woerter (Fehleranalyse). */
  mistakes: GameWord[];
};

export const MAX_ERRORS = 5;

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

type Obstacle = { x: number; y: number; w: number; h: number };

type Options = {
  canvas: HTMLCanvasElement;
  level: GameLevel;
  onStats: (stats: GameStats) => void;
  onGameOver: (stats: GameStats) => void;
};

const GRAVITY = 2000;
const JUMP_V = -700;

export class HelloWorldGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private level: GameLevel;
  private onStats: (s: GameStats) => void;
  private onGameOver: (s: GameStats) => void;

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
  private obstacles: Obstacle[] = [];
  private stumble = 0;

  private stats: GameStats = { score: 0, correct: 0, errors: 0, combo: 0, mistakes: [] };

  constructor(opts: Options) {
    this.canvas = opts.canvas;
    const ctx = opts.canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d context unavailable");
    this.ctx = ctx;
    this.level = opts.level;
    this.onStats = opts.onStats;
    this.onGameOver = opts.onGameOver;
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
    if (this.grounded) this.playerY = this.groundY();
  }

  private groundY() {
    return this.h - 46;
  }

  private speed() {
    // Level 1 startet ruhig und wird langsam schneller (fair spielbar).
    return Math.min(320, 190 + this.elapsed * 1.6);
  }

  start() {
    this.stats = { score: 0, correct: 0, errors: 0, combo: 0, mistakes: [] };
    this.tokens = [];
    this.obstacles = [];
    this.elapsed = 0;
    this.spawnIn = 0.8;
    this.vy = 0;
    this.grounded = true;
    this.playerY = this.groundY();
    this.running = true;
    this.last = 0;
    this.onStats({ ...this.stats });
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  jump() {
    if (!this.running) return;
    if (!this.grounded) return;
    this.vy = JUMP_V;
    this.grounded = false;
  }

  private pick(): GameWord {
    const words = this.level.words;
    return words[Math.floor(Math.random() * words.length)];
  }

  private spawn() {
    const ctx = this.ctx;
    const data = this.pick();
    ctx.font = "600 16px system-ui, sans-serif";
    const tw = ctx.measureText(data.word).width;
    const w = tw + 26;
    const h = 32;
    const high = Math.random() < 0.45;
    const y = high ? this.groundY() - 96 : this.groundY() - 34;
    this.tokens.push({ x: this.w + 20, y, w, h, data, hit: false, flash: 0, ok: false });

    // Gelegentlich ein Hindernis – kein Fehler, nur kurzes Stolpern.
    if (this.elapsed > 12 && Math.random() < 0.25) {
      this.obstacles.push({ x: this.w + 20 + w + 120, y: this.groundY() - 18, w: 14, h: 18 });
    }
  }

  private collide(t: { x: number; y: number; w: number; h: number }) {
    const px = 34;
    const pw = 26;
    const ph = 30;
    const py = this.playerY - ph;
    return px < t.x + t.w && px + pw > t.x && py < t.y + t.h && py + ph > t.y;
  }

  private frame = (ts: number) => {
    if (!this.running) return;
    if (!this.last) this.last = ts;
    const dt = Math.min(0.05, (ts - this.last) / 1000);
    this.last = ts;
    this.elapsed += dt;
    this.runPhase += dt * 10;

    // Spieler
    this.vy += GRAVITY * dt;
    this.playerY += this.vy * dt;
    if (this.playerY >= this.groundY()) {
      this.playerY = this.groundY();
      this.vy = 0;
      this.grounded = true;
    }

    const speed = this.speed() * (this.stumble > 0 ? 0.6 : 1);
    if (this.stumble > 0) this.stumble -= dt;

    // Woerter
    this.spawnIn -= dt;
    if (this.spawnIn <= 0) {
      this.spawn();
      this.spawnIn = Math.max(0.75, 1.25 - this.elapsed * 0.006);
    }

    for (const t of this.tokens) {
      t.x -= speed * dt;
      if (t.flash > 0) t.flash -= dt;
      if (!t.hit && this.collide(t)) {
        t.hit = true;
        t.flash = 0.45;
        if (t.data.isGreeting) {
          t.ok = true;
          this.stats.combo += 1;
          this.stats.correct += 1;
          this.stats.score += 100 + Math.min(100, (this.stats.combo - 1) * 25);
        } else {
          t.ok = false;
          this.stats.combo = 0;
          this.stats.errors += 1;
          this.stats.mistakes.push(t.data);
        }
        this.onStats({ ...this.stats, mistakes: [...this.stats.mistakes] });
        if (this.stats.errors >= MAX_ERRORS) {
          this.running = false;
          this.draw();
          this.stop();
          this.onGameOver({ ...this.stats, mistakes: [...this.stats.mistakes] });
          return;
        }
      }
    }
    this.tokens = this.tokens.filter((t) => t.x + t.w > -40 && !(t.hit && t.flash <= 0));

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

    // Hindernisse
    ctx.fillStyle = "rgba(148,163,184,0.75)";
    for (const o of this.obstacles) ctx.fillRect(o.x, o.y, o.w, o.h);

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
    const swing = this.grounded ? Math.sin(this.runPhase) * 4 : 2;
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
