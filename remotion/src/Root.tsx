import React from "react";
import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";
import { SceneLogoIntro } from "./scenes/SceneLogoIntro";
import { SlangExtra } from "./SlangExtra";
import { SpotVideo } from "./SpotVideo";
import { BirthdayVideo } from "./BirthdayVideo";
import { ChallengeVideo } from "./ChallengeVideo";
import { ChallengeVideoEn } from "./ChallengeVideoEn";
import { TranslateVideo } from "./TranslateVideo";
import { PigVideo } from "./PigVideo";
import { BavariaVideo } from "./BavariaVideo";
import { SaxonyVideo } from "./SaxonyVideo";

// 185 + 112 + 118 + 190 = 605 Frames minus 3 Übergänge à 14 = 563 Frames (~18,8 s)
export const RemotionRoot: React.FC = () => (
  <>
    {/* "Google Translate gegen Sachsen" – Comedy-Short (~11,9 s, 9:16) */}
    <Composition
      id="saxony"
      component={SaxonyVideo}
      durationInFrames={356}
      fps={30}
      width={1080}
      height={1920}
    />
    {/* "Schau ma moi" – bayerischer Sprach-Meme-Short (~12,8 s, 9:16) */}
    <Composition
      id="bavaria"
      component={BavariaVideo}
      durationInFrames={384}
      fps={30}
      width={1080}
      height={1920}
    />
    {/* "Mein Schwein pfeift" – Sprach-Meme-Short (~15,9 s, 9:16) */}
    <Composition
      id="pig"
      component={PigVideo}
      durationInFrames={478}
      fps={30}
      width={1080}
      height={1920}
    />

    {/* "Google Translate würde jetzt aufgeben" – Meme-Short (~16,5 s, 9:16) */}
    <Composition
      id="translate"
      component={TranslateVideo}
      durationInFrames={496}
      fps={30}
      width={1080}
      height={1920}
    />
    {/* "Zeig uns deinen Slang" – Social-Shorts-Clip (~18 s, 9:16) */}
    <Composition
      id="challenge"
      component={ChallengeVideo}
      durationInFrames={550}
      fps={30}
      width={1080}
      height={1920}
    />
    {/* "Show us your slang" – English social short (~18 s, 9:16) */}
    <Composition
      id="challenge-en"
      component={ChallengeVideoEn}
      durationInFrames={550}
      fps={30}
      width={1080}
      height={1920}
    />
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
