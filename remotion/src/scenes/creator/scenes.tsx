import React from "react";
import { AbsoluteFill, interpolate, spring } from "remotion";
import { C } from "../../theme";
import { Waveform } from "../../components/Waveform";
import { SlangChip } from "../../components/SlangChip";
import { PhoneFrame } from "../../components/PhoneFrame";
import { BrandLockup } from "../../components/BrandLockup";
import { LogoMark, MARK_H, MARK_W, WordmarkDude } from "../../components/LogoLockup";
import { FeedScreen, SH, SW } from "../tour/screens";

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

/** Dezenter Y-Dude-Grund: nie reines Schwarz, immer leichte Bewegung. */
export const Bg: React.FC<{ frame: number; strength?: number }> = ({ frame, strength = 0.15 }) => (
  <>
    <AbsoluteFill
      style={{ background: "linear-gradient(180deg, #050706 0%, #000 55%, #040806 100%)" }}
    />
    <div
      style={{
        position: "absolute",
        left: -240 + Math.sin(frame / 38) * 44,
        top: 180 + Math.cos(frame / 31) * 50,
        width: 1560,
        height: 1480,
        background: `radial-gradient(circle at 50% 50%, rgba(47,240,140,${strength}) 0%, rgba(47,240,140,0.04) 42%, rgba(0,0,0,0) 70%)`,
      }}
    />
  </>
);

/** Dezente Partikel im Markengrün. */
export const Particles: React.FC<{ frame: number; count?: number }> = ({ frame, count = 26 }) => (
  <>
    {new Array(count).fill(0).map((_, i) => {
      const seed = (i * 97) % 61;
      const x = 40 + ((seed * 137) % 1000);
      const speed = 0.7 + (seed % 7) * 0.22;
      const y = 1900 - ((frame * speed * 8 + seed * 130) % 2100);
      const s = 3 + (seed % 4);
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: x,
            top: y,
            width: s,
            height: s,
            borderRadius: 999,
            background: C.green,
            opacity: 0.1 + ((seed % 5) / 5) * 0.28,
          }}
        />
      );
    })}
  </>
);

export const Line: React.FC<{
  children: React.ReactNode;
  frame: number;
  start?: number;
  end?: number;
  size?: number;
  color?: string;
  weight?: number;
  top: number;
  align?: "center" | "left";
  letter?: number;
}> = ({
  children,
  frame,
  start = 0,
  end,
  size = 82,
  color = C.ink,
  weight = 800,
  top,
  align = "center",
  letter,
}) => {
  const t = interpolate(frame - start, [0, 11], [0, 1], clamp);
  const e = 1 - Math.pow(1 - t, 3);
  const out = end ? interpolate(frame, [end - 8, end], [1, 0], clamp) : 1;
  return (
    <div
      style={{
        position: "absolute",
        left: 72,
        right: 72,
        top,
        textAlign: align,
        color,
        fontSize: size,
        fontWeight: weight,
        lineHeight: 1.06,
        letterSpacing: letter ?? -size * 0.03,
        opacity: e * out,
        transform: `translateY(${(1 - e) * 44}px)`,
        textShadow: "0 8px 40px rgba(0,0,0,0.85)",
      }}
    >
      {children}
    </div>
  );
};

/* ───────────── Szene 1 · 0–2 s · Social-Impulse ───────────── */

const IMPULSES = [
  { platform: "YouTube", sub: "Deine Videos.", at: 0, x: -300, y: -560 },
  { platform: "TikTok", sub: "Deine Community.", at: 12, x: 300, y: -300 },
  { platform: "Instagram", sub: "Deine Stimme.", at: 24, x: 250, y: 420 },
];

export const SceneImpulse: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const pull = interpolate(frame, [32, 58], [0, 1], clamp);
  const markPop = spring({ frame: frame - 26, fps, config: { damping: 14, stiffness: 180 } });

  return (
    <AbsoluteFill>
      <Bg frame={frame} strength={0.2} />
      <Particles frame={frame} />

      {IMPULSES.map((it) => {
        const pop = spring({ frame: frame - it.at, fps, config: { damping: 13, stiffness: 210 } });
        const dx = it.x * (1 - pull);
        const dy = it.y * (1 - pull);
        return (
          <div
            key={it.platform}
            style={{
              position: "absolute",
              left: 540 + dx,
              top: 900 + dy,
              transform: `translate(-50%,-50%) scale(${interpolate(pop, [0, 1], [0.7, 1]) * (1 - pull * 0.45)})`,
              opacity: pop * (1 - pull * 0.85),
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                padding: "18px 34px",
                borderRadius: 999,
                background: "rgba(12,14,13,0.7)",
                border: `2px solid ${C.green}55`,
                boxShadow: `0 0 60px ${C.green}33`,
                color: C.ink,
                fontSize: 46,
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              {it.platform}
            </div>
            <div style={{ color: C.green, fontSize: 40, fontWeight: 700 }}>{it.sub}</div>
          </div>
        );
      })}

      {/* Zielpunkt: die echte Y-Dude-Bildmarke */}
      <div
        style={{
          position: "absolute",
          left: 540,
          top: 900,
          transform: `translate(-50%,-50%) scale(${interpolate(markPop, [0, 1], [0.6, 1]) * (1 + pull * 0.14)})`,
          opacity: markPop,
          display: "flex",
          alignItems: "center",
          gap: 22,
        }}
      >
        <LogoMark width={230} energy={0.9} frame={frame} glow={0.5} />
        <WordmarkDude height={122} style={{ marginTop: (230 / MARK_W) * MARK_H * 0.02 }} />
      </div>

      <Line frame={frame} start={38} top={1420} size={70}>
        Bring deine Stimme
        <br />
        <span style={{ color: C.green }}>zu Y-Dude.</span>
      </Line>
    </AbsoluteFill>
  );
};

/* ───────────── Szene 2 · 2–5 s · Stimme kommt zu Y-Dude ───────────── */

export const SceneVoice: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const inn = spring({ frame, fps, config: { damping: 18, stiffness: 120 } });
  const scale = 0.52;

  return (
    <AbsoluteFill>
      <Bg frame={frame} />
      <Particles frame={frame} count={18} />

      <div
        style={{
          position: "absolute",
          left: 540,
          top: 1080,
          transform: `translate(-50%,-50%) scale(${scale * interpolate(inn, [0, 1], [0.92, 1])}) `,
          opacity: inn,
        }}
      >
        <PhoneFrame width={SW + 24} height={SH + 24}>
          <FeedScreen frame={frame + 10} />
        </PhoneFrame>
      </div>

      {/* Bestehendes SlangTag-Element als Held der Szene */}
      <div
        style={{
          position: "absolute",
          left: 540,
          top: 1180,
          transform: `translate(-50%,-50%) scale(${interpolate(
            spring({ frame: frame - 14, fps, config: { damping: 12, stiffness: 190 } }),
            [0, 1],
            [0.6, 1],
          )})`,
        }}
      >
        <SlangChip
          label="deine-stimme"
          kind="creator"
          frame={frame}
          playing
          scale={1.5}
          meta="Creator · Audio"
        />
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 1420,
          display: "flex",
          justifyContent: "center",
          opacity: interpolate(frame, [16, 28], [0, 1], clamp),
        }}
      >
        <Waveform frame={frame} bars={38} height={120} width={8} color={C.green} active />
      </div>

      <Line frame={frame} start={4} end={52} top={230} size={86}>
        Mach aus deiner
        <br />
        Stimme <span style={{ color: C.green }}>mehr.</span>
      </Line>
      <Line frame={frame} start={56} top={230} size={86}>
        <span style={{ color: C.green }}>Exklusiv</span> auf Y-Dude.
      </Line>
    </AbsoluteFill>
  );
};

/* ───────────── Szene 3 · 5–8 s · Early-Bird-Creator ───────────── */

export const SceneEarlyBird: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const followers = frame < 14 ? 1 : frame < 28 ? 5 : 10;
  const bump = spring({
    frame: frame - (followers === 1 ? 0 : followers === 5 ? 14 : 28),
    fps,
    config: { damping: 11, stiffness: 220 },
  });
  const unlocked = frame >= 34;
  const unlock = spring({ frame: frame - 34, fps, config: { damping: 12, stiffness: 170 } });
  const progress = interpolate(followers, [1, 5, 10], [0.1, 0.5, 1]);

  return (
    <AbsoluteFill>
      <Bg frame={frame} strength={unlocked ? 0.26 : 0.14} />
      <Particles frame={frame} count={20} />

      <Line frame={frame} start={0} top={210} size={70}>
        Dein Profil. <span style={{ color: C.green }}>Deine Reichweite.</span>
      </Line>

      {/* Profil-/Creator-Karte im bestehenden Y-Dude-Kartenstil */}
      <div
        style={{
          position: "absolute",
          left: 90,
          right: 90,
          top: 520,
          borderRadius: 46,
          background: "rgba(12,14,13,0.82)",
          border: `1px solid ${unlocked ? `${C.green}88` : C.border}`,
          boxShadow: unlocked ? `0 0 90px ${C.green}33` : "0 40px 90px rgba(0,0,0,0.6)",
          padding: 48,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
          <div
            style={{
              width: 132,
              height: 132,
              borderRadius: 999,
              background: "linear-gradient(160deg, #2ff08c, #0f7f4c)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 62,
              fontWeight: 800,
              color: "#04150c",
            }}
          >
            L
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: C.ink, fontSize: 52, fontWeight: 800 }}>@lena</div>
            <div style={{ color: C.muted, fontSize: 32, marginTop: 6 }}>Rostock · DE</div>
          </div>
          <div
            style={{
              padding: "12px 22px",
              borderRadius: 999,
              border: `1px solid ${unlocked ? C.green : C.border}`,
              color: unlocked ? C.green : C.muted,
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            {unlocked ? "Creator" : "Community"}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 26, marginTop: 52 }}>
          <div
            style={{
              color: C.green,
              fontSize: 150,
              fontWeight: 800,
              lineHeight: 1,
              transform: `scale(${interpolate(bump, [0, 1], [1.35, 1])})`,
              transformOrigin: "left bottom",
            }}
          >
            {followers}
          </div>
          <div style={{ color: C.ink, fontSize: 44, fontWeight: 700, paddingBottom: 14 }}>
            Follower
          </div>
        </div>

        <div
          style={{
            marginTop: 34,
            height: 22,
            borderRadius: 999,
            background: "rgba(255,255,255,0.07)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progress * 100}%`,
              height: "100%",
              borderRadius: 999,
              background: `linear-gradient(90deg, ${C.green}, ${C.greenSoft})`,
            }}
          />
        </div>
        <div style={{ marginTop: 18, color: C.muted, fontSize: 30, fontWeight: 600 }}>
          Early Bird: ab 10 Followern Creator
        </div>
      </div>

      {unlocked && (
        <>
          <div
            style={{
              position: "absolute",
              left: 60,
              right: 60,
              top: 1330,
              textAlign: "center",
              color: C.green,
              fontSize: 84,
              fontWeight: 800,
              letterSpacing: -1,
              opacity: unlock,
              transform: `scale(${interpolate(unlock, [0, 1], [0.82, 1])})`,
              textShadow: `0 0 70px ${C.green}66`,
            }}
          >
            CREATOR STATUS
            <br />
            UNLOCKED
          </div>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 1560,
              textAlign: "center",
              color: C.ink,
              fontSize: 46,
              fontWeight: 700,
              letterSpacing: 4,
              textTransform: "uppercase",
              opacity: interpolate(frame, [44, 56], [0, 1], clamp),
            }}
          >
            Early Bird Phase
          </div>
        </>
      )}
    </AbsoluteFill>
  );
};

/* ───────────── Szene 4 · 8–11 s · Monetarisierung ───────────── */

const STEPS = [
  { label: "Follower", note: "deine Community", at: 0 },
  { label: "Abo", note: "2,99 € – 99,99 €", at: 12 },
  { label: "Monatlicher Drop", note: "exklusive SlangTags", at: 24 },
  { label: "Du verdienst mit", note: "mit deiner Stimme", at: 36 },
];

export const SceneMoney: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => (
  <AbsoluteFill>
    <Bg frame={frame} strength={0.18} />
    <Particles frame={frame} count={20} />

    <Line frame={frame} start={0} end={54} top={200} size={84}>
      Deine Stimme wird
      <br />
      zum <span style={{ color: C.green }}>Abo.</span>
    </Line>
    <Line frame={frame} start={58} top={200} size={68}>
      Monatliche Drops.
      <br />
      <span style={{ color: C.green }}>Direkte Community.</span>
    </Line>

    <div
      style={{
        position: "absolute",
        left: 110,
        right: 110,
        top: 560,
        display: "flex",
        flexDirection: "column",
        gap: 22,
      }}
    >
      {STEPS.map((s, i) => {
        const pop = spring({ frame: frame - s.at, fps, config: { damping: 14, stiffness: 190 } });
        const last = i === STEPS.length - 1;
        return (
          <React.Fragment key={s.label}>
            <div
              style={{
                opacity: pop,
                transform: `translateX(${interpolate(pop, [0, 1], [-40, 0])}px)`,
                borderRadius: 34,
                padding: "30px 36px",
                background: last ? "rgba(47,240,140,0.12)" : "rgba(12,14,13,0.8)",
                border: `1px solid ${last ? `${C.green}99` : C.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 20,
              }}
            >
              <div>
                <div
                  style={{
                    color: last ? C.green : C.ink,
                    fontSize: 52,
                    fontWeight: 800,
                    letterSpacing: -1,
                  }}
                >
                  {s.label}
                </div>
                <div style={{ color: C.muted, fontSize: 28, marginTop: 6 }}>{s.note}</div>
              </div>
              <Waveform
                frame={frame + i * 7}
                bars={12}
                height={54}
                width={6}
                color={last ? C.green : `${C.green}aa`}
                active
              />
            </div>
            {!last && (
              <div
                style={{
                  textAlign: "center",
                  color: C.green,
                  fontSize: 44,
                  opacity: interpolate(frame - s.at, [6, 14], [0, 1], clamp),
                }}
              >
                ↓
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  </AbsoluteFill>
);

/* ───────────── Szene 5 · 11–15 s · Call to Action ───────────── */

export const SceneCta: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const inn = spring({ frame, fps, config: { damping: 16, stiffness: 150 } });
  const lock = interpolate(frame, [46, 66], [0, 1], clamp);

  return (
    <AbsoluteFill>
      <Bg frame={frame} strength={0.24} />
      <Particles frame={frame} count={28} />

      <div
        style={{
          position: "absolute",
          left: 70,
          right: 70,
          top: 320,
          textAlign: "center",
          color: C.ink,
          fontSize: 104,
          fontWeight: 800,
          lineHeight: 1.04,
          letterSpacing: -3,
          opacity: inn,
          transform: `translateY(${interpolate(inn, [0, 1], [40, 0])}px)`,
        }}
      >
        DEINE STIMME.
        <br />
        DEIN SLANG.
        <br />
        <span style={{ color: C.green }}>DEIN Y-DUDE.</span>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 760,
          display: "flex",
          justifyContent: "center",
          opacity: interpolate(frame, [12, 24], [0, 1], clamp),
        }}
      >
        <Waveform frame={frame} bars={30} height={90} width={8} color={C.green} active />
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 950,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 22,
          opacity: interpolate(frame, [20, 34], [0, 1], clamp),
        }}
      >
        <div
          style={{
            padding: "28px 56px",
            borderRadius: 999,
            background: C.green,
            color: "#04150c",
            fontSize: 62,
            fontWeight: 800,
            boxShadow: `0 0 90px ${C.green}55`,
            transform: `scale(${1 + Math.sin(frame / 9) * 0.02})`,
          }}
        >
          Werde Creator.
        </div>
        <div style={{ color: C.ink, fontSize: 40, fontWeight: 700 }}>
          Early Bird: ab 10 Followern.
        </div>
        <div style={{ color: C.muted, fontSize: 34, fontWeight: 600, textAlign: "center" }}>
          Monetarisier deine Stimme
          <br />
          mit monatlichen Drops.
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 1440,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 40,
          opacity: lock,
        }}
      >
        <BrandLockup
          frame={frame}
          appear={lock}
          sloganAppear={lock}
          markWidth={210}
          textHeight={118}
          energy={0.9}
        />
        <div style={{ color: C.ink, fontSize: 42, fontWeight: 600, letterSpacing: 3 }}>
          www.y-dude.com
        </div>
      </div>
    </AbsoluteFill>
  );
};
