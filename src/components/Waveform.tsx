interface WaveformProps {
  bars?: number;
  color?: string;
  className?: string;
}

export function Waveform({ bars = 40, color = "var(--brand)", className = "" }: WaveformProps) {
  const heights = Array.from({ length: bars }, (_, i) => {
    // deterministic pseudo-random pattern
    const v = Math.sin(i * 1.3) * 0.5 + Math.cos(i * 0.7) * 0.3;
    return Math.max(0.15, Math.min(1, Math.abs(v) + 0.2));
  });
  return (
    <div className={`flex items-center gap-[2px] h-8 ${className}`}>
      {heights.map((h, i) => (
        <span
          key={i}
          className="w-[2px] rounded-full"
          style={{
            height: `${h * 100}%`,
            background: color,
            opacity: 0.85,
          }}
        />
      ))}
    </div>
  );
}
