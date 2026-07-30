import { useRef, useState } from "react";
import { Move, Trash2, RotateCw, ZoomIn, ZoomOut, Layers } from "lucide-react";
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

  const update = (id: string, patch: Partial<SlangTagPlacement>) =>
    onChange?.(placements.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const onPointerDown = (e: React.PointerEvent, p: SlangTagPlacement) => {
    if (!editable) return;
    setSelected(p.id);
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    dragRef.current = {
      id: p.id,
      dx: ((e.clientX - box.left) / box.width) * 100 - p.x,
      dy: ((e.clientY - box.top) / box.height) * 100 - p.y,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    const box = boxRef.current?.getBoundingClientRect();
    if (!d || !box) return;
    const x = Math.min(96, Math.max(2, ((e.clientX - box.left) / box.width) * 100 - d.dx));
    const y = Math.min(96, Math.max(2, ((e.clientY - box.top) / box.height) * 100 - d.dy));
    update(d.id, { x, y });
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  return (
    <div
      ref={boxRef}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
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
            <div className={isSel ? "rounded-2xl ring-2 ring-brand ring-offset-2 ring-offset-black/40" : ""}>
              <SlangTagChip
                tag={tag}
                variant={p.variant}
                onOpen={onOpenTag ? () => onOpenTag(tag.name) : undefined}
              />
            </div>
          </div>
        );
      })}

      {editable && selected && (
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/20 bg-black/70 px-2 py-1 backdrop-blur-xl">
          {[
            {
              icon: ZoomOut,
              label: "Kleiner",
              fn: () => {
                const p = placements.find((x) => x.id === selected)!;
                update(selected, { scale: Math.max(0.5, +(p.scale - 0.1).toFixed(2)) });
              },
            },
            {
              icon: ZoomIn,
              label: "Größer",
              fn: () => {
                const p = placements.find((x) => x.id === selected)!;
                update(selected, { scale: Math.min(2, +(p.scale + 0.1).toFixed(2)) });
              },
            },
            {
              icon: RotateCw,
              label: "Drehen",
              fn: () => {
                const p = placements.find((x) => x.id === selected)!;
                update(selected, { rotation: ((p.rotation + 5 + 180) % 360) - 180 });
              },
            },
            {
              icon: Layers,
              label: "Variante wechseln",
              fn: () => {
                const p = placements.find((x) => x.id === selected)!;
                const order: SlangTagPlacement["variant"][] = ["glass", "compact", "dot"];
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
        </div>
      )}

      {editable && placements.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-3 py-1 text-[11px] text-white/80 backdrop-blur">
            <Move className="h-3 w-3" /> SlangTag hinzufügen und frei platzieren
          </span>
        </div>
      )}
    </div>
  );
}
