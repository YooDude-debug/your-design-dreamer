import React from "react";
import { AbsoluteFill } from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";
import { SceneOneClick } from "./scenes/SceneOneClick";

const { fontFamily } = loadFont("normal", { weights: ["400", "600", "700"], subsets: ["latin"] });

/** "Ein Klick" – Promo 9:16, 11 s, auf Basis des bestehenden Globe-Spots. */
export const OneClickVideo: React.FC = () => (
  <AbsoluteFill style={{ background: "#000", fontFamily }}>
    <SceneOneClick />
  </AbsoluteFill>
);
