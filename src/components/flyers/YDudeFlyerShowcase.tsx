import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  Building2,
  Globe2,
  Heart,
  MapPin,
  MessageCircle,
  Play,
  ShoppingBag,
  Sparkles,
  UserRound,
  UsersRound,
  Volume2,
} from "lucide-react";

import globeImage from "@/assets/globe.png";
import logoLockup from "@/assets/ydude-wordmark-lockup.png";
import feedScreenshot from "../../../public/screenshots/feed-slangtag.jpg";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FlyerFormat = "a4" | "feed" | "story";

const formats: Array<{ id: FlyerFormat; label: string; detail: string }> = [
  { id: "a4", label: "A4", detail: "Print · Hochformat" },
  { id: "feed", label: "Feed", detail: "1080 × 1350" },
  { id: "story", label: "Story", detail: "1080 × 1920" },
];

const aspectClasses: Record<FlyerFormat, string> = {
  a4: "aspect-[210/297]",
  feed: "aspect-[4/5]",
  story: "aspect-[9/16]",
};

const spacingClasses: Record<FlyerFormat, string> = {
  a4: "p-[7%]",
  feed: "p-[7%]",
  story: "p-[8%]",
};

function FlyerLogo({ compact = false }: { compact?: boolean }) {
  return (
    <img
      src={logoLockup}
      alt="Y-Dude – Speak Local. Connect Global."
      className={cn("h-auto object-contain object-left", compact ? "w-[27%]" : "w-[34%]")}
    />
  );
}

function StaticWave({ bars = 18, className }: { bars?: number; className?: string }) {
  return (
    <div aria-hidden className={cn("flex items-center justify-center gap-[1.5%]", className)}>
      {Array.from({ length: bars }, (_, index) => {
        const heights = [26, 48, 72, 42, 88, 56, 34, 80, 96, 51, 76, 39];
        return (
          <span
            key={index}
            className="w-[2.2%] min-w-px rounded-full bg-brand shadow-glow-subtle"
            style={{ height: `${heights[index % heights.length]}%` }}
          />
        );
      })}
    </div>
  );
}

function MiniTag({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[0.35em] rounded-full border px-[0.8em] py-[0.42em] font-black uppercase",
        muted
          ? "border-border/80 bg-surface/80 text-foreground"
          : "border-brand/45 bg-brand/10 text-brand shadow-glow-subtle",
      )}
    >
      {children}
      <Volume2 className="h-[1em] w-[1em]" aria-hidden />
    </span>
  );
}

function FlyerOne({ format }: { format: FlyerFormat }) {
  const story = format === "story";

  return (
    <article
      aria-label="Flyer 1: Slang Has a Sound"
      className={cn(
        "relative isolate overflow-hidden bg-background text-foreground [container-type:inline-size]",
        aspectClasses[format],
        spacingClasses[format],
      )}
    >
      <div aria-hidden className="absolute inset-x-[7%] top-[28%] h-px bg-gradient-brand opacity-35" />
      <div
        aria-hidden
        className="absolute left-1/2 top-[51%] h-[35%] w-[65%] -translate-x-1/2 rounded-full bg-brand/10 blur-3xl"
      />

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-start justify-between">
          <FlyerLogo compact />
          <span className="mt-[1%] text-[clamp(5px,2.4cqw,12px)] font-bold uppercase text-muted-foreground">
            01 / Sound
          </span>
        </div>

        <header className={cn(story ? "mt-[18%]" : "mt-[10%]") }>
          <p className="text-[clamp(6px,2.7cqw,14px)] font-bold uppercase text-brand">
            Ein Wort. Ein Sound. Eine Bedeutung.
          </p>
          <h2 className="mt-[2%] max-w-[86%] text-[clamp(24px,13cqw,68px)] font-black uppercase leading-[0.88]">
            Slang has
            <br />
            a <span className="text-brand">sound.</span>
          </h2>
          <p className="mt-[3%] text-[clamp(8px,3.4cqw,18px)] font-semibold text-muted-foreground">
            Y-Dude macht Sprache hörbar.
          </p>
        </header>

        <div className={cn("relative flex flex-1 items-center justify-center", story ? "my-[8%]" : "my-[3%]") }>
          <div className="relative flex w-full items-center justify-center">
            <div aria-hidden className="absolute h-[150%] w-[72%] rounded-full border border-brand/15" />
            <div aria-hidden className="absolute h-[105%] w-[55%] rounded-full border border-brand/25" />
            <div className="relative flex w-[88%] items-center gap-[5%] rounded-[2rem] border border-brand/55 bg-surface/90 px-[7%] py-[6%] shadow-glow backdrop-blur-xl">
              <span className="grid aspect-square w-[18%] place-items-center rounded-full border border-brand bg-brand/15 text-brand">
                <Play className="h-[42%] w-[42%] fill-current" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <strong className="block text-[clamp(22px,13cqw,76px)] font-black uppercase leading-none text-brand">
                  #Moin
                </strong>
                <StaticWave className="mt-[6%] h-[clamp(14px,7cqw,40px)] w-full" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-[2%] text-[clamp(6px,2.6cqw,14px)]">
          <MiniTag>#Bro</MiniTag>
          <MiniTag muted>#Digga</MiniTag>
          <MiniTag>#Yassas</MiniTag>
          <MiniTag muted>#Mate</MiniTag>
        </div>

        <div className={cn("flex items-end justify-between gap-[5%] border-t border-border/70 pt-[4%]", story ? "mt-[10%]" : "mt-[6%]") }>
          <p className="max-w-[53%] text-[clamp(7px,3cqw,16px)] font-semibold leading-[1.35]">
            Entdecke Wörter.<br />Hör ihre Sounds.<br />Teile deinen Slang.
          </p>
          <div className="text-right">
            <p className="text-[clamp(6px,2.4cqw,13px)] font-black uppercase text-brand">
              Speak local. Connect global.
            </p>
            <p className="mt-[3%] text-[clamp(8px,3.4cqw,18px)] font-black uppercase">Y-Dude.com</p>
          </div>
        </div>
      </div>
    </article>
  );
}

const globePins = [
  { place: "Berlin", tag: "#Moin", className: "left-[6%] top-[36%]" },
  { place: "Athen", tag: "#Yassas", className: "right-[1%] top-[45%]" },
  { place: "London", tag: "#Mate", className: "left-[4%] top-[62%]" },
  { place: "New York", tag: "#Yo", className: "right-[3%] top-[68%]" },
  { place: "Tokyo", tag: "#Yabai", className: "right-[16%] top-[19%]" },
];

function FlyerTwo({ format }: { format: FlyerFormat }) {
  const story = format === "story";

  return (
    <article
      aria-label="Flyer 2: The World Speaks Different"
      className={cn(
        "relative isolate overflow-hidden bg-background text-foreground [container-type:inline-size]",
        aspectClasses[format],
        spacingClasses[format],
      )}
    >
      <div aria-hidden className="absolute inset-0 opacity-25 [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:8%_8%]" />
      <div aria-hidden className="absolute inset-x-0 top-[30%] h-[56%] bg-[radial-gradient(circle,var(--brand)/0.15,transparent_68%)]" />

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-start justify-between">
          <FlyerLogo compact />
          <div className="flex items-center gap-[0.5em] text-[clamp(5px,2.4cqw,12px)] font-bold uppercase text-muted-foreground">
            <Globe2 className="h-[1.15em] w-[1.15em] text-brand" /> Global voices
          </div>
        </div>

        <header className={cn("text-center", story ? "mt-[14%]" : "mt-[7%]") }>
          <h2 className="text-[clamp(22px,11.6cqw,62px)] font-black uppercase leading-[0.9]">
            The world speaks
            <br />
            <span className="text-brand">different.</span>
          </h2>
          <p className="mt-[3%] text-[clamp(8px,3.4cqw,18px)] font-semibold text-muted-foreground">
            Y-Dude zeigt dir, wie.
          </p>
        </header>

        <div className={cn("relative flex min-h-0 flex-1 items-center justify-center", story ? "my-[5%]" : "my-[1%]") }>
          <div
            className={cn(
              "relative aspect-square",
              format === "feed" ? "w-[59%]" : format === "a4" ? "w-[84%]" : "w-[91%]",
            )}
          >
            <div aria-hidden className="absolute inset-[9%] rounded-full border border-brand/25 shadow-glow" />
            <div aria-hidden className="absolute inset-[3%] rounded-full border border-brand/10" />
            <img
              src={globeImage}
              alt="Y-Dude Slang Globe mit vernetzten Orten"
              className="h-full w-full object-contain drop-shadow-[0_0_24px_var(--brand)]"
            />
            {globePins.map((pin) => (
              <div
                key={pin.place}
                className={cn(
                  "absolute rounded-full border border-brand/45 bg-surface/90 px-[3%] py-[1.5%] shadow-glow-subtle backdrop-blur-md",
                  pin.className,
                )}
              >
                <p className="flex items-center gap-[0.3em] text-[clamp(5px,1.9cqw,10px)] font-bold uppercase text-muted-foreground">
                  <MapPin className="h-[1em] w-[1em] text-brand" /> {pin.place}
                </p>
                <p className="mt-[0.15em] text-[clamp(7px,2.8cqw,15px)] font-black uppercase text-brand">
                  {pin.tag} <Volume2 className="inline h-[1em] w-[1em]" />
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <p className="text-[clamp(8px,3.3cqw,18px)] font-black uppercase leading-[1.25]">
            Neue Wörter. <span className="text-brand">Neue Sounds.</span> Neue Perspektiven.
          </p>
          <p className="mt-[2%] text-[clamp(7px,2.8cqw,15px)] text-muted-foreground">
            Entdecke Slang aus aller Welt.
          </p>
          <p className="mt-[1.5%] text-[clamp(4px,1.7cqw,9px)] text-muted-foreground/70">
            Orte und Begriffe dienen als visuelle Beispiele, nicht als exklusive Zuordnung.
          </p>
        </div>

        <div className={cn("flex items-center justify-between border-t border-brand/25 pt-[4%]", story ? "mt-[9%]" : "mt-[5%]") }>
          <p className="text-[clamp(6px,2.4cqw,13px)] font-black uppercase text-brand">
            Speak local. Connect global.
          </p>
          <p className="text-[clamp(8px,3.4cqw,18px)] font-black uppercase">Y-Dude.com</p>
        </div>
      </div>
    </article>
  );
}

const socialNodes = [
  { label: "Profil", icon: UserRound, className: "left-[2%] top-[8%]" },
  { label: "Community", icon: UsersRound, className: "right-[0%] top-[19%]" },
  { label: "Creator", icon: Sparkles, className: "left-[0%] bottom-[18%]" },
  { label: "Market", icon: ShoppingBag, className: "right-[3%] bottom-[8%]" },
];

function FlyerThree({ format }: { format: FlyerFormat }) {
  const story = format === "story";

  return (
    <article
      aria-label="Flyer 3: Your Word. Your Sound. Your World."
      className={cn(
        "relative isolate overflow-hidden bg-background text-foreground [container-type:inline-size]",
        aspectClasses[format],
        spacingClasses[format],
      )}
    >
      <div aria-hidden className="absolute bottom-0 right-0 h-[55%] w-[55%] bg-brand/10 blur-3xl" />
      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-start justify-between">
          <FlyerLogo compact />
          <span className="rounded-full border border-brand/35 bg-brand/10 px-[0.8em] py-[0.4em] text-[clamp(5px,2.2cqw,11px)] font-black uppercase text-brand">
            Social Slang
          </span>
        </div>

        <header className={cn(story ? "mt-[15%]" : "mt-[7%]") }>
          <h2
            className={cn(
              "font-black uppercase leading-[0.91]",
              format === "feed"
                ? "text-[clamp(22px,8.4cqw,44px)]"
                : "text-[clamp(22px,11cqw,58px)]",
            )}
          >
            Your word.<br />
            Your <span className="text-brand">sound.</span><br />
            Your world.
          </h2>
          <p className="mt-[3%] max-w-[68%] text-[clamp(8px,3.2cqw,17px)] font-semibold text-muted-foreground">
            Auf Y-Dude wird aus Slang ein Social Tag.
          </p>
        </header>

        <div className={cn("relative flex min-h-0 flex-1 items-center", story ? "my-[8%]" : "my-[3%]") }>
          <div
            className={cn(
              "relative mx-auto w-full",
              format === "feed" ? "aspect-[5/3]" : "aspect-[5/4]",
            )}
          >
            <div className="absolute left-1/2 top-1/2 z-20 flex w-[58%] -translate-x-1/2 -translate-y-1/2 items-center gap-[5%] rounded-[1.5rem] border border-brand/55 bg-surface/95 p-[5%] shadow-glow backdrop-blur-xl">
              <span className="grid aspect-square w-[22%] place-items-center rounded-full bg-brand text-primary-foreground">
                <Play className="h-[42%] w-[42%] fill-current" />
              </span>
              <div className="min-w-0 flex-1">
                <strong className="text-[clamp(14px,6.6cqw,34px)] font-black uppercase leading-none text-brand">
                  #DeinSlang
                </strong>
                <StaticWave bars={12} className="mt-[7%] h-[clamp(10px,5cqw,28px)] w-full" />
              </div>
            </div>

            <div
              className={cn(
                "absolute left-1/2 top-1/2 z-10 aspect-[4/5] max-h-full -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[1.5rem] border border-border/80 bg-surface opacity-35",
                format === "feed" ? "h-[76%]" : "h-[110%]",
              )}
            >
              <img
                src={feedScreenshot}
                alt="Ausschnitt der echten Y-Dude Feed-Oberfläche"
                className="h-full w-full object-cover object-top"
              />
            </div>

            <svg aria-hidden viewBox="0 0 100 80" className="absolute inset-0 h-full w-full text-brand/45">
              <path d="M50 40 L16 14 M50 40 L84 22 M50 40 L14 66 M50 40 L86 70" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" />
            </svg>

            {socialNodes.map(({ label, icon: Icon, className }) => (
              <div
                key={label}
                className={cn(
                  "absolute z-30 flex items-center gap-[0.45em] rounded-full border border-border bg-surface/95 px-[3%] py-[2%] text-[clamp(6px,2.3cqw,12px)] font-bold uppercase shadow-subtle backdrop-blur-md",
                  className,
                  format === "feed" && label === "Creator" && "!bottom-[34%]",
                  format === "feed" && label === "Market" && "!bottom-[34%]",
                )}
              >
                <Icon className="h-[1.2em] w-[1.2em] text-brand" /> {label}
              </div>
            ))}

            <div className="absolute bottom-[1%] left-1/2 z-30 flex -translate-x-1/2 items-center gap-[0.7em] text-brand">
              <Heart className="h-[clamp(10px,4cqw,22px)] w-[clamp(10px,4cqw,22px)]" />
              <MessageCircle className="h-[clamp(10px,4cqw,22px)] w-[clamp(10px,4cqw,22px)]" />
              <Building2 className="h-[clamp(10px,4cqw,22px)] w-[clamp(10px,4cqw,22px)]" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 border-y border-border/70 py-[3%] text-center text-[clamp(7px,3cqw,16px)] font-black uppercase">
          <span>Discover.</span>
          <span className="border-x border-border/70 text-brand">Create.</span>
          <span>Connect.</span>
        </div>

        <div className={cn("flex items-end justify-between gap-[4%]", story ? "mt-[9%]" : "mt-[5%]") }>
          <p className="max-w-[56%] text-[clamp(6px,2.5cqw,13px)] font-semibold leading-[1.45] text-muted-foreground">
            Erstelle deinen SlangTag.<br />Teile ihn mit deiner Community.<br />Entdecke neue Sounds.
          </p>
          <div className="text-right">
            <p className="inline-flex items-center gap-[0.4em] text-[clamp(8px,3.4cqw,18px)] font-black uppercase text-brand">
              Join Y-Dude <ArrowRight className="h-[1em] w-[1em]" />
            </p>
            <p className="mt-[2%] text-[clamp(7px,2.8cqw,15px)] font-black uppercase">Y-Dude.com</p>
            <p className="mt-[1%] text-[clamp(4px,1.7cqw,9px)] font-semibold text-muted-foreground">
              Speak local. Connect Global.
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

const flyers = [
  {
    number: "01",
    title: "Slang Has a Sound",
    description: "Sound-first · reduziert · SlangTag als Hauptmotiv",
    render: (format: FlyerFormat) => <FlyerOne format={format} />,
  },
  {
    number: "02",
    title: "The World Speaks Different",
    description: "Location-first · räumlich · Slang Globe als Kulturwelt",
    render: (format: FlyerFormat) => <FlyerTwo format={format} />,
  },
  {
    number: "03",
    title: "Your Word. Your Sound.",
    description: "Social-first · Community · echte Y-Dude-Oberfläche",
    render: (format: FlyerFormat) => <FlyerThree format={format} />,
  },
];

export function YDudeFlyerShowcase() {
  const [format, setFormat] = useState<FlyerFormat>("a4");

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border/70 px-4 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase text-brand">Y-Dude Campaign Studio · 2026</p>
            <h1 className="mt-2 max-w-4xl text-3xl font-black uppercase leading-none sm:text-5xl">
              Drei Welten. Ein <span className="text-brand">SlangTag.</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Drei eigenständige Richtungen, verbunden durch Sound, Orte, Menschen und die echte Y-Dude-Oberfläche.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2" aria-label="Flyerformat wählen">
            {formats.map((item) => (
              <Button
                key={item.id}
                type="button"
                variant={format === item.id ? "default" : "outline"}
                aria-pressed={format === item.id}
                onClick={() => setFormat(item.id)}
                className="h-auto min-w-0 flex-col gap-0.5 px-3 py-2"
              >
                <span className="font-black uppercase">{item.label}</span>
                <span className="hidden text-[10px] font-normal opacity-70 sm:block">{item.detail}</span>
              </Button>
            ))}
          </div>
        </div>
      </header>

      <section className="px-4 py-8 sm:px-8 lg:px-12 lg:py-12" aria-label="Flyer-Vergleich">
        <div className="mx-auto grid max-w-[1500px] items-start gap-10 lg:grid-cols-3 lg:gap-6 xl:gap-8">
          {flyers.map((flyer) => (
            <div key={flyer.number}>
              <div className="mb-3 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-black text-brand">RICHTUNG {flyer.number}</p>
                  <h2 className="mt-1 text-lg font-black uppercase">{flyer.title}</h2>
                </div>
                <p className="max-w-[48%] text-right text-[11px] leading-snug text-muted-foreground">
                  {flyer.description}
                </p>
              </div>
              <div className="mx-auto w-full max-w-[520px] overflow-hidden border border-border bg-surface shadow-card">
                {flyer.render(format)}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}