import { CloseButton } from "@/components/ui/nav-buttons";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { lockNavGesture, unlockNavGesture } from "@/lib/use-swipe-nav-gesture";
import { Trash2, Layers, Maximize2, X, ZoomIn, ZoomOut, RotateCcw, ImageOff } from "lucide-react";

import { SlangTagChip } from "@/components/SlangTagChip";
import { SLANGTAG_DND_TYPE } from "@/components/SlangBox";
import { useData } from "@/lib/data-context";
import type { SlangTagPlacement } from "@/lib/types";

type Props = {
  image: string;
  /**
   * SlangTag Video (Short): stumme Bildspur, die anstelle des Standbilds laeuft.
   * Der Ton bleibt ausschliesslich der SlangTag – das Video ist immer stumm.
   */
  video?: string | null;
  /**
   * SlangShot-Wiedergabe von aussen gesteuert (Video + SlangTag als Einheit).
   * Ohne Ref bleibt das Verhalten wie bisher: stummer Autoplay-Loop.
   */
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  /** true = kein eigener Autoplay/Loop, der Sync-Controller startet. */
  videoControlled?: boolean;
  videoLoop?: boolean;
  /** Zusaetzliche Ebene ueber dem Medium (z. B. SlangShot-Playbutton). */
  overlay?: React.ReactNode;
  /** SlangShot: dieser SlangTag wird vom Sync-Controller abgespielt. */
  activeTagId?: string | null;
  activePlaying?: boolean;
  activeMedia?: HTMLMediaElement | null;
  onActiveToggle?: () => void;
  /** Ausweich-Quelle, falls eine optimierte Variante fehlt (Altbestand) */
  fallbackImage?: string | null;
  placements: SlangTagPlacement[];
  /** Nur der Ersteller darf bearbeiten */
  editable?: boolean;
  /**
   * Interaktion ohne sichtbare Editor-Oberfläche (öffentlicher Landingpage-
   * Tester): Verschieben, Skalieren, Drehen und Wiedergabe bleiben aktiv,
   * Auswahlrahmen, Löschen-, Ebenen- und Werkzeugleiste werden ausgeblendet.
   */
  chromeless?: boolean;
  onChange?: (next: SlangTagPlacement[]) => void;
  onOpenTag?: (name: string) => void;
  /** Drag & Drop aus der Slang Box: liefert Tag-ID und Position in Prozent */
  onDropTag?: (tagId: string, x: number, y: number) => void;
  /** Tippen auf das Bild öffnet den Bild-Viewer (Original-Zoom, nur das Bild) */
  zoomable?: boolean;
  /** Originaldatei – wird im Viewer nachgeladen (max. Qualität) */
  zoomOriginal?: string | null;
  /** Große Arbeitsfläche: Bild verschieben (Maus/Finger) und zoomen (Rad/Pinch) */
  pannable?: boolean;
  /**
   * Gewählter Bildausschnitt (Anteile 0..1 des Originalbildes) – nur in der
   * Arbeitsfläche. `null` = kein Beschnitt (komplettes Bild sichtbar).
   */
  onCropChange?: (crop: { x: number; y: number; w: number; h: number } | null) => void;
  /**
   * Feed-Rahmen: feste Medienfläche (Breite/Höhe). Das Bild wird proportional
   * eingepasst ("contain"), niemals beschnitten oder verzerrt. Die SlangTag-
   * Ebene liegt weiterhin exakt auf dem sichtbaren Bildrechteck.
   */
  frameAspect?: number | null;

  className?: string;
};

export function SlangTagCanvas({
  image,
  video,
  videoRef,
  videoControlled = false,
  videoLoop = true,
  overlay,
  activeTagId = null,
  activePlaying = false,
  activeMedia = null,
  onActiveToggle,
  fallbackImage,
  placements,
  editable = false,
  chromeless = false,
  onChange,
  onOpenTag,
  onDropTag,
  zoomable = false,
  zoomOriginal,
  pannable = false,
  onCropChange,
  frameAspect = null,
  className = "",
}: Props) {
  const { getTag } = useData();
  /** Feed: feste Medienfläche mit eingepasstem Bild. */
  const framed = !!frameAspect && !pannable;
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  /** Container-Maße und echte Bildmaße – Grundlage der bildbezogenen Position */
  const [boxSize, setBoxSize] = useState({ w: 0, h: 0 });
  const [nat, setNat] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      setBoxSize({ w: r.width, h: r.height });
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  /**
   * Bild erst zeigen, wenn es VOLLSTÄNDIG dekodiert ist. Auf Smartphones malt
   * der Browser progressive JPEG/WebP-Daten sonst schon während des Ladens –
   * sichtbar als bunte Balken/Artefakte.
   */
  const [imgReady, setImgReady] = useState(false);
  /** Laden endgültig fehlgeschlagen (auch Fallback) – definierter Platzhalter. */
  const [imgFailed, setImgFailed] = useState(false);
  /** Aktuelle Quelle: ein spätes decode() der Vorgängerkarte darf nicht greifen. */
  const activeImageSource = useRef("");
  const [videoReady, setVideoReady] = useState(false);
  const markReady = (el: HTMLImageElement | null) => {
    if (!el) return;
    const requestedSource = el.getAttribute("src") ?? "";
    const done = () => {
      if (activeImageSource.current !== requestedSource) return;
      if (!el.isConnected || !el.complete || !el.naturalWidth) return;
      setNat((prev) =>
        prev.w === el.naturalWidth && prev.h === el.naturalHeight
          ? prev
          : { w: el.naturalWidth, h: el.naturalHeight },
      );
      setImgFailed(false);
      setImgReady(true);
    };
    if (typeof el.decode === "function") el.decode().then(done, done);
    else done();
  };
  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => markReady(e.currentTarget);
  /**
   * Bereits im Cache liegende Bilder feuern `onLoad` nicht zuverlässig –
   * stabile Ref-Identität, sonst Render-Schleife.
   */
  const attachImg = useCallback((el: HTMLImageElement | null) => {
    if (el?.complete && el.naturalWidth) markReady(el);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const handleRef = useRef<{
    id: string;
    cx: number;
    cy: number;
    dist: number;
    angle: number;
    scale: number;
    rotation: number;
  } | null>(null);
  /** aktive Pointer für Pinch-Zoom */
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{
    id: string;
    dist: number;
    angle: number;
    scale: number;
    rotation: number;
  } | null>(null);

  /** Bild-Ansicht (Pan/Zoom) */
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const viewDrag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const viewPinch = useRef<{
    dist: number;
    scale: number;
    cx: number;
    cy: number;
    x: number;
    y: number;
  } | null>(null);
  const bgPointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const clampView = (s: number) => Math.min(5, Math.max(1, +s.toFixed(3)));

  /** Bild bleibt immer innerhalb der Arbeitsfläche; bei Zoom 1 zentriert. */
  const clampOffset = (x: number, y: number, scale: number) => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box || scale <= 1) return { x: 0, y: 0 };
    // Arbeitsfläche: Grenzen richten sich nach dem eingepassten Bild, damit
    // Hoch-/Querformate frei positionierbar sind und nichts zurückspringt.
    if (pannable && !video) {
      const b = baseRect();
      const mx = Math.max(0, (b.w * scale - box.width) / 2);
      const my = Math.max(0, (b.h * scale - box.height) / 2);
      return { x: Math.min(mx, Math.max(-mx, x)), y: Math.min(my, Math.max(-my, y)) };
    }
    const maxX = ((scale - 1) * box.width) / 2;
    const maxY = ((scale - 1) * box.height) / 2;
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  };

  /** Zoomt um einen Ankerpunkt (Cursor/Pinch-Mitte) und hält ihn stabil. */
  const zoomAt = (nextScaleRaw: number, ax?: number, ay?: number) =>
    setView((v) => {
      const next = clampView(nextScaleRaw);
      const box = boxRef.current?.getBoundingClientRect();
      if (!box) return { ...v, scale: next };
      const px = (ax ?? box.left + box.width / 2) - box.left - box.width / 2;
      const py = (ay ?? box.top + box.height / 2) - box.top - box.height / 2;
      const k = next / v.scale;
      const off = clampOffset(px - (px - v.x) * k, py - (py - v.y) * k, next);
      return { x: off.x, y: off.y, scale: next };
    });

  const clampScale = (s: number) => Math.min(3, Math.max(0.3, +s.toFixed(2)));

  /**
   * Sichtbares Bildrechteck innerhalb der Arbeitsfläche.
   * Ohne Pan/Zoom füllt das Bild den Container vollständig (die Höhe folgt dem
   * Seitenverhältnis), in der Arbeitsfläche wird es eingepasst ("contain") und
   * mit Pan/Zoom bewegt. Alle Positionen sind Prozent DIESES Rechtecks.
   */
  const baseRect = () => {
    const { w, h } = boxSize;
    // SlangShot: das Video fuellt die komplette Arbeitsflaeche (object-cover).
    // Die SlangTag-Ebene ist deshalb genau diese Flaeche – frei bespielbar.
    if (video) return { x: 0, y: 0, w, h };
    if ((!pannable && !framed) || !nat.w || !nat.h || !w || !h) return { x: 0, y: 0, w, h };
    const s = Math.min(w / nat.w, h / nat.h);
    const iw = nat.w * s;
    const ih = nat.h * s;
    return { x: (w - iw) / 2, y: (h - ih) / 2, w: iw, h: ih };
  };

  /** Bildrechteck in Bildschirmkoordinaten (inklusive Pan/Zoom) */
  const imageRect = () => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return null;
    if ((!pannable && !framed) || video)
      return { left: box.left, top: box.top, w: box.width, h: box.height };
    const b = baseRect();
    const w = b.w * view.scale;
    const h = b.h * view.scale;
    return {
      left: box.left + box.width / 2 + view.x - w / 2,
      top: box.top + box.height / 2 + view.y - h / 2,
      w,
      h,
    };
  };

  /**
   * Gewählter Bildausschnitt melden (Anteile des Originalbildes). Damit kann
   * der Beitrag exakt mit dem eingestellten Ausschnitt veröffentlicht werden.
   */
  const cropRef = useRef(onCropChange);
  cropRef.current = onCropChange;
  useEffect(() => {
    const cb = cropRef.current;
    if (!cb) return;
    if (!pannable || video || !nat.w || !nat.h || !boxSize.w || !boxSize.h) return cb(null);
    const s = Math.min(boxSize.w / nat.w, boxSize.h / nat.h);
    const iw = nat.w * s * view.scale;
    const ih = nat.h * s * view.scale;
    const left = boxSize.w / 2 + view.x - iw / 2;
    const top = boxSize.h / 2 + view.y - ih / 2;
    const x = Math.min(1, Math.max(0, -left / iw));
    const y = Math.min(1, Math.max(0, -top / ih));
    const w = Math.min(1, Math.max(0, (boxSize.w - left) / iw)) - x;
    const h = Math.min(1, Math.max(0, (boxSize.h - top) / ih)) - y;
    if (w <= 0 || h <= 0 || (w > 0.999 && h > 0.999)) return cb(null);
    cb({ x, y, w, h });
  }, [pannable, video, nat.w, nat.h, boxSize.w, boxSize.h, view.x, view.y, view.scale]);

  /** Bildschirmpunkt -> Position in Prozent des Bildes */
  const toPercent = (clientX: number, clientY: number) => {
    const r = imageRect();
    if (!r || !r.w || !r.h) return null;
    return { x: ((clientX - r.left) / r.w) * 100, y: ((clientY - r.top) / r.h) * 100 };
  };

  /**
   * Zoom direkt im bestehenden Bildcontainer (kein zweiter Bild-Viewer).
   * Bild und SlangTag-Ebene nutzen dieselbe Transformationsmatrix.
   */
  const inlineZoom = zoomable && !editable && !pannable;
  const lastTap = useRef(0);

  /** Beim ersten Zoom wird das Original nachgeladen (max. Qualität). */
  const [hiRes, setHiRes] = useState<string | null>(null);
  useEffect(() => setHiRes(null), [image]);
  useEffect(() => {
    if (!inlineZoom || hiRes || view.scale <= 1) return;
    const full = zoomOriginal;
    if (!full || full === image) return;
    const pre = new Image();
    pre.decoding = "async";
    pre.onload = () => setHiRes(full);
    pre.src = full;
    return () => {
      pre.onload = null;
    };
  }, [inlineZoom, hiRes, view.scale, zoomOriginal, image]);

  /** Rad/Trackpad-Pinch: nicht-passiv, damit die Seite nicht scrollt. */
  const zoomRef = useRef(zoomAt);
  zoomRef.current = zoomAt;
  const scaleRef = useRef(view.scale);
  scaleRef.current = view.scale;
  useEffect(() => {
    if (!inlineZoom) return;
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && Math.abs(e.deltaY) < 2) return;
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      zoomRef.current(scaleRef.current * Math.exp(-dy * 0.0015), e.clientX, e.clientY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [inlineZoom]);

  /** Fehlt eine optimierte Variante (ältere Beiträge), wird das Original geladen. */
  const [broken, setBroken] = useState(false);
  const src = hiRes ?? (broken && fallbackImage ? fallbackImage : image);
  activeImageSource.current = src;
  useEffect(() => setBroken(false), [image]);
  /**
   * Quellwechsel (neuer Beitrag im wiederverwendeten DOM-Element, Fallback,
   * Original für den Zoom): der alte Frame darf nicht stehenbleiben und der
   * neue nicht halbfertig erscheinen.
   */
  useLayoutEffect(() => {
    setImgReady(false);
    setVideoReady(false);
    setNat({ w: 0, h: 0 });
    setImgFailed(!src);
  }, [src, video]);

  const onImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if ((e.currentTarget.getAttribute("src") ?? "") !== activeImageSource.current) return;
    if (!broken && fallbackImage && fallbackImage !== image) setBroken(true);
    else setImgFailed(true);
  };

  /** Gerenderte Chip-Elemente je Platzierung – Grundlage der harten Bildgrenze */
  const chipEls = useRef<Map<string, HTMLElement>>(new Map());

  /**
   * Harte Bildgrenze: die KOMPLETTE Fläche des Chips (inkl. Rotation/Skalierung)
   * muss innerhalb des sichtbaren Bildrechtecks bleiben. Gemessen wird die
   * tatsächlich gerenderte Größe, damit die Begrenzung responsiv bleibt.
   */
  const clampToImage = (id: string, x: number, y: number) => {
    const r = imageRect();
    const el = chipEls.current.get(id);
    if (!r || !r.w || !r.h || !el) {
      return { x: Math.min(98, Math.max(2, x)), y: Math.min(98, Math.max(2, y)) };
    }
    const c = el.getBoundingClientRect();
    const halfX = Math.min(50, (c.width / 2 / r.w) * 100);
    const halfY = Math.min(50, (c.height / 2 / r.h) * 100);
    return {
      x: Math.min(100 - halfX, Math.max(halfX, x)),
      y: Math.min(100 - halfY, Math.max(halfY, y)),
    };
  };

  const update = (id: string, patch: Partial<SlangTagPlacement>) =>
    onChange?.(placements.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  /** Pointer, die aktuell die globale Wischnavigation sperren. */
  const lockedPointers = useRef<Set<number>>(new Set());

  useEffect(
    () => () => {
      for (const id of lockedPointers.current) {
        void id;
        unlockNavGesture();
      }
      lockedPointers.current.clear();
    },
    [],
  );

  const twoPointerState = () => {
    const [a, b] = [...pointers.current.values()];
    return {
      dist: Math.hypot(b.x - a.x, b.y - a.y),
      angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
    };
  };

  const onPointerDown = (e: React.PointerEvent, p: SlangTagPlacement) => {
    if (!editable) return;
    // Der Touch gehoert ab jetzt ausschliesslich dem SlangTag: globale
    // Wischnavigation fuer die Dauer der Geste sperren.
    if (!lockedPointers.current.has(e.pointerId)) {
      lockedPointers.current.add(e.pointerId);
      lockNavGesture();
    }
    setSelected(p.id);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    if (pointers.current.size === 2) {
      const { dist, angle } = twoPointerState();
      pinchRef.current = { id: p.id, dist, angle, scale: p.scale, rotation: p.rotation };
      dragRef.current = null;
      return;
    }

    const pt = toPercent(e.clientX, e.clientY);
    if (!pt) return;
    dragRef.current = { id: p.id, dx: pt.x - p.x, dy: pt.y - p.y };
  };

  /** Ziehpunkt unten rechts: skalieren + drehen */
  const onHandleDown = (e: React.PointerEvent, p: SlangTagPlacement) => {
    e.stopPropagation();
    if (!lockedPointers.current.has(e.pointerId)) {
      lockedPointers.current.add(e.pointerId);
      lockNavGesture();
    }
    const r = imageRect();
    if (!r) return;
    const cx = r.left + (p.x / 100) * r.w;
    const cy = r.top + (p.y / 100) * r.h;

    handleRef.current = {
      id: p.id,
      cx,
      cy,
      dist: Math.max(8, Math.hypot(e.clientX - cx, e.clientY - cy)),
      angle: (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI,
      scale: p.scale,
      rotation: p.rotation,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId))
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const h = handleRef.current;
    if (h) {
      const dist = Math.max(8, Math.hypot(e.clientX - h.cx, e.clientY - h.cy));
      const angle = (Math.atan2(e.clientY - h.cy, e.clientX - h.cx) * 180) / Math.PI;
      const cur = placements.find((x) => x.id === h.id);
      update(h.id, {
        scale: clampScale(h.scale * (dist / h.dist)),
        rotation: Math.round(((h.rotation + (angle - h.angle) + 540) % 360) - 180),
        // Nach Skalieren/Drehen darf der Chip nicht über den Bildrand ragen.
        ...(cur ? clampToImage(h.id, cur.x, cur.y) : {}),
      });
      return;
    }

    const pinch = pinchRef.current;
    if (pinch && pointers.current.size === 2) {
      const { dist, angle } = twoPointerState();
      const cur = placements.find((x) => x.id === pinch.id);
      update(pinch.id, {
        scale: clampScale(pinch.scale * (dist / (pinch.dist || 1))),
        rotation: Math.round(((pinch.rotation + (angle - pinch.angle) + 540) % 360) - 180),
        ...(cur ? clampToImage(pinch.id, cur.x, cur.y) : {}),
      });
      return;
    }

    const d = dragRef.current;
    const pt = d ? toPercent(e.clientX, e.clientY) : null;
    if (!d || !pt) return;
    update(d.id, clampToImage(d.id, pt.x - d.dx, pt.y - d.dy));
  };

  const endDrag = (e?: React.PointerEvent) => {
    if (e) {
      pointers.current.delete(e.pointerId);
      if (lockedPointers.current.delete(e.pointerId)) unlockNavGesture();
    } else {
      for (const id of lockedPointers.current) {
        void id;
        unlockNavGesture();
      }
      lockedPointers.current.clear();
    }
    if (pointers.current.size < 2) pinchRef.current = null;
    dragRef.current = null;
    handleRef.current = null;
  };

  /**
   * Hintergrund: Bild ist standardmäßig fixiert.
   * Arbeitsfläche (pannable): Maus nur mit mittlerer Taste, Touch mit zwei Fingern.
   * Ansicht (inlineZoom): Pinch, Doppeltippen und – ab Zoom > 1 – Verschieben.
   */
  const onBgPointerDown = (e: React.PointerEvent) => {
    if (inlineZoom) {
      bgPointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      if (bgPointers.current.size === 2) {
        const [a, b] = [...bgPointers.current.values()];
        viewPinch.current = {
          dist: Math.hypot(b.x - a.x, b.y - a.y) || 1,
          scale: view.scale,
          cx: (a.x + b.x) / 2,
          cy: (a.y + b.y) / 2,
          x: view.x,
          y: view.y,
        };
        viewDrag.current = null;
        return;
      }
      const now = Date.now();
      if (now - lastTap.current < 300) {
        lastTap.current = 0;
        if (view.scale > 1.05) setView({ x: 0, y: 0, scale: 1 });
        else zoomAt(2.5, e.clientX, e.clientY);
        return;
      }
      lastTap.current = now;
      if (view.scale > 1) viewDrag.current = { px: e.clientX, py: e.clientY, x: view.x, y: view.y };
      return;
    }
    if (!pannable) return;
    setSelected(null);
    // SlangShot: die Videoflaeche bleibt fix, damit Positionen exakt passen.
    if (video) return;
    const isTouch = e.pointerType === "touch" || e.pointerType === "pen";
    if (!isTouch && e.button === 2) return; // Rechtsklick verschiebt nicht
    if (!isTouch) e.preventDefault();
    bgPointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    // Zwei Finger = Pinch-Zoom, ein Finger bzw. Maus gezogen = verschieben.
    if (isTouch && bgPointers.current.size === 2) {
      const [a, b] = [...bgPointers.current.values()];
      viewPinch.current = {
        dist: Math.hypot(b.x - a.x, b.y - a.y) || 1,
        scale: view.scale,
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
        x: view.x,
        y: view.y,
      };
      viewDrag.current = null;
      return;
    }
    viewDrag.current = { px: e.clientX, py: e.clientY, x: view.x, y: view.y };
  };

  const onBgPointerMove = (e: React.PointerEvent) => {
    if (!pannable && !inlineZoom) return;
    if (bgPointers.current.has(e.pointerId))
      bgPointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (viewPinch.current && bgPointers.current.size === 2) {
      const [a, b] = [...bgPointers.current.values()];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const vp = viewPinch.current;
      const scale = clampView(vp.scale * (dist / vp.dist));
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      setView(() => {
        const k = scale / vp.scale;
        const off = clampOffset(vp.x * k + (cx - vp.cx), vp.y * k + (cy - vp.cy), scale);
        return { x: off.x, y: off.y, scale };
      });
      return;
    }
    const d = viewDrag.current;
    if (!d) return;
    setView((v) => ({
      ...v,
      ...clampOffset(d.x + (e.clientX - d.px), d.y + (e.clientY - d.py), v.scale),
    }));
  };

  const endBg = (e?: React.PointerEvent) => {
    if (e) bgPointers.current.delete(e.pointerId);
    if (bgPointers.current.size < 2) viewPinch.current = null;
    viewDrag.current = null;
    // Beim Herauszoomen sauber auf 100 % zurück.
    if (inlineZoom && view.scale <= 1.02 && (view.x !== 0 || view.y !== 0 || view.scale !== 1))
      setView({ x: 0, y: 0, scale: 1 });
  };

  const toolbar = editable && !chromeless && (pannable || selected) && (
    <div className="mt-2 flex flex-wrap items-center gap-1 rounded-full border border-border bg-background/70 px-2 py-1 backdrop-blur-xl">
      {pannable && (
        <>
          {[
            {
              icon: ZoomOut,
              label: "Verkleinern",
              fn: () => zoomAt(view.scale / 1.2),
            },
            {
              icon: ZoomIn,
              label: "Vergrößern",
              fn: () => zoomAt(view.scale * 1.2),
            },

            {
              icon: RotateCcw,
              label: "Ansicht zurücksetzen",
              fn: () => setView({ x: 0, y: 0, scale: 1 }),
            },
          ].map(({ icon: Icon, label, fn }) => (
            <button
              key={label}
              type="button"
              title={label}
              aria-label={label}
              onClick={fn}
              className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-brand/15 hover:text-brand"
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </>
      )}
      {selected && (
        <>
          {[
            {
              icon: Layers,
              label: "Variante wechseln",
              fn: () => {
                const p = placements.find((x) => x.id === selected)!;
                const order: SlangTagPlacement["variant"][] = ["compact", "dot", "glass"];
                update(selected, { variant: order[(order.indexOf(p.variant) + 1) % order.length] });
              },
            },
            {
              icon: Trash2,
              label: "Löschen",
              fn: () => {
                onChange?.(placements.filter((x) => x.id !== selected));
                setSelected(null);
              },
            },
          ].map(({ icon: Icon, label, fn }) => (
            <button
              key={label}
              type="button"
              title={label}
              aria-label={label}
              onClick={fn}
              className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-brand/15 hover:text-brand"
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </>
      )}
    </div>
  );

  /**
   * Sicherheitsnetz: neu abgelegte oder bei Größenänderung überstehende Chips
   * werden einmalig in die Bildfläche zurückgeholt (nur im Bearbeitungsmodus).
   * Im Feed (nicht editierbar) wird nichts neu berechnet.
   */
  useEffect(() => {
    if (!editable || !onChange) return;
    const id = requestAnimationFrame(() => {
      let changed = false;
      const next = placements.map((p) => {
        const c = clampToImage(p.id, p.x, p.y);
        if (Math.abs(c.x - p.x) > 0.05 || Math.abs(c.y - p.y) > 0.05) {
          changed = true;
          return { ...p, ...c };
        }
        return p;
      });
      if (changed) onChange(next);
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable, placements, boxSize.w, boxSize.h, nat.w, nat.h, view.scale]);

  /** Basisrechteck des Bildes im Container (ohne Pan/Zoom) */
  const tagLayer = baseRect();

  /**
   * Responsive Skalierung der SlangTag-Chips: Referenz ist die Smartphone-
   * Breite (BASE_W). Wächst der tatsächliche Bild-/Feed-Container (Tablet,
   * Desktop), skaliert der komplette Chip proportional mit – Position in
   * Prozent, Bildskalierung und Verpixelungslogik bleiben unberührt.
   * Im Bearbeitungsmodus bleibt die Darstellung 1:1 wie bisher.
   */
  const BASE_W = 320;
  const layerW = (pannable || framed ? tagLayer.w : boxSize.w) || BASE_W;
  const fit = editable ? 1 : Math.min(3.5, Math.max(1, layerW / BASE_W));

  return (
    <div>
      <div
        ref={boxRef}
        onPointerMove={(e) => {
          onPointerMove(e);
          onBgPointerMove(e);
        }}
        onPointerDown={onBgPointerDown}
        onPointerUp={(e) => {
          endDrag(e);
          endBg(e);
        }}
        onPointerCancel={(e) => {
          endDrag(e);
          endBg(e);
        }}
        onPointerLeave={() => {
          endDrag();
          endBg();
        }}
        onWheel={(e) => {
          if (!pannable || video) return;
          const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
          zoomAt(view.scale * Math.exp(-dy * 0.0015), e.clientX, e.clientY);
        }}
        onAuxClick={(e) => e.preventDefault()}
        onDragOver={(e) => {
          if (!onDropTag) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(e) => {
          if (!onDropTag) return;
          const tagId = e.dataTransfer.getData(SLANGTAG_DND_TYPE);
          if (!tagId) return;
          e.preventDefault();
          const pt = toPercent(e.clientX, e.clientY);
          if (!pt) return;
          onDropTag(tagId, Math.min(98, Math.max(2, pt.x)), Math.min(98, Math.max(2, pt.y)));
        }}
        {...(inlineZoom || (editable && chromeless)
          ? { "data-zoom-surface": "", ...(view.scale > 1.02 ? { "data-zoomed": "" } : {}) }
          : {})}
        style={{
          ...(framed && frameAspect ? { aspectRatio: `${frameAspect}` } : null),
          ...(pannable
            ? { touchAction: video ? "pan-y" : "none" }
            : inlineZoom
              ? { touchAction: view.scale > 1 ? "none" : "pan-y" }
              : editable && chromeless
                ? { touchAction: "none" }
                : undefined),
        }}
        className={`relative overflow-hidden rounded-2xl border border-brand/10 ${(pannable || framed) && imgReady ? "bg-black/40" : ""} ${imgReady ? "" : "yd-media-shell"} ${className}`}
      >
        {/*
         * Platzhalter: die stabile Containerflaeche selbst (yd-media-shell)
         * zeigt die neutrale Farbe, solange das Medium nicht dekodiert ist.
         * Kein zusaetzliches Layer und keine laufende Animation.
         */}
        {imgFailed && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface-2 text-xs text-muted-foreground"
          >
            <ImageOff className="h-5 w-5 opacity-60" />
          </div>
        )}
        {/* N-02: Ohne Bildquelle wird KEIN <img> erzeugt (kein leeres Element,
            keine fehlerhafte Anfrage) – nur die neutrale Containerfläche. */}
        {!src ? null : pannable ? (
          <img
            key={src}
            ref={attachImg}
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            onError={onImgError}
            onLoad={onImgLoad}
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
            className={`yd-media absolute inset-0 h-full w-full select-none object-contain ${imgReady ? "" : "yd-media-pending"}`}
            draggable={false}
          />
        ) : framed ? (
          /* Nur ein einziges Bild pro Feed-Medium. Eine zweite, weichgezeichnete
             Kopie kann auf Mobil-GPUs beim eigenen Decode fragmentierte Tiles
             ueber das bereits fertige Hauptbild legen. */
          <img
            key={src}
            ref={attachImg}
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            onError={onImgError}
            onLoad={onImgLoad}
            className={`yd-media absolute inset-0 h-full w-full select-none object-contain ${imgReady ? "" : "yd-media-pending"}`}
            draggable={false}
          />
        ) : (
          <img
            key={src}
            ref={attachImg}
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            onError={onImgError}
            onLoad={onImgLoad}
            style={{
              // Platz reservieren, solange die echten Bildmaße fehlen: sonst ist
              // die Karte erst 0 px hoch und wächst nach dem Laden sprunghaft.
              // Feed und Detailansicht nutzen IMMER das echte Seitenverhältnis:
              // nur so deckt sich das Bildrechteck exakt mit der SlangTag-Ebene
              // (inset-0) und die gespeicherten Prozentkoordinaten stimmen.
              aspectRatio:
                nat.w && nat.h ? `${nat.w} / ${nat.h}` : frameAspect ? `${frameAspect}` : "4 / 3",
              ...(inlineZoom
                ? {
                    transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`,
                    willChange: "transform",
                    backfaceVisibility: "hidden",
                  }
                : null),
            }}
            className={`yd-media w-full select-none object-cover ${inlineZoom ? "cursor-zoom-in" : ""} ${imgReady ? "" : "yd-media-pending"}`}
            draggable={false}
          />
        )}

        {/*
         * SlangTag Video (Short): laeuft stumm ueber dem Standbild in Endlosschleife.
         * Der Ton des Beitrags kommt ausschliesslich vom SlangTag.
         */}
        {video && (
          <video
            key={video}
            ref={videoRef}
            src={video}
            muted
            loop={videoControlled ? videoLoop : true}
            autoPlay={!videoControlled}
            playsInline
            preload={videoControlled ? "auto" : "metadata"}
            poster={src}
            onLoadedData={(e) => {
              if (e.currentTarget.getAttribute("src") === video) setVideoReady(true);
            }}
            onError={() => setVideoReady(false)}
            className={`pointer-events-none absolute inset-0 h-full w-full select-none object-cover ${
              videoReady ? "opacity-100" : "opacity-0"
            }`}
          />
        )}

        {/*
         * SlangTag-Ebene liegt exakt auf dem sichtbaren Bildrechteck.
         * Sie erhält dieselbe Pan/Zoom-Transformation wie das Bild (gleicher
         * Ursprung = Container-Mitte), damit die Tags beim Zoomen mitwachsen
         * und niemals verrutschen.
         */}
        <div
          style={
            pannable || framed
              ? {
                  position: "absolute",
                  left: `${tagLayer.x}px`,
                  top: `${tagLayer.y}px`,
                  width: `${tagLayer.w}px`,
                  height: `${tagLayer.h}px`,
                  transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                  transformOrigin: `${boxSize.w / 2 - tagLayer.x}px ${boxSize.h / 2 - tagLayer.y}px`,
                  pointerEvents: "none",
                }
              : {
                  position: "absolute",
                  inset: 0,
                  // Genau dieselbe Matrix wie das Bild (Ursprung Container-Mitte).
                  transform: inlineZoom
                    ? `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`
                    : undefined,
                  willChange: inlineZoom ? "transform" : undefined,
                  pointerEvents: "none",
                }
          }
        >
          {placements.map((p) => {
            const tag = getTag(p.tagId);
            if (!tag) return null;
            const isSel = editable && !chromeless && selected === p.id;
            // Composer: Ziehpunkt erst nach Auswahl.
            // Chromeless Tester: dauerhaft ein kleiner Eck-Griff, sonst keine
            // Editor-Chrome (kein Rahmen, kein Löschen, keine Leiste).
            const showHandle = editable && (chromeless || selected === p.id);
            const handleCounter = 1 / Math.max(0.2, p.scale * fit);
            return (
              <div
                key={p.id}
                ref={(el) => {
                  if (el) chipEls.current.set(p.id, el);
                  else chipEls.current.delete(p.id);
                }}
                data-slangtag-placement={p.tagId}
                onPointerDown={(e) => {
                  // Im Zoom-Modus darf die Geste zum Bild durchreichen.
                  if (!editable) return;
                  e.stopPropagation();
                  onPointerDown(e, p);
                }}
                style={{
                  position: "absolute",
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  transform: `translate(-50%, -50%) rotate(${p.rotation}deg) scale(${p.scale * fit})`,
                  touchAction: "none",
                  pointerEvents: "auto",
                }}
                className={editable ? "cursor-move" : ""}
              >
                <div
                  className={`relative ${isSel ? "rounded-2xl ring-2 ring-brand ring-offset-2 ring-offset-black/40" : ""}`}
                >
                  <SlangTagChip
                    tag={tag}
                    variant={p.variant}
                    onOpen={onOpenTag ? () => onOpenTag(tag.name) : undefined}
                    {...(onActiveToggle && activeTagId === p.tagId
                      ? {
                          activePlaying,
                          activeMedia,
                          onActiveToggle,
                        }
                      : {})}
                  />
                  {editable && !chromeless && (
                    <CloseButton onClick={(e) => {
                        e.stopPropagation();
                        onChange?.(placements.filter((x) => x.id !== p.id));
                        setSelected((s) => (s === p.id ? null : s));
                      }} label={`$${tag.name} entfernen`} className="absolute" />
                  )}
                  {showHandle && (
                    <button
                      type="button"
                      aria-label="Skalieren und drehen"
                      onPointerDown={(e) => onHandleDown(e, p)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        touchAction: "none",
                        ...(chromeless
                          ? {
                              transform: `scale(${handleCounter})`,
                              transformOrigin: "center",
                            }
                          : {}),
                      }}
                      className={
                        chromeless
                          ? "absolute -bottom-3 -right-3 grid h-8 w-8 cursor-nwse-resize place-items-center rounded-full"
                          : "absolute -bottom-2 -right-2 grid h-5 w-5 cursor-nwse-resize place-items-center rounded-full border border-brand bg-black/80 text-brand shadow-glow"
                      }
                    >
                      {chromeless ? (
                        <span className="grid h-4 w-4 place-items-center rounded-full border border-brand/70 bg-black/70 text-brand">
                          <Maximize2 className="h-2 w-2" />
                        </span>
                      ) : (
                        <Maximize2 className="h-2.5 w-2.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/*
         * Overlay (z. B. der zentrale SlangShot-Playbutton) liegt bewusst NACH
         * der SlangTag-Ebene im DOM: SlangTags bleiben ueber dem Video sichtbar,
         * der Playbutton liegt aber immer ganz oben und bleibt anklickbar.
         */}
        {overlay}
      </div>
      {toolbar}
    </div>
  );
}
