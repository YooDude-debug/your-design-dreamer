import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

/**
 * Globaler Bild-Viewer.
 *
 * Ziel: es wird ausschliesslich das Bild selbst transformiert – nie der
 * Beitrag, das Layout oder Bedienelemente. Waehrend der Gesten laeuft die
 * Transformation direkt auf dem DOM-Knoten (kein React-State) und damit ohne
 * Re-Renders und ohne Layout-Neuberechnung (`translate3d` + `will-change`).
 */
export type ZoomImage = {
  /** Sofort sichtbare (optimierte) Variante */
  src: string;
  /** Originaldatei – wird nach dem Oeffnen automatisch nachgeladen */
  original?: string | null;
  alt?: string;
};

type Ctx = { openImage: (img: ZoomImage) => void };

const ImageZoomContext = createContext<Ctx>({ openImage: () => undefined });

export function useImageZoom() {
  return useContext(ImageZoomContext);
}

export function ImageZoomProvider({ children }: { children: ReactNode }) {
  const [image, setImage] = useState<ZoomImage | null>(null);
  const openImage = useCallback((img: ZoomImage) => setImage(img), []);
  const value = useMemo<Ctx>(() => ({ openImage }), [openImage]);

  return (
    <ImageZoomContext.Provider value={value}>
      {children}
      {image && <ImageZoomViewer image={image} onClose={() => setImage(null)} />}
    </ImageZoomContext.Provider>
  );
}

const MIN = 1;
const MAX = 6;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function ImageZoomViewer({ image, onClose }: { image: ZoomImage; onClose: () => void }) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  /** Aktuelle Transformation – absichtlich kein State (keine Re-Renders). */
  const view = useRef({ x: 0, y: 0, scale: 1 });
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinch = useRef<{
    dist: number;
    scale: number;
    cx: number;
    cy: number;
    x: number;
    y: number;
  } | null>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const lastTap = useRef(0);

  /** Originaldatei nachladen: Zoom immer auf Basis der hoechsten Qualitaet. */
  const [src, setSrc] = useState(image.src);
  useEffect(() => {
    setSrc(image.src);
    const full = image.original;
    if (!full || full === image.src) return;
    const pre = new Image();
    pre.decoding = "async";
    pre.onload = () => setSrc(full);
    pre.src = full;
    return () => {
      pre.onload = null;
    };
  }, [image.src, image.original]);

  const apply = useCallback((animate = false) => {
    const el = imgRef.current;
    if (!el) return;
    const v = view.current;
    el.style.transition = animate ? "transform 220ms cubic-bezier(0.22,1,0.36,1)" : "none";
    el.style.transform = `translate3d(${v.x}px, ${v.y}px, 0) scale(${v.scale})`;
  }, []);

  /** Bild bleibt innerhalb des Viewers; bei Zoom 1 sauber zentriert. */
  const clampOffset = useCallback(() => {
    const v = view.current;
    const box = boxRef.current?.getBoundingClientRect();
    const el = imgRef.current;
    if (!box || !el || v.scale <= 1) {
      v.x = 0;
      v.y = 0;
      return;
    }
    const w = el.clientWidth;
    const h = el.clientHeight;
    const maxX = Math.max(0, (w * v.scale - box.width) / 2);
    const maxY = Math.max(0, (h * v.scale - box.height) / 2);
    v.x = clamp(v.x, -maxX, maxX);
    v.y = clamp(v.y, -maxY, maxY);
  }, []);

  const zoomAt = useCallback(
    (nextRaw: number, ax?: number, ay?: number, animate = false) => {
      const box = boxRef.current?.getBoundingClientRect();
      const v = view.current;
      const next = clamp(+nextRaw.toFixed(3), MIN, MAX);
      if (box) {
        const px = (ax ?? box.left + box.width / 2) - box.left - box.width / 2;
        const py = (ay ?? box.top + box.height / 2) - box.top - box.height / 2;
        const k = next / v.scale;
        v.x = px - (px - v.x) * k;
        v.y = py - (py - v.y) * k;
      }
      v.scale = next;
      clampOffset();
      apply(animate);
    },
    [apply, clampOffset],
  );

  const reset = useCallback(() => {
    view.current = { x: 0, y: 0, scale: 1 };
    apply(true);
  }, [apply]);

  /** Rad/Trackpad-Pinch: nicht-passiver Listener, damit die Seite nicht scrollt. */
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      zoomAt(view.current.scale * Math.exp(-dy * 0.0015), e.clientX, e.clientY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+") zoomAt(view.current.scale * 1.25);
      if (e.key === "-") zoomAt(view.current.scale / 1.25);
      if (e.key === "0") reset();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, reset, zoomAt]);

  const twoPointers = () => {
    const [a, b] = [...pointers.current.values()];
    return {
      dist: Math.hypot(b.x - a.x, b.y - a.y) || 1,
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2,
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    if (pointers.current.size === 2) {
      const { dist, cx, cy } = twoPointers();
      const v = view.current;
      pinch.current = { dist, scale: v.scale, cx, cy, x: v.x, y: v.y };
      drag.current = null;
      return;
    }
    // Doppeltippen / Doppelklick: 1 <-> 2.5
    const now = Date.now();
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      if (view.current.scale > 1.05) reset();
      else zoomAt(2.5, e.clientX, e.clientY, true);
      return;
    }
    lastTap.current = now;
    if (view.current.scale > 1)
      drag.current = { px: e.clientX, py: e.clientY, x: view.current.x, y: view.current.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId))
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const p = pinch.current;
    if (p && pointers.current.size === 2) {
      const { dist, cx, cy } = twoPointers();
      const box = boxRef.current?.getBoundingClientRect();
      const scale = clamp(+(p.scale * (dist / p.dist)).toFixed(3), MIN, MAX);
      const v = view.current;
      const k = scale / p.scale;
      if (box) {
        const ax = p.cx - box.left - box.width / 2;
        const ay = p.cy - box.top - box.height / 2;
        v.x = ax - (ax - p.x) * k + (cx - p.cx);
        v.y = ay - (ay - p.y) * k + (cy - p.cy);
      }
      v.scale = scale;
      clampOffset();
      apply();
      return;
    }

    const d = drag.current;
    if (!d) return;
    const v = view.current;
    v.x = d.x + (e.clientX - d.px);
    v.y = d.y + (e.clientY - d.py);
    clampOffset();
    apply();
  };

  const endPointer = (e?: React.PointerEvent) => {
    if (e) pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    drag.current = null;
    // Beim Zurueckzoomen springt das Bild sauber in die Ausgangsposition.
    if (view.current.scale <= 1.02) reset();
  };

  const tools = [
    {
      icon: ZoomOut,
      label: "Verkleinern",
      fn: () => zoomAt(view.current.scale / 1.25, undefined, undefined, true),
    },
    {
      icon: ZoomIn,
      label: "Vergrößern",
      fn: () => zoomAt(view.current.scale * 1.25, undefined, undefined, true),
    },
    { icon: RotateCcw, label: "Zoom zurücksetzen", fn: reset },
  ];

  return (
    <div
      className="fixed inset-0 z-[200] animate-fade-in bg-black/95"
      role="dialog"
      aria-modal="true"
      data-zoom-surface=""
      aria-label={image.alt || "Bildansicht"}
    >
      <div
        ref={boxRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onClick={(e) => {
          if (e.target === e.currentTarget && view.current.scale <= 1.02) onClose();
        }}
        style={{ touchAction: "none" }}
        className="absolute inset-0 grid place-items-center overflow-hidden"
      >
        <img
          ref={imgRef}
          src={src}
          alt={image.alt ?? ""}
          decoding="async"
          draggable={false}
          style={{
            transform: "translate3d(0,0,0) scale(1)",
            willChange: "transform",
            backfaceVisibility: "hidden",
          }}
          className="max-h-full max-w-full select-none object-contain"
        />
      </div>

      <div
        className="absolute right-3 flex items-center gap-1 rounded-full border border-border bg-background/70 px-2 py-1 backdrop-blur-xl"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
      >
        {tools.map(({ icon: Icon, label, fn }) => (
          <button
            key={label}
            type="button"
            title={label}
            aria-label={label}
            onClick={fn}
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-brand/15 hover:text-brand"
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
        <button
          type="button"
          title="Schließen"
          aria-label="Schließen"
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-brand/15 hover:text-brand"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
