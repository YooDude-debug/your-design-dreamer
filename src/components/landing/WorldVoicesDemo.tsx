import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import berlin from "@/assets/berlin.jpg";
import rostock from "@/assets/rostock.jpg";
import athens from "@/assets/athens.jpg";
import thessaloniki from "@/assets/thessaloniki.jpg";
import tokyo from "@/assets/tokyo.jpg";
import rio from "@/assets/rio.jpg";
import { useLang } from "@/lib/lang-context";

/**
 * Visueller Demo-Slider "So klingt die Welt".
 *
 * Reine Anschauung: feste Beispiel-Ausdrücke aus dem Projekt, keine Nutzer,
 * keine Likes, keine Community-Zahlen, keine Datenbank- oder Netzabfragen.
 * Der Bereich ist sichtbar als Beispiel/Demo gekennzeichnet.
 */

const TEXTS = {
  de: {
    title: "So klingt die Welt",
    lead: "Regionale Stimmen. Echte Ausdrücke.",
    demo: "Beispiel-Ansicht – Demo ohne Nutzerdaten",
    prev: "Vorheriges Beispiel",
    next: "Nächstes Beispiel",
    swipe: "Wischen oder Pfeile nutzen",
  },
  en: {
    title: "This is how the world sounds",
    lead: "Regional voices. Real expressions.",
    demo: "Example view – demo without user data",
    prev: "Previous example",
    next: "Next example",
    swipe: "Swipe or use the arrows",
  },
  el: {
    title: "Έτσι ηχεί ο κόσμος",
    lead: "Τοπικές φωνές. Αυθεντικές εκφράσεις.",
    demo: "Παράδειγμα – demo χωρίς δεδομένα χρηστών",
    prev: "Προηγούμενο παράδειγμα",
    next: "Επόμενο παράδειγμα",
    swipe: "Σύρε ή χρησιμοποίησε τα βέλη",
  },
} as const;

const SLIDES = [
  { image: rostock, tag: "Moinmoin", region: "Rostock, Germany" },
  { image: berlin, tag: "Alter", region: "Berlin, Germany" },
  { image: thessaloniki, tag: "Kapsoura", region: "Thessaloniki, Greece" },
  { image: athens, tag: "Malaka", region: "Athens, Greece" },
  { image: tokyo, tag: "Yabai", region: "Tokyo, Japan" },
  { image: rio, tag: "Massa", region: "Rio de Janeiro, Brazil" },
] as const;

export function WorldVoicesDemo() {
  const { lang } = useLang();
  const t = TEXTS[lang as keyof typeof TEXTS] ?? TEXTS.de;
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const goTo = (next: number) => {
    const clamped = (next + SLIDES.length) % SLIDES.length;
    setIndex(clamped);
    const track = trackRef.current;
    const card = track?.children[clamped] as HTMLElement | undefined;
    if (track && card) track.scrollTo({ left: card.offsetLeft, behavior: "smooth" });
  };

  const onScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const cards = Array.from(track.children) as HTMLElement[];
    const nearest = cards.reduce(
      (best, card, i) =>
        Math.abs(card.offsetLeft - track.scrollLeft) <
        Math.abs((cards[best] as HTMLElement).offsetLeft - track.scrollLeft)
          ? i
          : best,
      0,
    );
    if (nearest !== index) setIndex(nearest);
  };

  return (
    <section className="px-4 pb-4 sm:px-6" aria-labelledby="world-voices-title">
      <div className="mx-auto w-full max-w-[340px]">
        <h2
          id="world-voices-title"
          className="text-center text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground"
        >
          {t.title}
        </h2>
        <p className="mt-1 text-center text-xs text-muted-foreground">{t.lead}</p>

        <div
          ref={trackRef}
          onScroll={onScroll}
          className="mt-2 flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {SLIDES.map((slide) => (
            <figure
              key={slide.tag}
              className="relative h-28 w-full shrink-0 snap-start overflow-hidden rounded-xl border border-border sm:h-32"
            >
              <img
                src={slide.image}
                alt={`${slide.region} – ${t.demo}`}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
              <span className="absolute left-2 top-2 rounded-full border border-white/20 bg-black/50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-brand backdrop-blur">
                {t.demo}
              </span>
              <figcaption className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 backdrop-blur">
                <span className="truncate text-sm font-bold text-brand">${slide.tag}</span>
                <span className="truncate text-[10px] text-muted-foreground">{slide.region}</span>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="mt-1 flex items-center justify-center gap-3">
          <button
            type="button"
            aria-label={t.prev}
            onClick={() => goTo(index - 1)}
            className="grid h-7 w-7 place-items-center rounded-full border border-border text-muted-foreground transition-all hover:border-brand/50 hover:text-brand"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-1.5">
            {SLIDES.map((slide, i) => (
              <span
                key={slide.tag}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  i === index ? "bg-brand" : "bg-border"
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            aria-label={t.next}
            onClick={() => goTo(index + 1)}
            className="grid h-7 w-7 place-items-center rounded-full border border-border text-muted-foreground transition-all hover:border-brand/50 hover:text-brand"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-1 text-center text-[10px] leading-snug text-muted-foreground">{t.swipe}</p>
      </div>
    </section>
  );
}
