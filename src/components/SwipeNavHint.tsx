import { useEffect, useState } from "react";
import { Globe2, Headphones, Hand } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/lang-context";
import { swipeHintTexts } from "@/lib/i18n-swipe-hint";

/**
 * Erstnutzer-Hinweis zur Wisch-Navigation.
 *
 * Sichtbar nur solange `profiles.swipe_hint_seen` false ist (neue Konten).
 * „Überspringen“ blendet die Karte nur für die aktuelle Sitzung aus,
 * „Nicht mehr anzeigen“ setzt das Profilfeld dauerhaft.
 */

const SESSION_KEY = "ydude.swipehint.skipped";

export function SwipeNavHint() {
  const { lang } = useLang();
  const t = swipeHintTexts[lang];
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (sessionStorage.getItem(SESSION_KEY)) return;
      } catch {
        /* Speicher nicht verfügbar */
      }
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid || !active) return;
      const { data } = await supabase
        .from("profiles")
        .select("swipe_hint_seen")
        .eq("id", uid)
        .maybeSingle();
      if (!active || !data || data.swipe_hint_seen) return;
      setUserId(uid);
      setOpen(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!open) return null;

  const skip = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* Speicher nicht verfügbar */
    }
    setOpen(false);
  };

  const never = () => {
    setOpen(false);
    if (userId) {
      void supabase.from("profiles").update({ swipe_hint_seen: true }).eq("id", userId);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.title}
      /* Auf kleinen Android-Displays muss der Overlay scrollbar sein, sonst
         liegen die Buttons unter dem Bildschirmrand und blockieren die App. */
      className="fixed inset-0 z-[95] grid place-items-center overflow-y-auto overscroll-contain bg-black/80 px-4 py-6 backdrop-blur-sm"
      style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
    >
      <style>{`
@keyframes ydude-swipe-demo {
  0%   { transform: translateX(0) scale(0.9); opacity: 0; }
  6%   { transform: translateX(0) scale(1);   opacity: 1; }
  22%  { transform: translateX(64px) scale(1); opacity: 1; }
  30%  { transform: translateX(76px) scale(0.9); opacity: 0; }
  42%  { transform: translateX(0) scale(0.9); opacity: 0; }
  50%  { transform: translateX(0) scale(1);   opacity: 1; }
  66%  { transform: translateX(-64px) scale(1); opacity: 1; }
  74%  { transform: translateX(-76px) scale(0.9); opacity: 0; }
  100% { transform: translateX(0) scale(0.9); opacity: 0; }
}
@keyframes ydude-swipe-right-glow {
  0%, 12%, 40%, 100% { opacity: 0.25; }
  24% { opacity: 1; }
}
@keyframes ydude-swipe-left-glow {
  0%, 56%, 84%, 100% { opacity: 0.25; }
  68% { opacity: 1; }
}
      `}</style>

      <section className="w-full max-w-[380px] overflow-hidden rounded-2xl border border-brand/40 bg-black p-5 shadow-[0_0_40px_-16px_oklch(0.82_0.24_150/0.45)]">
        <h2 className="text-center text-base font-black tracking-tight">{t.title}</h2>

        {/* Visuelle Demo: Finger startet in der Mitte und wischt in beide Richtungen */}
        <div className="relative mt-4 h-28 rounded-xl border border-border bg-background/40">
          <div
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-lg border border-brand/50 bg-brand/10 p-2 text-brand"
            style={{ animation: "ydude-swipe-left-glow 4.2s ease-in-out infinite" }}
            aria-hidden
          >
            <Headphones className="h-5 w-5" />
          </div>
          <div
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-brand/50 bg-brand/10 p-2 text-brand"
            style={{ animation: "ydude-swipe-right-glow 4.2s ease-in-out infinite" }}
            aria-hidden
          >
            <Globe2 className="h-5 w-5" />
          </div>
          <div className="absolute inset-x-16 top-1/2 h-px -translate-y-1/2 bg-border" aria-hidden />
          <div
            className="absolute left-1/2 top-1/2 -ml-4 -mt-4 text-foreground"
            style={{ animation: "ydude-swipe-demo 4.2s cubic-bezier(0.22,1,0.36,1) infinite" }}
            aria-hidden
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand/20 ring-2 ring-brand/70">
              <Hand className="h-4 w-4 text-brand" />
            </span>
          </div>
        </div>

        <ul className="mt-4 space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <Globe2 className="h-4 w-4 shrink-0 text-brand" />
            <span>
              <span className="font-semibold">{t.rightSwipe}</span>
              <span className="block text-xs text-muted-foreground">{t.rightTarget}</span>
            </span>
          </li>
          <li className="flex items-center gap-2">
            <Headphones className="h-4 w-4 shrink-0 text-brand" />
            <span>
              <span className="font-semibold">{t.leftSwipe}</span>
              <span className="block text-xs text-muted-foreground">{t.leftTarget}</span>
            </span>
          </li>
        </ul>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={skip}
            className="w-full rounded-full bg-gradient-brand px-5 py-2.5 text-sm font-black text-primary-foreground transition-transform hover:scale-[1.01]"
          >
            {t.skip}
          </button>
          <button
            type="button"
            onClick={never}
            className="w-full rounded-full border border-border px-5 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            {t.never}
          </button>
        </div>
      </section>
    </div>
  );
}
