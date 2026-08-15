import React from "react";
import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../../theme";
import { GlobeSvg, type Cam } from "../../components/GlobeSvg";
import { SlangChip } from "../../components/SlangChip";
import { Waveform } from "../../components/Waveform";
import { Backdrop, BrandCorner } from "./parts";

type Region = { city: string; country: string; code: string; slang: string; lon: number; lat: number };

const REGIONS: Region[] = [
  { city: "Berlin", country: "Germany", code: "DE", slang: "Na, wa?", lon: 13.4, lat: 52.52 },
  { city: "Hamburg", country: "Germany", code: "DE", slang: "Moin!", lon: 9.99, lat: 53.55 },
  { city: "Köln", country: "Germany", code: "DE", slang: "Joot!", lon: 6.96, lat: 50.94 },
  { city: "Athens", country: "Greece", code: "GR", slang: "Ela!", lon: 23.73, lat: 37.98 },
];

const CUT = 42;

/** Kamera folgt den Regionen – der Globus bleibt bewusst im Hintergrund. */
function camAt(frame: number): Cam {
  const keys = REGIONS.map((r, i) => i * CUT + 8);
  const lon = interpolate(frame, keys, REGIONS.map((r) => r.lon), {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const lat = interpolate(frame, keys, REGIONS.map((r) => r.lat), {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { lon, lat, scale: 1500 + Math.sin(frame / 30) * 40 };
}

const Card: React.FC<{ region: Region; index: number }> = ({ region, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 16, stiffness: 190 } });
  const out = interpolate(frame, [CUT - 8, CUT], [0, 1], { extrapolateLeft: "clamp" });
  const side = index % 2 === 0;

  return (
    <AbsoluteFill
      style={{
        padding: "0 88px",
        justifyContent: "center",
        alignItems: side ? "flex-start" : "flex-end",
        opacity: 1 - out,
        transform: `translateY(${out * -60}px)`,
      }}
    >
      <div style={{ maxWidth: 880, textAlign: side ? "left" : "right" }}>
        <div
          style={{
            fontSize: 34,
            letterSpacing: 8,
            fontWeight: 700,
            textTransform: "uppercase",
            color: C.green,
            opacity: pop,
          }}
        >
          {region.city} · {region.country}
        </div>
        <div
          style={{
            fontSize: 156,
            fontWeight: 800,
            letterSpacing: -8,
            color: C.ink,
            lineHeight: 1,
            marginTop: 12,
            opacity: pop,
            transform: `translateX(${interpolate(pop, [0, 1], [side ? -70 : 70, 0])}px)`,
          }}
        >
          {region.slang}
        </div>
        <div
          style={{
            marginTop: 30,
            display: "flex",
            justifyContent: side ? "flex-start" : "flex-end",
            opacity: interpolate(frame, [8, 18], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          <SlangChip
            label={region.slang.replace(/[^\p{L}]/gu, "").toLowerCase()}
            meta={`${region.city} · ${region.code}`}
            frame={frame}
            playing
            scale={1.5}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Vier schnelle Schnitte: eine Region, ein Slang, ein SlangTag. */
export const SceneRegions: React.FC = () => {
  const frame = useCurrentFrame();
  const cam = camAt(frame);

  return (
    <AbsoluteFill>
      <Backdrop frame={frame} strength={0.12} />
      <div style={{ position: "absolute", inset: 0, opacity: 0.5 }}>
        <GlobeSvg cam={cam} width={1080} height={1920} cx={540} cy={1180} />
      </div>
      <BrandCorner frame={frame} opacity={0.75} />

      {REGIONS.map((r, i) => (
        <Sequence key={r.city} from={i * CUT} durationInFrames={CUT}>
          <Card region={r} index={i} />
        </Sequence>
      ))}

      <div style={{ position: "absolute", left: 88, bottom: 120, opacity: 0.9 }}>
        <Waveform frame={frame} bars={30} height={64} width={6} color={C.green} />
      </div>
    </AbsoluteFill>
  );
};
