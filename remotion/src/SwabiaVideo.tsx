import React from "react";
import { AbsoluteFill } from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { wipe } from "@remotion/transitions/wipe";
import { fade } from "@remotion/transitions/fade";

import { SwHook, SwWhat, SwClear, SwEnd } from "./scenes/swabia/scenes";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700", "800"],
  subsets: ["latin"],
});

const cut = springTiming({ config: { damping: 200 }, durationInFrames: 6 });

/**
 * "Schwäbisch" – Community-Short (9:16, exakt 9 s).
 * 64+94+64+66 = 288 Frames minus 3 Uebergaenge a 6 = 270 = 9 s @ 30fps.
 */
export const SwabiaVideo: React.FC = () => (
  <AbsoluteFill style={{ background: "#000", fontFamily }}>
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={64}>
        <SwHook />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-bottom" })} timing={cut} />

      <TransitionSeries.Sequence durationInFrames={94}>
        <SwWhat />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-right" })} timing={cut} />

      <TransitionSeries.Sequence durationInFrames={64}>
        <SwClear />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={cut} />

      <TransitionSeries.Sequence durationInFrames={66}>
        <SwEnd />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);
