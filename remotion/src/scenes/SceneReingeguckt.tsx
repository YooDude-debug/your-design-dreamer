import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile } from "remotion";
import { C } from "../theme";
import { SlangChip } from "../components/SlangChip";
import { LogoMark, WordmarkDude } from "../components/LogoLockup";

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

/**
 * „Reingeguckt“-Szene: ein einzelner echter Y-Dude-Feed-Post.
 * Motiv: schwarze Handschuh-Geste (Foto), unten der SlangTag, ein Finger
 * tippt ihn an – mit sichtbarem Tap-Ring.
 *
 * `local` = Frame relativ zum Szenenstart, `tapAt` = Frame des Antippens.
 */
export const SceneReingeguckt: React.FC<{
  local: number;
  tapAt: number;
  playing: boolean;
}> = ({ local, tapAt, playing }) => {
  const appear = interpolate(local, [0, 16], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const cardY = interpolate(appear, [0, 1], [70, 0]);
  const zoom = interpolate(local, [0, 26, 96], [1.04, 1, 1.03], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });

  // Finger fährt heran und tippt
  const fingerIn = interpolate(local, [8, tapAt - 4], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const press = interpolate(local, [tapAt - 3, tapAt, tapAt + 6], [0, 1, 0], { ...clamp });

  // Tap-Ringe
  const ring = (delay: number) => {
    const t = interpolate(local, [tapAt + delay, tapAt + delay + 20], [0, 1], clamp);
    return { scale: 0.5 + t * 1.5, opacity: (1 - t) * 0.75 };
  };

  const chipPulse = 1 + press * 0.06;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: 940,
          borderRadius: 40,
          background: C.card,
          border: `1px solid ${C.border}`,
          boxShadow: `0 60px 150px rgba(0,0,0,0.8), 0 0 90px ${C.green}1f`,
          overflow: "hidden",
          opacity: appear,
          transform: `translateY(${cardY}px) scale(${zoom}) rotate(-0.8deg)`,
        }}
      >
        {/* App-Header mit Original-Y-Dude-Branding */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 28px",
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <LogoMark width={54} energy={playing ? 0.85 : 0.15} frame={local} glow={0.3} />
            <WordmarkDude height={34} />
          </div>
          <div style={{ color: C.muted, fontSize: 26, letterSpacing: 6 }}>•••</div>
        </div>

        {/* Autor */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 28px" }}>
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 999,
              background: `linear-gradient(140deg, ${C.green}, ${C.cyan})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#04120b",
              fontWeight: 800,
              fontSize: 26,
            }}
          >
            J
          </div>
          <div style={{ lineHeight: 1.25 }}>
            <div style={{ color: C.ink, fontSize: 28, fontWeight: 600 }}>Jonte</div>
            <div style={{ color: C.muted, fontSize: 22 }}>@jonte · Berlin</div>
          </div>
        </div>

        {/* Motiv */}
        <div style={{ position: "relative" }}>
          <Img
            src={staticFile("images/peek-glove.jpg")}
            style={{ width: "100%", height: 900, objectFit: "cover", display: "block" }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0.62))",
            }}
          />

          {/* SlangTag + Tap-Effekt */}
          <div style={{ position: "absolute", left: 60, bottom: 64 }}>
            {[0, 6, 12].map((d) => {
              const r = ring(d);
              return (
                <div
                  key={d}
                  style={{
                    position: "absolute",
                    left: 26,
                    top: 12,
                    width: 300,
                    height: 92,
                    borderRadius: 999,
                    border: `3px solid ${C.green}`,
                    transform: `scale(${r.scale})`,
                    opacity: r.opacity,
                  }}
                />
              );
            })}
            <div
              style={{
                transform: `scale(${chipPulse})`,
                filter: `drop-shadow(0 0 ${26 + press * 40}px ${C.green}66)`,
              }}
            >
              <SlangChip label="Reingeguckt!" kind="community" frame={local} playing={playing} scale={1.05} />
            </div>
          </div>
        </div>

        {/* Engagement */}
        <div style={{ display: "flex", alignItems: "center", gap: 34, padding: "22px 30px" }}>
          <div style={{ color: C.green, fontSize: 26, fontWeight: 600 }}>♥ 201</div>
          <div style={{ color: C.muted, fontSize: 26 }}>💬 23</div>
          <div style={{ color: C.muted, fontSize: 26 }}>↗ 12</div>
        </div>
      </div>

      {/* Tippender Finger */}
      <Img
        src={staticFile("images/tap-finger.png")}
        style={{
          position: "absolute",
          left: 300,
          bottom: interpolate(fingerIn, [0, 1], [-620, -230]) + press * 22,
          width: 460,
          transform: `rotate(${interpolate(fingerIn, [0, 1], [16, 6])}deg)`,
          opacity: fingerIn,
          filter: "drop-shadow(0 30px 60px rgba(0,0,0,0.8))",
        }}
      />
    </AbsoluteFill>
  );
};
