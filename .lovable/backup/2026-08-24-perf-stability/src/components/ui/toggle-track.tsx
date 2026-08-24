/**
 * Gemeinsame Slider-/Toggle-Geometrie für Auto Feed und Auto Sound.
 * Der Punkt (Thumb) wird ausschließlich relativ zur echten Track-Breite
 * positioniert (left 2px bzw. 100% - 2px mit translate(-100%)),
 * dadurch sitzt er auf jeder Bildschirmbreite pixelgenau mittig auf der Achse.
 */
export function ToggleTrack({ on, className = "" }: { on: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`relative block h-3 w-5 shrink-0 rounded-full transition-colors sm:h-3.5 sm:w-6 ${
        on ? "bg-brand/70" : "bg-border"
      } ${className}`}
    >
      <span
        className="absolute top-1/2 block aspect-square h-[calc(100%-4px)] rounded-full bg-background transition-[left,transform] duration-200 ease-out"
        style={{
          left: on ? "calc(100% - 2px)" : "2px",
          transform: on ? "translate(-100%, -50%)" : "translate(0, -50%)",
        }}
      />
    </span>
  );
}
