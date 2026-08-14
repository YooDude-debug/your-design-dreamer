import React from "react";
import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";
import { SceneLogoIntro } from "./scenes/SceneLogoIntro";
import { SlangExtra } from "./SlangExtra";
import { SpotVideo } from "./SpotVideo";
import { BirthdayVideo } from "./BirthdayVideo";

// 185 + 112 + 118 + 190 = 605 Frames minus 3 Übergänge à 14 = 563 Frames (~18,8 s)
export const RemotionRoot: React.FC = () => (
  <>
    {/* Geburtstags-Klassenfoto (16 s, 9:16) */}
    <Composition
      id="birthday"
      component={BirthdayVideo}
      durationInFrames={490}
      fps={30}
      width={1080}
      height={1920}
    />
    {/* Globe-Challenge-Spot (15 s, 9:16) */}
    <Composition
      id="spot"
      component={SpotVideo}
      durationInFrames={450}
      fps={30}
      width={1080}
      height={1920}
    />

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
    {/* Zusatzsequenz SlangTag-Feed (132 + 100 - 14 = 218 Frames) */}
    <Composition
      id="slang-extra"
      component={SlangExtra}
      durationInFrames={218}
      fps={30}
      width={1080}
      height={1920}
    />
  </>
);
