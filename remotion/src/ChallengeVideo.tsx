import React from "react";
import { AbsoluteFill } from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { wipe } from "@remotion/transitions/wipe";
import { fade } from "@remotion/transitions/fade";

import { SceneHook } from "./scenes/challenge/SceneHook";
import { SceneRegions } from "./scenes/challenge/SceneRegions";
import { SceneYourTurn } from "./scenes/challenge/SceneYourTurn";
import { SceneMakeTag } from "./scenes/challenge/SceneMakeTag";
import { SceneChallenge } from "./scenes/challenge/SceneChallenge";
import { SceneChallengeEnd } from "./scenes/challenge/SceneChallengeEnd";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700", "800"],
  subsets: ["latin"],
});

const T = 10;
const cut = springTiming({ config: { damping: 200 }, durationInFrames: T });

/**
 * "ZEIG UNS DEINEN SLANG!" – Social-Shorts-Clip (9:16, ~18 s).
 * Schnelle Schnitte, starke Typografie, SlangTag als roter Faden.
 * 66+168+78+96+66+126 = 600 Frames minus 5 Uebergaenge a 10 = 550.
 */
export const ChallengeVideo: React.FC = () => (
  <AbsoluteFill style={{ background: "#000", fontFamily }}>
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={66}>
        <SceneHook />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-bottom" })} timing={cut} />

      <TransitionSeries.Sequence durationInFrames={168}>
        <SceneRegions />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-right" })} timing={cut} />

      <TransitionSeries.Sequence durationInFrames={78}>
        <SceneYourTurn />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-bottom" })} timing={cut} />

      <TransitionSeries.Sequence durationInFrames={96}>
        <SceneMakeTag />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-left" })} timing={cut} />

      <TransitionSeries.Sequence durationInFrames={66}>
        <SceneChallenge />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={cut} />

      <TransitionSeries.Sequence durationInFrames={126}>
        <SceneChallengeEnd />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);
