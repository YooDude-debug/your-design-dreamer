import React from "react";
import { AbsoluteFill } from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";
import { SceneSpot } from "./scenes/SceneSpot";

const { fontFamily } = loadFont("normal", { weights: ["400", "600", "700"], subsets: ["latin"] });

/** Werbespot 9:16, 15 s – Globe-Challenge fuer TikTok/Reels. */
export const SpotVideo: React.FC = () => (
  <AbsoluteFill style={{ background: "#000", fontFamily }}>
    <SceneSpot />
  </AbsoluteFill>
);
