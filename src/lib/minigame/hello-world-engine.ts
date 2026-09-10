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
  /** Zusaetzliche Leben (fangen je einen Fehler ab). */
  lives: number;
  /** Ziel an richtigen Woertern fuer den Levelabschluss. */
  goal: number;
  /** Faelschlich eingesammelte Woerter (Fehleranalyse). */
  mistakes: GameWord[];
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
    // Level-abhaengig: ruhiger Start, langsame Steigerung (fair spielbar).
    return Math.min(this.level.maxSpeed, this.level.baseSpeed + this.elapsed * 1.6);
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
    this.bag = [];
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
      this.spawnIn = Math.max(0.7, this.level.spawnGap - this.elapsed * 0.006);
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
          this.onLearn?.(t.data);
        } else {
          t.ok = false;
          this.stats.combo = 0;
          if (this.stats.lives > 0) {
            // Extra-Leben faengt den Fehler ab.
            this.stats.lives -= 1;
          } else {
            this.stats.errors += 1;
          }
          this.stats.mistakes.push(t.data);
        }
        this.emit();
        if (this.stats.errors >= MAX_ERRORS) {
          this.running = false;
          this.draw();
          this.stop();
          this.onGameOver({ ...this.stats, mistakes: [...this.stats.mistakes] });
          return;
        }
        if (this.stats.correct >= this.stats.goal) {
          this.running = false;
          this.draw();
          this.stop();
          this.onLevelComplete?.({ ...this.stats, mistakes: [...this.stats.mistakes] });
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
