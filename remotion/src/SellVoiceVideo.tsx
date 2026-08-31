import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";
import { C } from "./theme";
import {
  SceneVoiceIntro,
  SceneSellVoice,
  SceneDifference,
  SceneModel,
  SceneEarly,
  SceneFinale,
} from "./scenes/sellvoice/scenes";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "800"],
  subsets: ["latin"],
});

const UI_FONT = `${fontFamily}, sans-serif`;

/** 6 Szenen à 3–4,5 s = 600 Frames (20 s). Ruhige, lange Überblendungen. */
const SCENES: {
  from: number;
  dur: number;
  render: (p: { frame: number; fps: number }) => React.ReactNode;
}[] = [
  { from: 0, dur: 96, render: (p) => <SceneVoiceIntro {...p} /> },
  { from: 96, dur: 100, render: (p) => <SceneSellVoice {...p} /> },
  { from: 196, dur: 136, render: (p) => <SceneDifference {...p} /> },
  { from: 332, dur: 92, render: (p) => <SceneModel {...p} /> },
  { from: 424, dur: 92, render: (p) => <SceneEarly {...p} /> },
  { from: 516, dur: 84, render: (p) => <SceneFinale {...p} /> },
];

const Dissolve: React.FC<{ children: React.ReactNode; dur: number }> = ({ children, dur }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 14, dur - 14, dur], [0, 1, 1, 0], {
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
  return <Dissolve dur={dur}>{render({ frame, fps })}</Dissolve>;
};

/**
 * "Verkaufe deine Stimme." – 20 s Creator-Promo (9:16) für TikTok, Reels, Shorts.
 * Ruhig, hochwertig, emotional; ausschliesslich bestehende Y-Dude-Bausteine.
 */
export const SellVoiceVideo: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg, fontFamily: UI_FONT }}>
    {SCENES.map((s) => (
      <Sequence key={s.from} from={s.from} durationInFrames={s.dur}>
        <SceneHost dur={s.dur} render={s.render} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
