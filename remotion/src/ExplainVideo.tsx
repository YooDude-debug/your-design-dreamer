import React from "react";
import { AbsoluteFill } from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { wipe } from "@remotion/transitions/wipe";
import { fade } from "@remotion/transitions/fade";

import { ExHook, ExExample, ExYDude, ExCta } from "./scenes/explain/scenes";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700", "800"],
  subsets: ["latin"],
});

const cut = springTiming({ config: { damping: 200 }, durationInFrames: 6 });

/**
 * "Kann Google Translate Sachsen?" – Humor-Short mit Y-Dude-Erklaerung.
 * 90 + 150 + 108 + 80 = 428 Frames minus 3 Uebergaenge a 6 = 410 (~13,7 s, 9:16).
 */
export const ExplainVideo: React.FC = () => (
  <AbsoluteFill style={{ background: "#000", fontFamily }}>
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={90}>
        <ExHook />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-bottom" })} timing={cut} />

      <TransitionSeries.Sequence durationInFrames={150}>
        <ExExample />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-right" })} timing={cut} />

      <TransitionSeries.Sequence durationInFrames={108}>
        <ExYDude />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={cut} />

      <TransitionSeries.Sequence durationInFrames={80}>
        <ExCta />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);
