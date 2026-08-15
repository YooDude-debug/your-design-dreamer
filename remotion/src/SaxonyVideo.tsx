import React from "react";
import { AbsoluteFill } from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { wipe } from "@remotion/transitions/wipe";
import { fade } from "@remotion/transitions/fade";

import { SaxHook, SaxOrder, SaxReaction, SaxSecond, SaxEnd } from "./scenes/saxony/scenes";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700", "800"],
  subsets: ["latin"],
});

const cut = springTiming({ config: { damping: 200 }, durationInFrames: 6 });

/**
 * "Google Translate gegen Sachsen" – Comedy-Short (9:16, ~11,9 s).
 * 40+100+74+96+70 = 380 Frames minus 4 Uebergaenge a 6 = 356.
 */
export const SaxonyVideo: React.FC = () => (
  <AbsoluteFill style={{ background: "#000", fontFamily }}>
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={40}>
        <SaxHook />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-bottom" })} timing={cut} />

      <TransitionSeries.Sequence durationInFrames={100}>
        <SaxOrder />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-right" })} timing={cut} />

      <TransitionSeries.Sequence durationInFrames={74}>
        <SaxReaction />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-left" })} timing={cut} />

      <TransitionSeries.Sequence durationInFrames={96}>
        <SaxSecond />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={cut} />

      <TransitionSeries.Sequence durationInFrames={70}>
        <SaxEnd />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);
