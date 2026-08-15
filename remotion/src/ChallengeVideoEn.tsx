import React from "react";
import { AbsoluteFill } from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { wipe } from "@remotion/transitions/wipe";
import { fade } from "@remotion/transitions/fade";

import { SceneHook } from "./scenes/challenge/SceneHook";
import { SceneRegions, type Region } from "./scenes/challenge/SceneRegions";
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

const REGIONS_EN: Region[] = [
  { city: "London", country: "England", code: "UK", slang: "Cheers!", lon: -0.13, lat: 51.51 },
  { city: "New York", country: "USA", code: "US", slang: "Yo!", lon: -74.0, lat: 40.71 },
  { city: "Sydney", country: "Australia", code: "AU", slang: "G'day!", lon: 151.2, lat: -33.87 },
  { city: "Athens", country: "Greece", code: "GR", slang: "Ela!", lon: 23.73, lat: 37.98 },
];

const RACE_EN = [
  { label: "cheers", meta: "London", at: 6 },
  { label: "yo", meta: "New York", at: 12 },
  { label: "gday", meta: "Sydney", at: 18 },
  { label: "ela", meta: "Athens", at: 24 },
];

/**
 * "SHOW US YOUR SLANG!" – English cut of the Y-Dude social short (9:16, ~18 s).
 * Same campaign, same motion system, copy written for native speakers.
 * 66+168+78+96+66+126 = 600 frames minus 5 transitions of 10 = 550.
 */
export const ChallengeVideoEn: React.FC = () => (
  <AbsoluteFill style={{ background: "#000", fontFamily }}>
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={66}>
        <SceneHook lead="Hey…" line1="what slang only" line2="hits in" accent="YOUR CITY?" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-bottom" })} timing={cut} />

      <TransitionSeries.Sequence durationInFrames={168}>
        <SceneRegions regions={REGIONS_EN} cinematic />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition presentation={wipe({ direction: "from-right" })} timing={cut} />

      <TransitionSeries.Sequence durationInFrames={78}>
        <SceneYourTurn
          line1="Every place"
          line2="talks different."
          turnPre="Now it's"
          turnAccent="YOUR"
          turnPost="turn."
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-bottom" })} timing={cut} />

      <TransitionSeries.Sequence durationInFrames={96}>
        <SceneMakeTag
          steps={["Record your slang.", "Create your SlangTag.", "Show where you're from."]}
          chipLabel="yourslang"
          chipMeta="Your Region"
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-left" })} timing={cut} />

      <TransitionSeries.Sequence durationInFrames={66}>
        <SceneChallenge
          kicker="🔥 Slang Challenge"
          headline="Which slang wins?"
          race={RACE_EN}
          spin={0.16}
        />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition presentation={fade()} timing={cut} />

      <TransitionSeries.Sequence durationInFrames={126}>
        <SceneChallengeEnd
          lines={["YOUR SLANG.", "YOUR REGION.", "YOUR CHALLENGE."]}
          cta="JOIN THE CHALLENGE"
        />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);
