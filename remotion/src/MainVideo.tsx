import React from "react";
import { AbsoluteFill } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { wipe } from "@remotion/transitions/wipe";
import { loadFont } from "@remotion/google-fonts/Outfit";
import { SceneFeed } from "./scenes/SceneFeed";
import { SceneSlang } from "./scenes/SceneSlang";
import { SceneConnect } from "./scenes/SceneConnect";
import { SceneEnd } from "./scenes/SceneEnd";

const { fontFamily } = loadFont("normal", { weights: ["400", "600", "700"], subsets: ["latin"] });

const timing = springTiming({ config: { damping: 200 }, durationInFrames: 14 });

export const MainVideo: React.FC = () => (
  <AbsoluteFill style={{ background: "#000", fontFamily }}>
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={185}>
        <SceneFeed />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-bottom" })} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={112}>
        <SceneSlang />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-left" })} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={118}>
        <SceneConnect />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={90}>
        <SceneEnd />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);
