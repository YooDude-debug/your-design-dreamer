import { useState } from "react";
import { Megaphone } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/lib/data-context";
import { useLang } from "@/lib/lang-context";
import { useAdsEnabled } from "@/lib/ad-pause";

/**
 * Dauerhafter Werbe-Schalter – ausschliesslich fuer Admin-Konten sichtbar.
 *
 * AN  → normale Werbeausspielung nach bestehender Logik.
 * AUS → Werbung dauerhaft deaktiviert, ohne Zeitbegrenzung und ohne Reset.
 *
 * Fuer alle anderen Konten bleibt die regulaere Werbepause unveraendert.
 */

const COPY = {
  de: {
    title: "Werbung",
    on: "AN",
    off: "AUS",
    hint: "Dauerhafte Admin-Steuerung ohne Zeitbegrenzung. Der Zustand bleibt bestehen, bis du ihn manuell änderst.",
    stateOn: "Werbung wird normal ausgespielt.",
    stateOff: "Werbung ist vollständig deaktiviert.",
    failed: "Änderung fehlgeschlagen",
  },
  en: {
    title: "Advertising",
    on: "ON",
    off: "OFF",
    hint: "Permanent admin control without any time limit. The state stays until you change it manually.",
    stateOn: "Ads are served normally.",
    stateOff: "Ads are fully disabled.",
    failed: "Change failed",
  },
} as const;

export function AdsMasterSwitch({ className = "" }: { className?: string }) {
  const { lang } = useLang();
  const t = COPY[lang as keyof typeof COPY] ?? COPY.de;
  const { user, isAdmin } = useData();
  const ads = useAdsEnabled(user?.id, isAdmin);
  const [busy, setBusy] = useState(false);

  if (!isAdmin) return null;

  const apply = async (value: boolean) => {
    if (value === ads.enabled || busy) return;
    setBusy(true);
    const ok = await ads.set(value);
    setBusy(false);
    if (!ok) toast.error(t.failed);
  };

  const seg = (active: boolean) =>
    `flex-1 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
      active
        ? "bg-gradient-brand text-primary-foreground"
        : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <section className={`rounded-2xl border border-border bg-background/50 p-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="inline-flex items-center gap-2 text-sm font-bold text-brand">
            <Megaphone className="h-4 w-4" /> {t.title}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {ads.enabled ? t.stateOn : t.stateOff}
          </p>
        </div>
        <div
          role="group"
          aria-label={t.title}
          className="inline-flex w-40 items-center gap-1 rounded-full border border-border bg-background p-1"
        >
          <button
            type="button"
            aria-pressed={ads.enabled}
            disabled={ads.loading || busy}
            onClick={() => void apply(true)}
            className={seg(ads.enabled)}
          >
            {t.on}
          </button>
          <button
            type="button"
            aria-pressed={!ads.enabled}
            disabled={ads.loading || busy}
            onClick={() => void apply(false)}
            className={seg(!ads.enabled)}
          >
            {t.off}
          </button>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">{t.hint}</p>
    </section>
  );
}
