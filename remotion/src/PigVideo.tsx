import React from "react";
import { AbsoluteFill } from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { wipe } from "@remotion/transitions/wipe";
import { fade } from "@remotion/transitions/fade";

import { PigHook, PigOriginal, PigLiteral, PigMeaning, PigEnd } from "./scenes/pig/scenes";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700", "800"],
  subsets: ["latin"],
});

const cut = springTiming({ config: { damping: 200 }, durationInFrames: 8 });

/**
 * "Mein Schwein pfeift" – Sprach-Meme-Short (9:16, ~15,9 s).
 * 90+90+120+120+90 = 510 Frames minus 4 Uebergaenge a 8 = 478.
 */
export const PigVideo: React.FC = () => (
  <AbsoluteFill style={{ background: "#000", fontFamily }}>
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={90}>
        <PigHook />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-bottom" })} timing={cut} />

      <TransitionSeries.Sequence durationInFrames={90}>
        <PigOriginal />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-right" })} timing={cut} />

      <TransitionSeries.Sequence durationInFrames={120}>
        <PigLiteral />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-left" })} timing={cut} />

      <TransitionSeries.Sequence durationInFrames={120}>
        <PigMeaning />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={cut} />

      <TransitionSeries.Sequence durationInFrames={90}>
        <PigEnd />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);
