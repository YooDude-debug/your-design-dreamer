import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";
import { C } from "./theme";
import {
  SceneImpulse,
  SceneVoice,
  SceneEarlyBird,
  SceneMoney,
  SceneCta,
} from "./scenes/creator/scenes";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "800"],
  subsets: ["latin"],
});

const UI_FONT = `${fontFamily}, sans-serif`;

/** Szenenlängen (30 fps): 2 s / 3 s / 3 s / 3 s / 4 s = 15 s. */
const SCENES: { from: number; dur: number; render: (p: { frame: number; fps: number }) => React.ReactNode }[] = [
  { from: 0, dur: 60, render: (p) => <SceneImpulse {...p} /> },
  { from: 60, dur: 90, render: (p) => <SceneVoice {...p} /> },
  { from: 150, dur: 90, render: (p) => <SceneEarlyBird {...p} /> },
  { from: 240, dur: 90, render: (p) => <SceneMoney {...p} /> },
  { from: 330, dur: 120, render: (p) => <SceneCta {...p} /> },
];

const Cut: React.FC<{ children: React.ReactNode; dur: number }> = ({ children, dur }) => {
  const frame = useCurrentFrame();
  // Schnelle, harte Übergänge mit 4-Frame-Blende – Social-Media-Schnitt.
  const opacity = interpolate(frame, [0, 4, dur - 4, dur], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

const SceneHost: React.FC<{
  dur: number;
  render: (p: { frame: number; fps: number }) => React.ReactNode;
}> = ({ dur, render }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <Cut dur={dur}>{render({ frame, fps })}</Cut>;
};

/**
 * "Deine Stimme. Deine Sprache. Dein Einkommen." – 15 s Creator-Promo (9:16).
 * Nutzt ausschliesslich bestehende Y-Dude-Bausteine (Logo, SlangChip, Waveform,
 * Feed-Screen, PhoneFrame, Farbtokens).
 */
export const CreatorVoiceVideo: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg, fontFamily: UI_FONT }}>
    {SCENES.map((s) => (
      <Sequence key={s.from} from={s.from} durationInFrames={s.dur}>
        <SceneHost dur={s.dur} render={s.render} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
