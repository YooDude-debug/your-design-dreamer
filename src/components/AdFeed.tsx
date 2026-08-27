import { CloseButton } from "@/components/ui/nav-buttons";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  CalendarDays,
  Heart,
  Info,
  Megaphone,
  Plane,
  Plus,
  ShieldCheck,
  Timer,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useData } from "@/lib/data-context";
import { useLang } from "@/lib/lang-context";
import { formatRemaining, useAdPause, useAdsEnabled } from "@/lib/ad-pause";
import { AdsMasterSwitch } from "@/components/AdsMasterSwitch";
import { SponsoredFeed } from "@/components/SponsoredFeed";
import { COPY } from "@/lib/ad-feed-copy";
import { notifyAdTargetingChanged } from "@/lib/ads/use-ad-targeting";
import { invalidateAdInterests, loadAdInterests } from "@/lib/ads/ad-interests";

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

export function AdFeedPanel({ onClose }: { onClose: () => void }) {
  const { lang } = useLang();
  const c = COPY[lang as keyof typeof COPY] ?? COPY.de;
  const { user, isAdmin } = useData();
  const [interests, setInterests] = useState<string[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [interestInput, setInterestInput] = useState("");
  const [tripForm, setTripForm] = useState<{
    country: string;
    city: string;
    start: string;
    end: string;
  } | null>(null);
  const pause = useAdPause(user?.id);
  const ads = useAdsEnabled(user?.id, isAdmin);
  /** Werbung aus: regulaere Pause oder dauerhafter Admin-Schalter. */
  const adsHidden = pause.active || ads.disabled;
  const [pauseConfirm, setPauseConfirm] = useState(false);
  const [pauseBusy, setPauseBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    void (async () => {
      const [prefLabels, plans] = await Promise.all([
        loadAdInterests(user.id),
        supabase
          .from("travel_plans")
          .select("id,country,city,start_date,end_date")
          .eq("user_id", user.id)
          .order("start_date", { ascending: true }),
      ]);
      if (!alive) return;
      setInterests(prefLabels);
      setTrips(plans.data ?? []);
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  const persistInterests = async (next: string[]) => {
    setInterests(next);
    // Auswahl wirkt sofort als Allowed-Filter im Werbefeed.
    notifyAdTargetingChanged(next);
    if (!user) return;
    invalidateAdInterests(user.id);
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

  const fmt = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString(lang === "de" ? "de-DE" : lang === "el" ? "el-GR" : "en-GB")
      : "—";

  const locale = lang === "de" ? "de-DE" : lang === "el" ? "el-GR" : "en-GB";
  const isLate = new Date().getHours() >= 18;
  const lateTime = new Date();
  lateTime.setMinutes(0, 0, 0);
  const lateHours = 24 - lateTime.getHours();
  const confirmBody = isLate
    ? c.pauseLateBody
        .replace(
          "{time}",
          lateTime.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }),
        )
        .replace("{hours}", String(lateHours))
    : c.pauseConfirmBody;

  const activatePause = async () => {
    setPauseBusy(true);
    const ok = await pause.activate();
    setPauseBusy(false);
    setPauseConfirm(false);
    if (!ok) toast.error(c.cancel);
  };

  const pauseSection = (
    <section className="rounded-2xl border border-border bg-background/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="inline-flex items-center gap-2 text-sm font-bold text-brand">
            <Timer className="h-4 w-4" /> {c.pause}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {c.pauseStatus
              .replace("{left}", String(pause.remaining))
              .replace("{quota}", String(pause.quota))}
          </p>
          {pause.active && (
            <p className="mt-1 text-xs font-semibold text-brand-cyan">
              {c.pauseRemaining}: {formatRemaining(pause.remainingMs)}
            </p>
          )}
        </div>
        {pause.active ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand">
            <ShieldCheck className="h-3.5 w-3.5" /> {c.pauseActive}
          </span>
        ) : (
          <button
            type="button"
            disabled={pause.loading || pause.remaining === 0}
            onClick={() => setPauseConfirm(true)}
            className="rounded-full bg-gradient-brand px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {c.pauseActivate}
          </button>
        )}
      </div>
      {!pause.active && pause.remaining === 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">{c.pauseNone}</p>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">
        {c.pauseReset.replace("{quota}", String(pause.quota))}
      </p>
    </section>
  );

  const pauseDialog = pauseConfirm && (
    <div
      className="fixed inset-0 z-[110] grid place-items-center bg-background/80 p-4 backdrop-blur"
      onClick={(e) => {
        e.stopPropagation();
        setPauseConfirm(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={c.pauseConfirmTitle}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-border bg-surface/95 p-5 shadow-glow"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
          <div>
            <p className="text-sm font-bold">{c.pauseConfirmTitle}</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{confirmBody}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => setPauseConfirm(false)}
            disabled={pauseBusy}
            className="rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {c.cancel}
          </button>
          <button
            onClick={() => void activatePause()}
            disabled={pauseBusy}
            className="rounded-full bg-gradient-brand px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {c.pauseActivate}
          </button>
        </div>
      </div>
    </div>
  );

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
        className="flex h-full w-full max-w-none flex-col overflow-hidden rounded-none border-0 bg-background shadow-glow-strong sm:h-[80vh] sm:w-[90vw] sm:max-w-[1200px] sm:rounded-2xl sm:border sm:border-brand/40"
      >
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold sm:text-lg">
              {c.title} <span className="text-xs font-semibold text-brand">({c.testMode})</span>
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">{c.subtitle}</p>
          </div>
          <CloseButton onClick={onClose} label={c.close} className="shrink-0" />
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-4 py-4 sm:space-y-6 sm:px-6 sm:py-5">
          {isAdmin ? <AdsMasterSwitch /> : pauseSection}
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
                    <CloseButton
                      onClick={() => void persistInterests(interests.filter((x) => x !== i))}
                      label={`${i} ✕`}
                    />
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
            {adsHidden ? (
              <p className="mt-3 rounded-2xl border border-border bg-background/60 p-4 text-xs leading-relaxed text-muted-foreground">
                {c.pauseHiddenNote}
              </p>
            ) : (
              <div className="mt-3">
                <SponsoredFeed />
              </div>
            )}
          </section>
        </div>

        <footer className="flex items-start gap-2 border-t border-border px-6 py-3 text-[11px] text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
          <p>{c.privacy}</p>
        </footer>
      </div>
      {pauseDialog}
    </div>
  );

  return typeof document === "undefined" ? null : createPortal(body, document.body);
}
