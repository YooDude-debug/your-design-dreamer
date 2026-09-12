import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Move, X, ZoomIn } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { cropImageDataUrl } from "@/lib/image-crop";
import {
  COVER_MAX_SCALE,
  COVER_MIN_SCALE,
  clampCoverOffset,
  computeCoverCrop,
  coverDisplaySize,
} from "@/lib/cover-crop";

const TEXTS = {
  de: {
    title: "Hintergrund anpassen",
    hint: "Bild verschieben, mit zwei Fingern zoomen.",
    zoom: "Zoom",
    cancel: "Abbrechen",
    apply: "Übernehmen",
    working: "Wird übernommen …",
  },
  en: {
    title: "Adjust background",
    hint: "Drag the image, pinch with two fingers to zoom.",
    zoom: "Zoom",
    cancel: "Cancel",
    apply: "Apply",
    working: "Applying …",
  },
  el: {
    title: "Προσαρμογή φόντου",
    hint: "Μετακινήστε την εικόνα, ζουμ με δύο δάχτυλα.",
    zoom: "Ζουμ",
    cancel: "Άκυρο",
    apply: "Εφαρμογή",
    working: "Εφαρμόζεται …",
  },
} as const;

/** Seitenverhältnis des echten Profil-Headers (Messung, sonst Standardwerte). */
function headerAspect(): number {
  if (typeof document === "undefined") return 1.5;
  const el = document.querySelector<HTMLElement>("[data-profile-hero]");
  if (el) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return r.width / r.height;
  }
  const w = typeof window === "undefined" ? 393 : window.innerWidth;
  return w < 640 ? w / 262 : Math.min(w, 720) / 310;
}

export function CoverPositionDialog({
  image,
  onCancel,
  onApply,
}: {
  /** Rohbild als DataURL */
  image: string;
  onCancel: () => void;
  onApply: (croppedDataUrl: string) => void;
}) {
  const { lang } = useLang();
  const t = TEXTS[lang as keyof typeof TEXTS] ?? TEXTS.de;
  const frameRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [aspect, setAspect] = useState(1.5);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);

  useLayoutEffect(() => setAspect(headerAspect()), []);

  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setFrame({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = image;
  }, [image]);

  const view = {
    frameW: frame.w,
    frameH: frame.h,
    imageW: natural.w || 1,
    imageH: natural.h || 1,
    scale,
    offsetX: offset.x,
    offsetY: offset.y,
  };
  const disp = coverDisplaySize(view);
  const clamped = clampCoverOffset(view);

  // Gesten: ein Finger verschiebt, zwei Finger zoomen.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; scale: number } | null>(null);

  const setClamped = (x: number, y: number, s = scale) => {
    const next = clampCoverOffset({ ...view, scale: s, offsetX: x, offsetY: y });
    setOffset(next);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      // Zeiger nicht mehr aktiv – Gesten funktionieren auch ohne Capture.
    }
    gesture.current = null;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length >= 2 && pts[0] && pts[1]) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (!gesture.current) gesture.current = { dist, scale };
      else if (gesture.current.dist > 0) {
        const next = Math.min(
          COVER_MAX_SCALE,
          Math.max(COVER_MIN_SCALE, (gesture.current.scale * dist) / gesture.current.dist),
        );
        setScale(next);
        setClamped(offset.x, offset.y, next);
      }
      return;
    }
    setClamped(offset.x + (e.clientX - prev.x), offset.y + (e.clientY - prev.y));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
  };

  const apply = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const crop = computeCoverCrop({ ...view, offsetX: clamped.x, offsetY: clamped.y });
      onApply(await cropImageDataUrl(image, crop));
    } finally {
      setBusy(false);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[220] grid place-items-center bg-black/80 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-4 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-foreground">{t.title}</div>
          <button
            onClick={onCancel}
            aria-label={t.cancel}
            className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          ref={frameRef}
          data-zoom-surface
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ aspectRatio: String(aspect), touchAction: "none" }}
          className="relative mt-3 w-full select-none overflow-hidden rounded-xl border border-border bg-background"
        >
          <img
            src={image}
            alt=""
            draggable={false}
            style={{
              width: `${disp.w}px`,
              height: `${disp.h}px`,
              transform: `translate(calc(-50% + ${clamped.x}px), calc(-50% + ${clamped.y}px))`,
            }}
            className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
          />
          <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/20" />
        </div>

        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Move className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0">{t.hint}</span>
        </div>

        <label className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
          <ZoomIn className="h-3.5 w-3.5 shrink-0" />
          <span className="shrink-0">{t.zoom}</span>
          <input
            type="range"
            min={COVER_MIN_SCALE}
            max={COVER_MAX_SCALE}
            step={0.01}
            value={scale}
            onChange={(e) => {
              const next = Number(e.target.value);
              setScale(next);
              setClamped(offset.x, offset.y, next);
            }}
            className="min-w-0 flex-1 accent-brand-cyan"
          />
        </label>

        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-full border border-border px-5 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            {t.cancel}
          </button>
          <button
            onClick={() => void apply()}
            disabled={busy || natural.w === 0}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-brand px-6 py-2 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
          >
            <Check className="h-4 w-4" /> {busy ? t.working : t.apply}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
