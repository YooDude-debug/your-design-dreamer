import React from "react";
import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";

// 140 + 112 + 118 + 90 = 460 Frames minus 3 Übergänge à 16 = 412 Frames (~13,7 s)
export const RemotionRoot: React.FC = () => (
  <Composition
    id="main"
    component={MainVideo}
    durationInFrames={418}
    fps={30}
    width={1080}
    height={1920}
  />
);
