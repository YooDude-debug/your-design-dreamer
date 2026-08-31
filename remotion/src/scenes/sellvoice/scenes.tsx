import React from "react";
import { AbsoluteFill, interpolate, spring } from "remotion";
import { C } from "../../theme";
import { Waveform } from "../../components/Waveform";
import { SlangChip } from "../../components/SlangChip";
import { PhoneFrame } from "../../components/PhoneFrame";
import { BrandLockup } from "../../components/BrandLockup";
import { FeedScreen, SH, SW } from "../tour/screens";
import { Bg, Particles, Line } from "../creator/scenes";

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

/** Weiches, langsames Erscheinen – ruhiger als die harten Social-Cuts. */
const soft = (frame: number, start: number, dur = 22) => {
  const t = interpolate(frame - start, [0, dur], [0, 1], clamp);
  return 1 - Math.pow(1 - t, 3);
};

/** Ruhige, große Aussage – langsam eingeblendet, leicht atmend. */
const Statement: React.FC<{
  children: React.ReactNode;
  frame: number;
  start?: number;
  end?: number;
  top: number;
  size?: number;
  color?: string;
  weight?: number;
  letter?: number;
}> = ({ children, frame, start = 0, end, top, size = 88, color = C.ink, weight = 800, letter }) => {
  const e = soft(frame, start, 24);
  const out = end ? interpolate(frame, [end - 14, end], [1, 0], clamp) : 1;
  return (
    <div
      style={{
        position: "absolute",
        left: 86,
        right: 86,
        top,
        textAlign: "center",
        color,
        fontSize: size,
        fontWeight: weight,
        lineHeight: 1.08,
        letterSpacing: letter ?? -size * 0.028,
        opacity: e * out,
        transform: `translateY(${(1 - e) * 26}px)`,
        textShadow: "0 10px 50px rgba(0,0,0,0.85)",
      }}
    >
      {children}
    </div>
  );
};

/* ───────────── Szene 1 · 0–3 s · Die Stimme ───────────── */

export const SceneVoiceIntro: React.FC<{ frame: number; fps: number }> = ({ frame }) => {
  const breathe = 1 + Math.sin(frame / 26) * 0.015;
  return (
    <AbsoluteFill>
      <Bg frame={frame} strength={0.12} />
      <Particles frame={frame} count={14} />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 780,
          display: "flex",
          justifyContent: "center",
          opacity: soft(frame, 0, 30),
          transform: `scale(${breathe})`,
        }}
      >
        <Waveform frame={frame} bars={34} height={190} width={9} color={C.green} active />
      </div>

      <Statement frame={frame} start={6} end={38} top={430} size={86}>
        Du hast eine <span style={{ color: C.green }}>Stimme.</span>
      </Statement>
      <Statement frame={frame} start={38} end={66} top={430} size={86}>
        Eine <span style={{ color: C.green }}>Sprache.</span>
      </Statement>
      <Statement frame={frame} start={66} top={430} size={86}>
        Eine <span style={{ color: C.green }}>Community.</span>
      </Statement>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 1180,
          textAlign: "center",
          color: C.muted,
          fontSize: 34,
          fontWeight: 600,
          letterSpacing: 6,
          textTransform: "uppercase",
          opacity: soft(frame, 20, 30) * 0.9,
        }}
      >
        Y-Dude
      </div>
    </AbsoluteFill>
  );
};

/* ───────────── Szene 2 · 3–6,5 s · Die Idee ───────────── */

export const SceneSellVoice: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const morph = interpolate(frame, [0, 34], [0, 1], clamp);
  const chip = spring({ frame: frame - 22, fps, config: { damping: 20 } });

  return (
    <AbsoluteFill>
      <Bg frame={frame} strength={0.16} />
      <Particles frame={frame} count={16} />

      {/* Wellenform entwickelt sich zum Y-Dude-Content-Element */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 430,
          display: "flex",
          justifyContent: "center",
          opacity: interpolate(morph, [0, 0.75], [1, 0.25], clamp),
          transform: `scale(${interpolate(morph, [0, 1], [1, 0.78])})`,
        }}
      >
        <Waveform frame={frame} bars={30} height={150} width={9} color={C.green} active />
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 470,
          display: "flex",
          justifyContent: "center",
          opacity: chip,
          transform: `scale(${interpolate(chip, [0, 1], [0.86, 1])})`,
        }}
      >
        <SlangChip label="moin-vibe" kind="creator" frame={frame} playing scale={1.5} meta="Hamburg · DE" />
      </div>

      <Statement frame={frame} start={30} top={880} size={112} letter={-4}>
        Verkaufe
        <br />
        deine <span style={{ color: C.green }}>Stimme.</span>
      </Statement>

      <Statement
        frame={frame}
        start={58}
        top={1240}
        size={40}
        weight={600}
        color={C.muted}
        letter={0}
      >
        Exklusiv für deine Community auf Y-Dude.
      </Statement>
    </AbsoluteFill>
  );
};

/* ───────────── Szene 3 · 6,5–11 s · Der Unterschied ───────────── */

const METRICS = [
  { label: "Impressionen", value: 128400 },
  { label: "Views", value: 41200 },
  { label: "Likes", value: 3180 },
];

export const SceneDifference: React.FC<{ frame: number; fps: number }> = ({ frame }) => {
  const fade = interpolate(frame, [46, 66], [1, 0], clamp);

  return (
    <AbsoluteFill>
      <Bg frame={frame} strength={0.14} />

      <div
        style={{
          position: "absolute",
          left: 110,
          right: 110,
          top: 330,
          display: "flex",
          flexDirection: "column",
          gap: 24,
          opacity: fade,
        }}
      >
        {METRICS.map((m, i) => {
          const t = interpolate(frame - i * 8, [0, 26], [0, 1], clamp);
          const shown = Math.round(m.value * (1 - Math.pow(1 - t, 3)));
          return (
            <div
              key={m.label}
              style={{
                borderRadius: 34,
                padding: "30px 38px",
                background: "rgba(12,14,13,0.78)",
                border: `1px solid ${C.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                opacity: soft(frame, i * 8, 18),
              }}
            >
              <span style={{ color: C.muted, fontSize: 38, fontWeight: 600 }}>{m.label}</span>
              <span
                style={{
                  color: "rgba(247,251,250,0.55)",
                  fontSize: 56,
                  fontWeight: 800,
                  letterSpacing: -1,
                }}
              >
                {shown.toLocaleString("de-DE")}
              </span>
            </div>
          );
        })}
      </div>

      <Statement frame={frame} start={60} end={94} top={780} size={96} letter={-3}>
        Verdiene <span style={{ color: C.muted }}>nicht</span>
        <br />
        mit Impressionen.
      </Statement>

      <Statement frame={frame} start={94} top={760} size={98} letter={-3}>
        Verdiene mit deinen
        <br />
        <span style={{ color: C.green }}>Creator-Abos.</span>
      </Statement>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 1240,
          display: "flex",
          justifyContent: "center",
          opacity: soft(frame, 100, 26),
        }}
      >
        <Waveform frame={frame} bars={26} height={110} width={9} color={C.green} active />
      </div>
    </AbsoluteFill>
  );
};

/* ───────────── Szene 4 · 11–14 s · Creator-Modell ───────────── */

const FLOW = [
  { label: "Community", note: "Menschen, die dir folgen" },
  { label: "Creator-Abo", note: "sie abonnieren dich" },
  { label: "Monatlicher Drop", note: "exklusive SlangTags" },
  { label: "Creator-Einnahmen", note: "direkt von deiner Community" },
];

export const SceneModel: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => (
  <AbsoluteFill>
    <Bg frame={frame} strength={0.18} />

    <Statement frame={frame} start={0} top={190} size={62} weight={800}>
      So funktioniert es.
    </Statement>

    <div
      style={{
        position: "absolute",
        left: 96,
        right: 96,
        top: 360,
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      {FLOW.map((s, i) => {
        const at = 8 + i * 14;
        const pop = spring({ frame: frame - at, fps, config: { damping: 22 } });
        const last = i === FLOW.length - 1;
        return (
          <React.Fragment key={s.label}>
            <div
              style={{
                opacity: pop,
                transform: `translateY(${interpolate(pop, [0, 1], [24, 0])}px)`,
                borderRadius: 32,
                padding: "28px 34px",
                background: last ? "rgba(47,240,140,0.10)" : "rgba(12,14,13,0.8)",
                border: `1px solid ${last ? `${C.green}88` : C.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 18,
              }}
            >
              <div>
                <div
                  style={{
                    color: last ? C.green : C.ink,
                    fontSize: 46,
                    fontWeight: 800,
                    letterSpacing: -1,
                  }}
                >
                  {s.label}
                </div>
                <div style={{ color: C.muted, fontSize: 26, marginTop: 6 }}>{s.note}</div>
              </div>
              <Waveform
                frame={frame + i * 6}
                bars={9}
                height={42}
                width={5}
                color={last ? C.green : `${C.green}88`}
                active
              />
            </div>
            {!last && (
              <div
                style={{
                  textAlign: "center",
                  color: `${C.green}cc`,
                  fontSize: 34,
                  opacity: interpolate(frame - at, [8, 18], [0, 1], clamp),
                }}
              >
                ↓
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>

    <Statement
      frame={frame}
      start={66}
      top={1520}
      size={40}
      weight={600}
      color={C.muted}
      letter={0}
    >
      Deine Community unterstützt dich direkt.
    </Statement>
  </AbsoluteFill>
);

/* ───────────── Szene 5 · 14–17 s · Early Bird ───────────── */

export const SceneEarly: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const count = Math.round(interpolate(frame, [4, 40], [1, 10], clamp));
  const glow = interpolate(frame, [40, 58], [0, 1], clamp);
  const badge = spring({ frame: frame - 44, fps, config: { damping: 22 } });

  return (
    <AbsoluteFill>
      <Bg frame={frame} strength={0.14 + glow * 0.12} />
      <Particles frame={frame} count={18} />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 620,
          textAlign: "center",
          color: C.green,
          fontSize: 250,
          fontWeight: 800,
          lineHeight: 1,
          textShadow: `0 0 ${60 + glow * 60}px ${C.green}55`,
          opacity: soft(frame, 0, 20),
        }}
      >
        {count}
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 900,
          textAlign: "center",
          color: C.ink,
          fontSize: 46,
          fontWeight: 700,
          letterSpacing: 4,
          textTransform: "uppercase",
          opacity: soft(frame, 4, 20),
        }}
      >
        Follower
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 1060,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          opacity: badge,
          transform: `translateY(${interpolate(badge, [0, 1], [26, 0])}px)`,
        }}
      >
        <div
          style={{
            padding: "20px 46px",
            borderRadius: 999,
            border: `1.5px solid ${C.green}`,
            color: C.green,
            fontSize: 56,
            fontWeight: 800,
            background: "rgba(47,240,140,0.08)",
          }}
        >
          Creator Status
        </div>
        <div
          style={{
            color: C.ink,
            fontSize: 40,
            fontWeight: 700,
            letterSpacing: 6,
            textTransform: "uppercase",
          }}
        >
          Early Bird
        </div>
      </div>

      <Statement
        frame={frame}
        start={62}
        top={1400}
        size={52}
        weight={700}
        color={C.ink}
        letter={-1}
      >
        Starte früh.
        <br />
        <span style={{ color: C.green }}>Wachse mit deiner Community.</span>
      </Statement>
    </AbsoluteFill>
  );
};

/* ───────────── Szene 6 · 17–20 s · Finale ───────────── */

export const SceneFinale: React.FC<{ frame: number; fps: number }> = ({ frame }) => {
  const lock = soft(frame, 62, 30);

  return (
    <AbsoluteFill>
      <Bg frame={frame} strength={0.2} />
      <Particles frame={frame} count={20} />

      <div
        style={{
          position: "absolute",
          left: 70,
          right: 70,
          top: 300,
          textAlign: "center",
          color: C.ink,
          fontSize: 92,
          fontWeight: 800,
          lineHeight: 1.14,
          letterSpacing: -3,
        }}
      >
        <div style={{ opacity: soft(frame, 0, 20) }}>DEINE STIMME.</div>
        <div style={{ opacity: soft(frame, 18, 20) }}>DEINE COMMUNITY.</div>
        <div style={{ opacity: soft(frame, 36, 20), color: C.green }}>DEIN CREATOR-ABO.</div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 720,
          display: "flex",
          justifyContent: "center",
          opacity: soft(frame, 44, 24),
        }}
      >
        <Waveform frame={frame} bars={28} height={90} width={8} color={C.green} active />
      </div>

      <div
        style={{
          position: "absolute",
          left: 60,
          right: 60,
          top: 880,
          textAlign: "center",
          color: C.muted,
          fontSize: 40,
          fontWeight: 600,
          opacity: soft(frame, 50, 24),
        }}
      >
        Y-Dude – Sprache wird zur Community.
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 1010,
          display: "flex",
          justifyContent: "center",
          opacity: soft(frame, 56, 24),
        }}
      >
        <div
          style={{
            padding: "26px 58px",
            borderRadius: 999,
            background: C.green,
            color: "#04150c",
            fontSize: 58,
            fontWeight: 800,
            boxShadow: `0 0 80px ${C.green}44`,
            transform: `scale(${1 + Math.sin(frame / 14) * 0.012})`,
          }}
        >
          Werde Creator.
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 1380,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 36,
          opacity: lock,
        }}
      >
        <BrandLockup
          frame={frame}
          appear={lock}
          sloganAppear={lock}
          markWidth={210}
          textHeight={118}
          energy={0.7}
        />
        <div style={{ color: C.ink, fontSize: 40, fontWeight: 600, letterSpacing: 3 }}>
          www.y-dude.com
        </div>
      </div>
    </AbsoluteFill>
  );
};

export { PhoneFrame, FeedScreen, SH, SW };
