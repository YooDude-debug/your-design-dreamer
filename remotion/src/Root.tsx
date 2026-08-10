import React from "react";
import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";
import { SceneLogoIntro } from "./scenes/SceneLogoIntro";

// 185 + 112 + 118 + 190 = 605 Frames minus 3 Übergänge à 14 = 563 Frames (~18,8 s)
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="main"
      component={MainVideo}
      durationInFrames={563}
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
