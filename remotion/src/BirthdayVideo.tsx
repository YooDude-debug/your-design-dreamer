import React from "react";
import { AbsoluteFill } from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";
import { SceneBirthday } from "./scenes/SceneBirthday";

const { fontFamily } = loadFont("normal", { weights: ["400", "600", "700"], subsets: ["latin"] });

/** Werbespot 9:16 – digitales Geburtstags-Klassenfoto mit SlangTags. */
export const BirthdayVideo: React.FC = () => (
  <AbsoluteFill style={{ background: "#000", fontFamily }}>
    <SceneBirthday />
  </AbsoluteFill>
);
