import React from "react";
import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";
import { SceneLogoIntro } from "./scenes/SceneLogoIntro";

// 140 + 112 + 118 + 90 = 460 Frames minus 3 Übergänge à 16 = 412 Frames (~13,7 s)
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="main"
      component={MainVideo}
      durationInFrames={418}
      fps={30}
      width={1080}
      height={1920}
    />
    {/* Logo-Intro (5 s), wird dem bestehenden Werbeclip vorangestellt */}
    <Composition
      id="logo-intro"
      component={SceneLogoIntro}
      durationInFrames={152}
      fps={30}
      width={1080}
      height={1920}
    />
  </>
);
