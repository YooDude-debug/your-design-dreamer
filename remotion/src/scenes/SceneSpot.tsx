import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { C } from "../theme";
import { GlobeSvg, project, type Cam } from "../components/GlobeSvg";
import { GlobeIcon } from "../components/GlobeIcon";
import { SlangChip } from "../components/SlangChip";
import { BrandLockup } from "../components/BrandLockup";

/**
 * Y-Dude Werbespot 9:16 (15 s) – der Globe ist der Hauptdarsteller.
 *
 * Kamera-Keyframes fahren durch Regionen, SlangTags erscheinen geografisch
 * verankert, kurze Texte treiben die Challenge ("Wie voll bekommen wir den
 * Globus?"). Alles frame-basiert, keine CSS-Animationen.
 */

const W = 1080;
const H = 1920;
const CX = W / 2;
const CY = 940;

// frame, lon, lat, scale
const CAM: [number, number, number, number][] = [
  [0, 10, 20, 700],
  [55, 13.4, 48, 980],
  [90, 13.4, 52.5, 1480],
  [122, 23.7, 38, 1520],
  [150, 139.7, 35.7, 1560],
  [168, -43.2, -22.9, 1600],
  [240, -41, -21.5, 1660],
  [252, 12.1, 54.1, 1720],
  [330, 13.6, 53.4, 1760],
  [420, 20, 16, 660],
  [450, 34, 13, 640],
];

function camAt(frame: number): Cam {
  const frames = CAM.map((k) => k[0]);
  const lon = interpolate(frame, frames, CAM.map((k) => k[1]), {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const lat = interpolate(frame, frames, CAM.map((k) => k[2]), {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(frame, frames, CAM.map((k) => k[3]), {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Leichtes Atmen, damit nie ein Standbild entsteht.
  return { lon, lat, scale: scale * (1 + Math.sin(frame / 26) * 0.008) };
}

type Tag = {
  label: string;
  lon: number;
  lat: number;
  at: number;
  kind?: "community" | "creator";
};

const TAGS: Tag[] = [
  { label: "moin", lon: 13.4, lat: 52.5, at: 70 },
  { label: "re", lon: 23.7, lat: 38.0, at: 112 },
  { label: "yabai", lon: 139.7, lat: 35.7, at: 142 },
  { label: "mano", lon: -43.2, lat: -22.9, at: 162 },
  { label: "deadass", lon: -74.0, lat: 40.7, at: 336 },
  { label: "innit", lon: -0.13, lat: 51.5, at: 344 },
  { label: "wesh", lon: 2.35, lat: 48.85, at: 352 },
  { label: "chido", lon: -99.1, lat: 19.4, at: 358 },
  { label: "abi", lon: 28.98, lat: 41.0, at: 364 },
  { label: "wahala", lon: 3.4, lat: 6.5, at: 370 },
  { label: "bindaas", lon: 72.87, lat: 19.07, at: 376 },
  { label: "arvo", lon: 151.2, lat: -33.87, at: 382 },
  { label: "daebak", lon: 126.98, lat: 37.57, at: 388, kind: "creator" },
  { label: "shukran", lon: 55.27, lat: 25.2, at: 394 },
  { label: "che", lon: -58.4, lat: -34.6, at: 400 },
];

/** Der neue SlangTag, der im Spot live auf die Karte kommt. */
const NEW_TAG: Tag = { label: "digga", lon: 12.1, lat: 54.09, at: 262 };

const BEATS: { from: number; to: number; text: React.ReactNode; big?: boolean }[] = [
  {
    from: 0,
    to: 58,
    big: true,
    text: (
      <>
        Wir wollen diesen Globus
        <br />
        mit Slang füllen. <GlobeIcon size={58} />
      </>
    ),
  },
  { from: 62, to: 148, text: <>Jede Stadt hat ihren eigenen Slang.</> },
  {
    from: 154,
    to: 238,
    text: (
      <>
        Kennst du einen, den niemand
        <br />
        außerhalb deiner Stadt kennt?
      </>
    ),
  },
  { from: 244, to: 326, big: true, text: <>Dann bring ihn auf die Karte.</> },
  {
    from: 332,
    to: 418,
    big: true,
    text: (
      <>
        Hilf uns, den Globus zu füllen! <GlobeIcon size={62} />
      </>
    ),
  },
];

const Caption: React.FC<{
  frame: number;
  fps: number;
  beat: (typeof BEATS)[number];
}> = ({ frame, fps, beat }) => {
  const local = frame - beat.from;
  const inn = spring({ frame: local, fps, config: { damping: 16, stiffness: 170 } });
  const out = interpolate(frame, [beat.to - 8, beat.to], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const size = beat.big ? 92 : 76;

  return (
    <div
      style={{
        position: "absolute",
        left: 70,
        right: 70,
        top: 168,
        textAlign: "center",
        color: C.ink,
        fontSize: size,
        lineHeight: 1.1,
        fontWeight: 700,
        letterSpacing: -1.5,
        opacity: inn * out,
        transform: `translateY(${interpolate(inn, [0, 1], [42, 0])}px) scale(${interpolate(
          inn,
          [0, 1],
          [0.92, 1],
        )})`,
        textShadow: "0 8px 40px rgba(0,0,0,0.85), 0 0 70px rgba(0,0,0,0.7)",
      }}
    >
      {beat.text}
    </div>
  );
};

const AnchoredTag: React.FC<{
  tag: Tag;
  cam: Cam;
  frame: number;
  fps: number;
  playing?: boolean;
  emphasis?: number;
}> = ({ tag, cam, frame, fps, playing = false, emphasis = 0 }) => {
  const p = project(tag.lon, tag.lat, cam, CX, CY);
  if (!p) return null;
  const local = frame - tag.at;
  if (local < 0) return null;
  const pop = spring({ frame: local, fps, config: { damping: 13, stiffness: 190 } });
  const depth = interpolate(p.z, [0.02, 1], [0.35, 1]);
  const scale = (0.72 + emphasis * 0.75) * interpolate(pop, [0, 1], [0.6, 1]);
  const pulse = 1 + Math.sin(frame / 7) * 0.06 * (playing ? 1 : 0.35);

  return (
    <div
      style={{
        position: "absolute",
        left: p.x,
        top: p.y,
        transform: `translate(-50%,-100%) scale(${pulse})`,
        opacity: pop * depth,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: -14,
          width: 22,
          height: 22,
          marginLeft: -11,
          borderRadius: 999,
          background: C.green,
          boxShadow: `0 0 ${28 + emphasis * 40}px ${C.green}`,
        }}
      />
      <SlangChip
        label={tag.label}
        kind={tag.kind ?? "community"}
        frame={frame}
        playing={playing}
        scale={scale}
      />
    </div>
  );
};

export const SceneSpot: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cam = camAt(frame);

  const beat = BEATS.find((b) => frame >= b.from && frame < b.to);

  // 5–8 s: ein SlangTag wird prominent hervorgehoben und "abgespielt".
  const highlight = frame >= 168 && frame < 240;
  const highlightAmp = interpolate(frame, [168, 186, 226, 240], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 8–11 s: neuer Tag wird gesetzt (Ping-Ring + Chip).
  const ringLocal = frame - 252;
  const ring = interpolate(ringLocal, [0, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const newPoint = project(NEW_TAG.lon, NEW_TAG.lat, cam, CX, CY);

  // Letzte Sekunde: Endcard.
  const endIn = interpolate(frame, [426, 442], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: "#000000", overflow: "hidden" }}>
      <GlobeSvg cam={cam} width={W} height={H} cx={CX} cy={CY} />

      {/* Vignette: haelt die Texte lesbar, ohne den Globe zu verdecken. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 52%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.55) 78%, rgba(0,0,0,0.9) 100%)",
        }}
      />

      {TAGS.map((t) => (
        <AnchoredTag
          key={t.label}
          tag={t}
          cam={cam}
          frame={frame}
          fps={fps}
          playing={highlight && t.label === "mano"}
          emphasis={t.label === "mano" ? highlightAmp : 0}
        />
      ))}

      {/* Neuer SlangTag: Ping-Ring an der Zielposition */}
      {newPoint && ringLocal >= 0 && ringLocal < 40 && (
        <div
          style={{
            position: "absolute",
            left: newPoint.x,
            top: newPoint.y,
            width: 40 + ring * 360,
            height: 40 + ring * 360,
            marginLeft: -(20 + ring * 180),
            marginTop: -(20 + ring * 180),
            borderRadius: 999,
            border: `4px solid ${C.green}`,
            opacity: (1 - ring) * 0.9,
          }}
        />
      )}
      <AnchoredTag tag={NEW_TAG} cam={cam} frame={frame} fps={fps} emphasis={0.55} />

      {/* "+1" Bestaetigung beim Setzen */}
      {frame >= 268 && frame < 330 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 1500,
            textAlign: "center",
            color: C.green,
            fontSize: 60,
            fontWeight: 700,
            letterSpacing: 2,
            opacity: interpolate(frame, [268, 282, 318, 330], [0, 1, 1, 0]),
            transform: `translateY(${interpolate(frame, [268, 300], [24, -14], {
              extrapolateRight: "clamp",
            })}px)`,
          }}
        >
          + 1 SlangTag auf dem Globus
        </div>
      )}

      {beat && <Caption frame={frame} fps={fps} beat={beat} />}

      {/* Endcard: Logo-Lockup + Slogan */}
      <AbsoluteFill
        style={{
          background: "#000000",
          opacity: endIn,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {endIn > 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 54 }}>
            <BrandLockup
              frame={frame}
              appear={endIn}
              sloganAppear={endIn}
              markWidth={230}
              textHeight={132}
              energy={0.85}
            />
            <div
              style={{
                opacity: interpolate(frame, [436, 448], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
                color: C.ink,
                fontSize: 50,
                fontWeight: 600,
                letterSpacing: 3,
              }}
            >
              www.y-dude.com
            </div>
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
