/**
 * Darstellung und Platzierung eines SlangTags auf einem Messenger-Bild.
 *
 * Bild und SlangTag bleiben getrennt: das Overlay ist ein eigenes,
 * anklickbares Element. Die Position ist relativ (0..1) und daher auf
 * Smartphone, Tablet und Desktop identisch.
 */
import { CloseButton } from "@/components/ui/nav-buttons";
import { useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import {
  relativeFromPointer,
  type ImageTagDict,
  type MediaTagPlacement,
} from "@/lib/messenger-image-tag";

/** Der SlangTag-Chip selbst – identisch in Vorschau und beim Empfänger. */
function TagChip({
  name,
  audio,
  scale,
  rotation,
  interactive,
  playLabel,
}: {
  name: string;
  audio: string | null;
  scale: number;
  rotation: number;
  interactive: boolean;
  playLabel: string;
}) {
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLAudioElement | null>(null);

  const toggle = () => {
    if (!audio) return;
    if (!ref.current) {
      ref.current = new Audio(audio);
      ref.current.onended = () => setPlaying(false);
    }
    if (playing) {
      ref.current.pause();
      setPlaying(false);
    } else {
      void ref.current.play();
      setPlaying(true);
    }
  };

  return (
    <div
      style={{ transform: `scale(${scale}) rotate(${rotation}deg)` }}
      className="flex items-center gap-1.5 rounded-full border border-brand/60 bg-background/80 px-2 py-1 shadow-glow backdrop-blur-xl"
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        disabled={!audio}
        aria-label={playLabel}
        className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gradient-brand text-primary-foreground disabled:opacity-40"
      >
        {playing ? <Pause className="h-2.5 w-2.5" /> : <Play className="h-2.5 w-2.5" />}
      </button>
      <span className="max-w-[9rem] truncate text-[11px] font-bold text-brand">${name}</span>
      {interactive && <span className="text-[9px] text-muted-foreground">⠿</span>}
    </div>
  );
}

/** Empfängeransicht: Bild mit SlangTag an der gespeicherten relativen Stelle. */
export function ImageWithSlangTag({
  src,
  alt,
  placement,
  name,
  audio,
  playLabel,
  className = "max-h-64 rounded-xl object-cover",
}: {
  src: string;
  alt?: string;
  placement: MediaTagPlacement | null;
  name: string | null;
  audio: string | null;
  playLabel: string;
  className?: string;
}) {
  return (
    <div className="relative inline-block">
      <img src={src} alt={alt ?? ""} loading="lazy" decoding="async" className={className} />
      {placement && name && (
        <div
          className="absolute"
          style={{
            left: `${placement.x * 100}%`,
            top: `${placement.y * 100}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <TagChip
            name={name}
            audio={audio}
            scale={placement.scale}
            rotation={placement.rotation}
            interactive={false}
            playLabel={playLabel}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Vorschau während der Erstellung: Bild anzeigen, SlangTag als Overlay frei
 * mit Maus, Touch oder Finger verschieben. Es wird nur die relative Position
 * geändert – niemals das Bild selbst.
 */
export function SlangTagImagePlacer({
  src,
  placement,
  name,
  audio,
  copy,
  playLabel,
  onChange,
  onRemove,
}: {
  src: string;
  placement: MediaTagPlacement | null;
  name: string | null;
  audio: string | null;
  copy: ImageTagDict;
  playLabel: string;
  onChange: (next: MediaTagPlacement) => void;
  onRemove: () => void;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  const move = (clientX: number, clientY: number) => {
    const el = boxRef.current;
    if (!el || !placement) return;
    const rect = el.getBoundingClientRect();
    const { x, y } = relativeFromPointer(rect, clientX, clientY);
    onChange({ ...placement, x, y });
  };

  return (
    <div className="space-y-1.5">
      <div
        ref={boxRef}
        className="relative w-full overflow-hidden rounded-xl border border-border bg-background"
        style={{ touchAction: dragging.current ? "none" : undefined }}
      >
        <img src={src} alt="" className="max-h-56 w-full object-contain" />
        {placement && name && (
          <div
            role="button"
            tabIndex={0}
            aria-label={copy.dragHint}
            onPointerDown={(e) => {
              dragging.current = true;
              (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!dragging.current) return;
              e.preventDefault();
              move(e.clientX, e.clientY);
            }}
            onPointerUp={() => {
              dragging.current = false;
            }}
            onPointerCancel={() => {
              dragging.current = false;
            }}
            onKeyDown={(e) => {
              if (!placement) return;
              const step = 0.02;
              if (e.key === "ArrowLeft")
                onChange({ ...placement, x: Math.max(0, placement.x - step) });
              if (e.key === "ArrowRight")
                onChange({ ...placement, x: Math.min(1, placement.x + step) });
              if (e.key === "ArrowUp")
                onChange({ ...placement, y: Math.max(0, placement.y - step) });
              if (e.key === "ArrowDown")
                onChange({ ...placement, y: Math.min(1, placement.y + step) });
            }}
            className="absolute cursor-grab touch-none select-none active:cursor-grabbing"
            style={{
              left: `${placement.x * 100}%`,
              top: `${placement.y * 100}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <TagChip
              name={name}
              audio={audio}
              scale={placement.scale}
              rotation={placement.rotation}
              interactive
              playLabel={playLabel}
            />
          </div>
        )}
        {placement && name && (
          <CloseButton onClick={onRemove} label={copy.remove} size="sm" className="absolute right-2 top-2" />
        )}
      </div>
      {placement && name && <p className="text-[10px] text-muted-foreground">{copy.dragHint}</p>}
    </div>
  );
}
