import { useRef, useState } from "react";
import { Move, Trash2, Layers, Maximize2 } from "lucide-react";
import { SlangTagChip } from "@/components/SlangTagChip";
import { useSlangTags, type SlangTagPlacement } from "@/lib/slangtags";

type Props = {
  image: string;
  placements: SlangTagPlacement[];
  /** Nur der Ersteller darf bearbeiten */
  editable?: boolean;
  onChange?: (next: SlangTagPlacement[]) => void;
  onOpenTag?: (name: string) => void;
  className?: string;
};

export function SlangTagCanvas({
  image,
  placements,
  editable = false,
  onChange,
  onOpenTag,
  className = "",
}: Props) {
  const { getTag } = useSlangTags();
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const handleRef = useRef<{ id: string; cx: number; cy: number; dist: number; angle: number; scale: number; rotation: number } | null>(null);
  /** aktive Pointer für Pinch-Zoom */
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ id: string; dist: number; angle: number; scale: number; rotation: number } | null>(null);

  const update = (id: string, patch: Partial<SlangTagPlacement>) =>
    onChange?.(placements.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const clampScale = (s: number) => Math.min(3, Math.max(0.3, +s.toFixed(2)));

  const twoPointerState = () => {
    const [a, b] = [...pointers.current.values()];
    return {
      dist: Math.hypot(b.x - a.x, b.y - a.y),
      angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
    };
  };

  const onPointerDown = (e: React.PointerEvent, p: SlangTagPlacement) => {
    if (!editable) return;
    setSelected(p.id);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    if (pointers.current.size === 2) {
      const { dist, angle } = twoPointerState();
      pinchRef.current = { id: p.id, dist, angle, scale: p.scale, rotation: p.rotation };
      dragRef.current = null;
      return;
    }

    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    dragRef.current = {
      id: p.id,
      dx: ((e.clientX - box.left) / box.width) * 100 - p.x,
      dy: ((e.clientY - box.top) / box.height) * 100 - p.y,
    };
  };

  /** Ziehpunkt unten rechts: skalieren + drehen */
  const onHandleDown = (e: React.PointerEvent, p: SlangTagPlacement) => {
    e.stopPropagation();
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    const cx = box.left + (p.x / 100) * box.width;
    const cy = box.top + (p.y / 100) * box.height;
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
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const h = handleRef.current;
    if (h) {
      const dist = Math.max(8, Math.hypot(e.clientX - h.cx, e.clientY - h.cy));
      const angle = (Math.atan2(e.clientY - h.cy, e.clientX - h.cx) * 180) / Math.PI;
      update(h.id, {
        scale: clampScale(h.scale * (dist / h.dist)),
        rotation: Math.round(((h.rotation + (angle - h.angle) + 540) % 360) - 180),
      });
      return;
    }

    const pinch = pinchRef.current;
    if (pinch && pointers.current.size === 2) {
      const { dist, angle } = twoPointerState();
      update(pinch.id, {
        scale: clampScale(pinch.scale * (dist / (pinch.dist || 1))),
        rotation: Math.round(((pinch.rotation + (angle - pinch.angle) + 540) % 360) - 180),
      });
      return;
    }

    const d = dragRef.current;
    const box = boxRef.current?.getBoundingClientRect();
    if (!d || !box) return;
    const x = Math.min(98, Math.max(2, ((e.clientX - box.left) / box.width) * 100 - d.dx));
    const y = Math.min(98, Math.max(2, ((e.clientY - box.top) / box.height) * 100 - d.dy));
    update(d.id, { x, y });
  };

  const endDrag = (e?: React.PointerEvent) => {
    if (e) pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchRef.current = null;
    dragRef.current = null;
    handleRef.current = null;
  };

  return (
    <div
      ref={boxRef}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={() => endDrag()}
      className={`relative overflow-hidden rounded-xl border border-border ${className}`}
    >
      <img src={image} alt="" className="w-full select-none object-cover" draggable={false} />

      {placements.map((p) => {
        const tag = getTag(p.tagId);
        if (!tag) return null;
        const isSel = editable && selected === p.id;
        return (
          <div
            key={p.id}
            onPointerDown={(e) => onPointerDown(e, p)}
            style={{
              position: "absolute",
              left: `${p.x}%`,
              top: `${p.y}%`,
              transform: `translate(-50%, -50%) rotate(${p.rotation}deg) scale(${p.scale})`,
              touchAction: "none",
            }}
            className={editable ? "cursor-move" : ""}
          >
            <div className={`relative ${isSel ? "rounded-2xl ring-2 ring-brand ring-offset-2 ring-offset-black/40" : ""}`}>
              <SlangTagChip
                tag={tag}
                variant={p.variant}
                onOpen={onOpenTag ? () => onOpenTag(tag.name) : undefined}
              />
              {isSel && (
                <button
                  type="button"
                  aria-label="Skalieren und drehen"
                  onPointerDown={(e) => onHandleDown(e, p)}
                  style={{ touchAction: "none" }}
                  className="absolute -bottom-2 -right-2 grid h-5 w-5 cursor-nwse-resize place-items-center rounded-full border border-brand bg-black/80 text-brand shadow-glow"
                >
                  <Maximize2 className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          </div>
        );
      })}

      {editable && selected && (
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/20 bg-black/70 px-2 py-1 backdrop-blur-xl">
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
              className="grid h-7 w-7 place-items-center rounded-full text-white/80 hover:bg-white/15 hover:text-brand"
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
          <span className="px-1.5 text-[10px] text-white/60">Ziehpunkt oder Pinch zum Skalieren</span>
        </div>
      )}

      {editable && placements.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-3 py-1 text-[11px] text-white/80 backdrop-blur">
            <Move className="h-3 w-3" /> $ tippen, SlangTag wählen und frei platzieren
          </span>
        </div>
      )}
    </div>
  );
}
