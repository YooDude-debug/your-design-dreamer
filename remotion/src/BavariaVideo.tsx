import React from "react";
import { AbsoluteFill } from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { wipe } from "@remotion/transitions/wipe";
import { fade } from "@remotion/transitions/fade";

import { BavHook, BavLiteral, BavMeaning, BavEnd } from "./scenes/bavaria/scenes";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700", "800"],
  subsets: ["latin"],
});

const cut = springTiming({ config: { damping: 200 }, durationInFrames: 8 });

/**
 * "Schau ma moi" – bayerischer Sprach-Meme-Short (9:16, ~14,5 s).
 * 84+130+110+84 = 408 Frames minus 3 Uebergaenge a 8 = 384.
 */
export const BavariaVideo: React.FC = () => (
  <AbsoluteFill style={{ background: "#000", fontFamily }}>
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={84}>
        <BavHook />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-bottom" })} timing={cut} />

      <TransitionSeries.Sequence durationInFrames={130}>
        <BavLiteral />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-right" })} timing={cut} />

      <TransitionSeries.Sequence durationInFrames={110}>
        <BavMeaning />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={cut} />

      <TransitionSeries.Sequence durationInFrames={84}>
        <BavEnd />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);
