import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  Heart,
  Info,
  Megaphone,
  Plane,
  Plus,
  ShieldCheck,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useData } from "@/lib/data";
import { useLang } from "@/lib/i18n";
import { formatRemaining, useAdPause } from "@/lib/ad-pause";


const COPY = {
  de: {
    title: "Werbefeed",
    subtitle: "Entdecke Angebote passend zu deinen Interessen.",
    testMode: "Testmodus",
    interests: "Deine Interessen",
    addInterest: "Interesse hinzufügen",
    interestPh: "z. B. Reisen",
    travel: "Geplante Reiseziele",
    addTrip: "Reiseziel hinzufügen",
    country: "Land",
    city: "Stadt",
    from: "Anreise",
    to: "Abreise",
    save: "Speichern",
    cancel: "Abbrechen",
    feed: "Dein personalisierter Werbefeed",
    fake: "fiktive Anzeigen",
    ad: "Anzeige",
    privacy:
      "Die Werbung basiert ausschließlich auf deinen freiwillig hinterlegten Interessen und geplanten Reisezielen.",
    noTrips: "Noch keine Reise geplant.",
    close: "Schließen",
    pause: "Werbepause",
    pauseActivate: "Werbepause aktivieren",
    pauseStatus: "{left} von {quota} Werbepausen verfügbar",
    pauseReset: "Das Kontingent wird am ersten Tag jedes neuen Monats automatisch auf {quota} Werbepausen zurückgesetzt. Nicht genutzte Werbepausen verfallen am Monatsende.",
    pauseActive: "Werbepause aktiv – normale Werbung ist bis 24:00 Uhr ausgeblendet.",
    pauseRemaining: "Restlaufzeit bis 24:00 Uhr",
    pauseNone: "Für diesen Monat sind alle Werbepausen verbraucht.",
    pauseHiddenNote:
      "Normale Anzeigen sind während der Werbepause ausgeblendet. Unternehmer- und Creator-SlangTags ($$), gesponserte SlangTags sowie Sicherheits- und Systemhinweise bleiben jederzeit sichtbar.",
    pauseConfirmTitle: "Werbepause aktivieren?",
    pauseConfirmBody:
      "Deine Werbepause gilt bis heute 24:00 Uhr. Dieser Kalendertag wird vollständig von deinem monatlichen Kontingent abgezogen. Möchtest du die Werbepause jetzt aktivieren?",
    pauseLateBody:
      "Du aktivierst deine Werbepause erst um {time}. Dadurch bleiben heute nur noch {hours} Stunden werbefrei. Trotzdem wird ein kompletter Werbetag von deinem monatlichen Kontingent verbraucht. Möchtest du die Werbepause trotzdem aktivieren?",

  },
  en: {
    title: "Ad feed",
    subtitle: "Discover offers matching your interests.",
    testMode: "test mode",
    interests: "Your interests",
    addInterest: "Add interest",
    interestPh: "e.g. travel",
    travel: "Planned destinations",
    addTrip: "Add destination",
    country: "Country",
    city: "City",
    from: "Arrival",
    to: "Departure",
    save: "Save",
    cancel: "Cancel",
    feed: "Your personalised ad feed",
    fake: "fictional ads",
    ad: "Ad",
    privacy:
      "Advertising is based solely on the interests and planned destinations you voluntarily provided.",
    noTrips: "No trip planned yet.",
    close: "Close",
    pause: "Ad break",
    pauseActivate: "Activate ad break",
    pauseStatus: "{left} of {quota} ad breaks available",
    pauseReset: "Your allowance resets automatically to {quota} ad breaks on the first day of each month. Unused ad breaks expire at the end of the month.",
    pauseActive: "Ad break active – normal ads are hidden until midnight.",
    pauseRemaining: "Time left until midnight",
    pauseNone: "You have used all ad breaks for this month.",
    pauseHiddenNote:
      "Normal ads are hidden during the ad break. Business and creator SlangTags ($$), sponsored SlangTags and safety or system notices always stay visible.",
    pauseConfirmTitle: "Activate ad break?",
    pauseConfirmBody:
      "Your ad break lasts until midnight today. This calendar day is fully deducted from your monthly allowance. Do you want to activate the ad break now?",
    pauseLateBody:
      "You are activating your ad break at {time}. Only {hours} ad-free hours are left today, but a full ad day is still deducted from your monthly allowance. Activate anyway?",

  },
  el: {
    title: "Ροή διαφημίσεων",
    subtitle: "Ανακάλυψε προσφορές που ταιριάζουν στα ενδιαφέροντά σου.",
    testMode: "δοκιμαστική λειτουργία",
    interests: "Τα ενδιαφέροντά σου",
    addInterest: "Προσθήκη ενδιαφέροντος",
    interestPh: "π.χ. ταξίδια",
    travel: "Προγραμματισμένοι προορισμοί",
    addTrip: "Προσθήκη προορισμού",
    country: "Χώρα",
    city: "Πόλη",
    from: "Άφιξη",
    to: "Αναχώρηση",
    save: "Αποθήκευση",
    cancel: "Άκυρο",
    feed: "Η προσωποποιημένη ροή διαφημίσεων",
    fake: "εικονικές διαφημίσεις",
    ad: "Διαφήμιση",
    privacy:
      "Οι διαφημίσεις βασίζονται αποκλειστικά στα ενδιαφέροντα και τους προορισμούς που δήλωσες εθελοντικά.",
    noTrips: "Κανένα ταξίδι ακόμα.",
    close: "Κλείσιμο",
  },
} as const;

const SUGGESTED = [
  "Reisen",
  "Essen",
  "Technik",
  "Gaming",
  "Musik",
  "Pokémon",
  "Sport",
  "Autos",
  "Mode",
];

type Trip = {
  id: string;
  country: string;
  city: string;
  start_date: string | null;
  end_date: string | null;
};

/** Platzhalter-Anzeigen (Testmodus) – später dynamisch aus Interessen + Reisen. */
const PLACEHOLDER_ADS = [
  {
    emoji: "✈️",
    tags: ["Reisen"],
    title: "Flug nach Griechenland",
    body: "Direktflüge ab 79 € – Sonne inklusive.",
    cta: "Jetzt entdecken",
    tone: "from-brand/30 to-brand-cyan/20",
  },
  {
    emoji: "🍔",
    tags: ["Essen"],
    title: "Restaurant Rabatt",
    body: "10 % auf lokale Küche in deiner Stadt.",
    cta: "Mehr erfahren",
    tone: "from-brand-cyan/25 to-brand/15",
  },
  {
    emoji: "🎵",
    tags: ["Musik"],
    title: "Techno Festival",
    body: "3 Tage, 20 Clubs, 100+ DJs.",
    cta: "Tickets sichern",
    tone: "from-brand/25 to-brand-cyan/25",
  },
  {
    emoji: "🏨",
    tags: ["Reisen"],
    title: "Hotel Deal",
    body: "Zentral schlafen, günstig buchen.",
    cta: "Verfügbarkeit",
    tone: "from-brand-cyan/20 to-brand/25",
  },
  {
    emoji: "🚗",
    tags: ["Autos", "Reisen"],
    title: "Mietwagen",
    body: "Flexibel unterwegs ab 19 €/Tag.",
    cta: "Angebot ansehen",
    tone: "from-brand/20 to-brand-cyan/30",
  },
  {
    emoji: "🛍️",
    tags: ["Mode"],
    title: "Lokale Angebote",
    body: "Shops in deiner Nähe mit Y-Dude Bonus.",
    cta: "Entdecken",
    tone: "from-brand-cyan/30 to-brand/20",
  },
];

export function AdFeedCard() {
  const { lang } = useLang();
  const c = COPY[lang as keyof typeof COPY] ?? COPY.de;
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group flex w-full items-center gap-4 rounded-2xl border border-border bg-surface/40 p-4 text-left transition-colors hover:border-brand/60 hover:bg-brand/5"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-brand/40 text-brand transition-colors group-hover:border-brand">
          <Megaphone className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold group-hover:text-brand">{c.title}</span>
          <span className="block truncate text-xs text-muted-foreground">{c.subtitle}</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
      </button>
      {open && <AdFeedModal onClose={() => setOpen(false)} />}
    </>
  );
}

function AdFeedModal({ onClose }: { onClose: () => void }) {
  const { lang } = useLang();
  const c = COPY[lang as keyof typeof COPY] ?? COPY.de;
  const { user } = useData();
  const [interests, setInterests] = useState<string[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [interestInput, setInterestInput] = useState("");
  const [tripForm, setTripForm] = useState<{
    country: string;
    city: string;
    start: string;
    end: string;
  } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    void (async () => {
      const [prefs, plans] = await Promise.all([
        supabase.from("ad_preferences").select("interests").eq("user_id", user.id).maybeSingle(),
        supabase
          .from("travel_plans")
          .select("id,country,city,start_date,end_date")
          .eq("user_id", user.id)
          .order("start_date", { ascending: true }),
      ]);
      if (!alive) return;
      setInterests(prefs.data?.interests ?? []);
      setTrips(plans.data ?? []);
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  const persistInterests = async (next: string[]) => {
    setInterests(next);
    if (!user) return;
    const { error } = await supabase
      .from("ad_preferences")
      .upsert({ user_id: user.id, interests: next }, { onConflict: "user_id" });
    if (error) toast.error(error.message);
  };

  const addInterest = (raw: string) => {
    const value = raw.trim().slice(0, 40);
    if (!value || interests.some((i) => i.toLowerCase() === value.toLowerCase())) return;
    void persistInterests([...interests, value]);
    setInterestInput("");
  };

  const addTrip = async () => {
    if (!tripForm || !user) return;
    const row = {
      user_id: user.id,
      country: tripForm.country.trim().slice(0, 80),
      city: tripForm.city.trim().slice(0, 80),
      start_date: tripForm.start || null,
      end_date: tripForm.end || null,
    };
    if (!row.country && !row.city) return;
    const { data, error } = await supabase
      .from("travel_plans")
      .insert(row)
      .select("id,country,city,start_date,end_date")
      .single();
    if (error || !data) {
      toast.error(error?.message ?? c.cancel);
      return;
    }
    setTrips((t) => [...t, data]);
    setTripForm(null);
  };

  const removeTrip = async (id: string) => {
    setTrips((t) => t.filter((x) => x.id !== id));
    await supabase.from("travel_plans").delete().eq("id", id);
  };

  const ads = useMemo(() => {
    if (interests.length === 0) return PLACEHOLDER_ADS;
    const lower = interests.map((i) => i.toLowerCase());
    const matched = PLACEHOLDER_ADS.filter((a) =>
      a.tags.some((t) => lower.includes(t.toLowerCase())),
    );
    return matched.length > 0
      ? [...matched, ...PLACEHOLDER_ADS.filter((a) => !matched.includes(a))]
      : PLACEHOLDER_ADS;
  }, [interests]);

  const fmt = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString(lang === "de" ? "de-DE" : lang === "el" ? "el-GR" : "en-GB")
      : "—";

  const body = (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-background/80 p-0 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={c.title}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-none flex-col overflow-hidden rounded-none border-0 bg-surface shadow-glow-strong sm:h-[80vh] sm:w-[90vw] sm:max-w-[1200px] sm:rounded-2xl sm:border sm:border-brand/40"
      >
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold sm:text-lg">
              {c.title} <span className="text-xs font-semibold text-brand">({c.testMode})</span>
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">{c.subtitle}</p>
          </div>
          <button
            onClick={onClose}
            aria-label={c.close}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:border-brand/60 hover:text-brand"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-4 py-4 sm:space-y-6 sm:px-6 sm:py-5">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Interessen */}
            <section className="rounded-2xl border border-border bg-background/50 p-4">
              <h3 className="inline-flex items-center gap-2 text-sm font-bold text-brand">
                <Heart className="h-4 w-4" /> {c.interests}
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {interests.map((i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-xs font-semibold"
                  >
                    {i}
                    <button
                      onClick={() => void persistInterests(interests.filter((x) => x !== i))}
                      aria-label={`${i} ✕`}
                      className="text-muted-foreground hover:text-brand"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addInterest(interestInput);
                }}
                className="mt-3 flex gap-2"
              >
                <input
                  value={interestInput}
                  onChange={(e) => setInterestInput(e.target.value)}
                  placeholder={c.interestPh}
                  maxLength={40}
                  className="flex-1 rounded-full border border-border bg-surface px-3 py-1.5 text-xs outline-none focus:border-brand"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-full border border-brand/50 px-3 py-1.5 text-xs font-semibold text-brand"
                >
                  <Plus className="h-3.5 w-3.5" /> {c.addInterest}
                </button>
              </form>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {SUGGESTED.filter(
                  (s) => !interests.some((i) => i.toLowerCase() === s.toLowerCase()),
                ).map((s) => (
                  <button
                    key={s}
                    onClick={() => addInterest(s)}
                    className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:border-brand/50 hover:text-brand"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            </section>

            {/* Reiseplanung */}
            <section className="rounded-2xl border border-border bg-background/50 p-4">
              <h3 className="inline-flex items-center gap-2 text-sm font-bold text-brand-cyan">
                <Plane className="h-4 w-4" /> {c.travel}
              </h3>
              <ul className="mt-3 space-y-2">
                {trips.length === 0 && (
                  <li className="text-xs text-muted-foreground">{c.noTrips}</li>
                )}
                {trips.map((tp) => (
                  <li
                    key={tp.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold">
                        {[tp.city, tp.country].filter(Boolean).join(", ")}
                      </div>
                      <div className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <CalendarDays className="h-3 w-3" /> {fmt(tp.start_date)} –{" "}
                        {fmt(tp.end_date)}
                      </div>
                    </div>
                    <button
                      onClick={() => void removeTrip(tp.id)}
                      aria-label={`${tp.city} ✕`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>

              {tripForm ? (
                <div className="mt-3 space-y-2 rounded-xl border border-brand/30 bg-surface p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={tripForm.country}
                      onChange={(e) => setTripForm({ ...tripForm, country: e.target.value })}
                      placeholder={c.country}
                      maxLength={80}
                      className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-brand"
                    />
                    <input
                      value={tripForm.city}
                      onChange={(e) => setTripForm({ ...tripForm, city: e.target.value })}
                      placeholder={c.city}
                      maxLength={80}
                      className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-brand"
                    />
                    <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {c.from}
                      <input
                        type="date"
                        value={tripForm.start}
                        onChange={(e) => setTripForm({ ...tripForm, start: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-brand"
                      />
                    </label>
                    <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {c.to}
                      <input
                        type="date"
                        value={tripForm.end}
                        onChange={(e) => setTripForm({ ...tripForm, end: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-brand"
                      />
                    </label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setTripForm(null)}
                      className="rounded-full px-3 py-1.5 text-xs text-muted-foreground"
                    >
                      {c.cancel}
                    </button>
                    <button
                      onClick={() => void addTrip()}
                      className="rounded-full bg-gradient-brand px-4 py-1.5 text-xs font-semibold text-primary-foreground"
                    >
                      {c.save}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setTripForm({ country: "", city: "", start: "", end: "" })}
                  className="mt-3 inline-flex items-center gap-1 rounded-full border border-brand-cyan/50 px-3 py-1.5 text-xs font-semibold text-brand-cyan"
                >
                  <Plus className="h-3.5 w-3.5" /> {c.addTrip}
                </button>
              )}
            </section>
          </div>

          {/* Anzeigen */}
          <section>
            <h3 className="inline-flex items-center gap-2 text-sm font-bold">
              <Megaphone className="h-4 w-4 text-brand" /> {c.feed}{" "}
              <span className="text-xs font-normal text-muted-foreground">({c.fake})</span>
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {ads.map((ad) => (
                <article
                  key={ad.title}
                  className="overflow-hidden rounded-2xl border border-border bg-background/60"
                >
                  <div
                    className={`relative grid h-44 place-items-center bg-gradient-to-br ${ad.tone} text-6xl sm:h-28 sm:text-4xl`}
                  >
                    <span aria-hidden>{ad.emoji}</span>
                    <span className="absolute left-2 top-2 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-brand">
                      {c.ad}
                    </span>
                  </div>
                  <div className="p-4 sm:p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {ad.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full border border-brand/40 bg-brand/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand"
                        >
                          ${t}
                        </span>
                      ))}
                    </div>
                    <h4 className="mt-2 text-lg font-bold sm:text-sm">{ad.title}</h4>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground sm:text-xs">
                      {ad.body}
                    </p>
                    <button
                      type="button"
                      onClick={() => toast.info(`${c.ad} · ${c.testMode}`)}
                      className="mt-3 w-full rounded-full bg-gradient-brand px-3 py-3 text-sm font-semibold text-primary-foreground sm:py-1.5 sm:text-xs"
                    >
                      {ad.cta}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <footer className="flex items-start gap-2 border-t border-border px-6 py-3 text-[11px] text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
          <p>{c.privacy}</p>
        </footer>
      </div>
    </div>
  );

  return typeof document === "undefined" ? null : createPortal(body, document.body);
}
