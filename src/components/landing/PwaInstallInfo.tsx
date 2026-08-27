import { CloseButton } from "@/components/ui/nav-buttons";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Info, Smartphone, X, Apple } from "lucide-react";

type Device = "ios" | "android" | "desktop";

const copy = {
  de: {
    badge: "PWA installieren",
    modalTitle: "Y-Dude als App installieren",
    ios: {
      title: "iPhone / iPad",
      steps: [
        "Y-Dude in Safari öffnen.",
        "Teilen antippen.",
        "„Zum Home-Bildschirm“ auswählen.",
        "„Hinzufügen“ antippen.",
      ],
    },
    android: {
      title: "Android",
      steps: [
        "Y-Dude in Chrome öffnen.",
        "Menü ⋮ öffnen.",
        "„App installieren“ oder „Zum Startbildschirm hinzufügen“ auswählen.",
        "Installieren/Hinzufügen bestätigen.",
      ],
    },
    desktop: {
      title: "Desktop",
      steps: [
        "Öffne Y-Dude in Chrome, Edge oder einem Chromium-Browser.",
        "Klicke auf das Icon neben der Adressleiste oder im Menü.",
        "Wähle „App installieren“ / „Y-Dude installieren“.",
      ],
    },
    switchIos: "iPhone / iPad",
    switchAndroid: "Android",
    close: "Schließen",
  },
  en: {
    badge: "Install PWA",
    modalTitle: "Install Y-Dude as an app",
    ios: {
      title: "iPhone / iPad",
      steps: ["Open Y-Dude in Safari.", "Tap Share.", "Select “Add to Home Screen”.", "Tap “Add”."],
    },
    android: {
      title: "Android",
      steps: [
        "Open Y-Dude in Chrome.",
        "Open the menu ⋮.",
        "Select “Install app” or “Add to Home screen”.",
        "Confirm install/add.",
      ],
    },
    desktop: {
      title: "Desktop",
      steps: [
        "Open Y-Dude in Chrome, Edge or another Chromium browser.",
        "Click the icon next to the address bar or in the menu.",
        "Select “Install app” / “Install Y-Dude”.",
      ],
    },
    switchIos: "iPhone / iPad",
    switchAndroid: "Android",
    close: "Close",
  },
  el: {
    badge: "Εγκατάσταση PWA",
    modalTitle: "Εγκατάσταση Y-Dude ως εφαρμογή",
    ios: {
      title: "iPhone / iPad",
      steps: [
        "Άνοιξε το Y-Dude στο Safari.",
        'Πάτησε "Κοινή χρήση".',
        'Επίλεξε "Προσθήκη στην Αρχική Οθόνη".',
        'Πάτησε "Προσθήκη".',
      ],
    },
    android: {
      title: "Android",
      steps: [
        "Άνοιξε το Y-Dude στο Chrome.",
        "Άνοιξε το μενού ⋮.",
        'Επίλεξε "Εγκατάσταση εφαρμογής" ή "Προσθήκη στην Αρχική Οθόνη".',
        "Επιβεβαίωσε την εγκατάσταση/προσθήκη.",
      ],
    },
    desktop: {
      title: "Desktop",
      steps: [
        "Άνοιξε το Y-Dude σε Chrome, Edge ή άλλον Chromium browser.",
        "Κάνε κλικ στο εικονίδιο δίπλα στη γραμμή διευθύνσεων ή στο μενού.",
        'Επίλεξε "Εγκατάσταση εφαρμογής" / "Εγκατάσταση Y-Dude".',
      ],
    },
    switchIos: "iPhone / iPad",
    switchAndroid: "Android",
    close: "Κλείσιμο",
  },
};

function detectDevice(): Device {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  if (isIos) return "ios";
  const isAndroid = /android/.test(ua);
  if (isAndroid) return "android";
  const isMobile = /mobile/.test(ua);
  if (isMobile) return /android/.test(ua) ? "android" : "ios";
  return "desktop";
}

export function PwaInstallInfo({
  lang,
  open,
  onClose,
}: {
  lang: "de" | "en" | "el";
  open: boolean;
  onClose: () => void;
}) {
  const t = copy[lang] ?? copy.de;
  const detected = useMemo(() => detectDevice(), [open]);
  const [tab, setTab] = useState<Device>(detected);

  useEffect(() => {
    if (open) setTab(detected);
  }, [open, detected]);

  if (!open || typeof document === "undefined") return null;

  const steps = t[tab].steps;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[2000] grid place-items-center bg-background/80 p-4 backdrop-blur"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-border bg-surface/95 p-4 shadow-subtle"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-brand" aria-hidden="true" />
            <p className="text-sm font-semibold text-foreground">{t.modalTitle}</p>
          </div>
          <CloseButton onClick={onClose} label={t.close} className="shrink-0" />
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setTab("ios")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
              tab === "ios"
                ? "border-brand bg-brand/15 text-brand"
                : "border-border text-muted-foreground hover:border-brand/40 hover:text-brand"
            }`}
          >
            <Apple className="h-3.5 w-3.5" />
            {t.switchIos}
          </button>
          <button
            type="button"
            onClick={() => setTab("android")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
              tab === "android"
                ? "border-brand bg-brand/15 text-brand"
                : "border-border text-muted-foreground hover:border-brand/40 hover:text-brand"
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            {t.switchAndroid}
          </button>
        </div>

        <div className="mt-3 rounded-xl border border-border/60 bg-background/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">
            {t[tab].title}
          </p>
          <ol className="mt-2 space-y-1.5">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-2 text-xs leading-relaxed text-foreground">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand/15 text-[10px] font-bold text-brand">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-full bg-brand/15 py-2 text-xs font-bold text-brand transition-all hover:bg-brand/25"
        >
          {t.close}
        </button>
      </div>
    </div>,
    document.body,
  );
}

export function PwaInstallBadge({
  lang,
  onOpen,
}: {
  lang: "de" | "en" | "el";
  onOpen: () => void;
}) {
  const t = copy[lang] ?? copy.de;
  return (
    <div className="mt-1.5 flex items-center justify-center gap-1.5">
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[10px] font-medium text-muted-foreground transition-all hover:border-brand/40 hover:text-brand"
      >
        <span aria-hidden="true">📱</span>
        {t.badge}
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="grid h-5 w-5 place-items-center rounded-full border border-border text-[10px] text-muted-foreground transition-all hover:border-brand/40 hover:text-brand"
        aria-label={t.modalTitle}
      >
        <Info className="h-3 w-3" />
      </button>
    </div>
  );
}
