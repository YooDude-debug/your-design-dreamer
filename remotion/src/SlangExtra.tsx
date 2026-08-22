import React from "react";
import { AbsoluteFill } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { wipe } from "@remotion/transitions/wipe";
import { loadFont } from "@remotion/google-fonts/Outfit";
import { SceneSlangFeedRoll } from "./scenes/SceneSlangFeedRoll";
import { SceneSlangPlay } from "./scenes/SceneSlangPlay";

const { fontFamily } = loadFont("normal", { weights: ["400", "600", "700"], subsets: ["latin"] });

const timing = springTiming({ config: { damping: 200 }, durationInFrames: 14 });

/** Zusatzsequenz (SlangTag-Feed), wird vor dem bestehenden Outro eingesetzt. */
export const SlangExtra: React.FC = () => (
  <AbsoluteFill style={{ background: "#000", fontFamily }}>
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={132}>
        <SceneSlangFeedRoll />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={wipe({ direction: "from-bottom" })}
        timing={timing}
      />
      <TransitionSeries.Sequence durationInFrames={100}>
        <SceneSlangPlay />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);
