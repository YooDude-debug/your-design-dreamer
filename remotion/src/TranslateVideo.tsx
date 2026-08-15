import React from "react";
import { AbsoluteFill } from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { wipe } from "@remotion/transitions/wipe";
import { fade } from "@remotion/transitions/fade";

import { SceneTransHook } from "./scenes/translate/SceneTransHook";
import { SceneTranslate } from "./scenes/translate/SceneTranslate";
import { SceneBerlin } from "./scenes/translate/SceneBerlin";
import { SceneMessage } from "./scenes/translate/SceneMessage";
import { SceneBrandSoft } from "./scenes/translate/SceneBrandSoft";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700", "800"],
  subsets: ["latin"],
});

const cut = springTiming({ config: { damping: 200 }, durationInFrames: 8 });

/**
 * "Google Translate würde jetzt aufgeben" – Meme-Short (9:16, ~16,5 s).
 * 90+120+150+90+78 = 528 Frames minus 4 Uebergaenge a 8 = 496.
 */
export const TranslateVideo: React.FC = () => (
  <AbsoluteFill style={{ background: "#000", fontFamily }}>
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={90}>
        <SceneTransHook />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-bottom" })} timing={cut} />

      <TransitionSeries.Sequence durationInFrames={120}>
        <SceneTranslate />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-right" })} timing={cut} />

      <TransitionSeries.Sequence durationInFrames={150}>
        <SceneBerlin />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={cut} />

      <TransitionSeries.Sequence durationInFrames={90}>
        <SceneMessage />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={cut} />

      <TransitionSeries.Sequence durationInFrames={78}>
        <SceneBrandSoft />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);
