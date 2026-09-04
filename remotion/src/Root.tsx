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
import { ExplainVideo } from "./ExplainVideo";
import { WasIstYdudeVideo } from "./WasIstYdudeVideo";
import { Ydude5sVideo } from "./Ydude5sVideo";
import { OneClickVideo } from "./OneClickVideo";
import { SwabiaVideo } from "./SwabiaVideo";
import { DefendCityVideo } from "./DefendCityVideo";
import { FeedShortVideo } from "./FeedShortVideo";
import { SlangShortVideo } from "./SlangShortVideo";
import { SilentCityVideo } from "./SilentCityVideo";
import { RonjaVideo } from "./RonjaVideo";
import { MessengerDemoVideo } from "./MessengerDemoVideo";
import { FernwehVideo } from "./FernwehVideo";
import { KapsouraVideo } from "./KapsouraVideo";
import { AppTourVideo } from "./AppTourVideo";
import { MessengerAdVideo } from "./MessengerAdVideo";
import { OnePlatformVideo } from "./OnePlatformVideo";
import { XpChaosVideo } from "./XpChaosVideo";
import { CreatorVoiceVideo } from "./CreatorVoiceVideo";
import { SellVoiceVideo } from "./SellVoiceVideo";
import { ProductTour60Video } from "./ProductTour60Video";

// 185 + 112 + 118 + 190 = 605 Frames minus 3 Übergänge à 14 = 563 Frames (~18,8 s)
export const RemotionRoot: React.FC = () => (
  <>
    {/* 60-s-Produkt-Demo aus echten Production-Screenshots (9:16) */}
    <Composition
      id="product-tour-60"
      component={ProductTour60Video}
      durationInFrames={1800}
      fps={30}
      width={1080}
      height={1920}
    />
    {/* "Verkaufe deine Stimme." – 20 s ruhiger Creator-Promo (9:16) */}
    <Composition
      id="sell-voice"

      component={SellVoiceVideo}
      durationInFrames={600}
      fps={30}
      width={1080}
      height={1920}
    />
    {/* "Deine Stimme. Deine Sprache. Dein Einkommen." – 15 s Creator-Promo (9:16) */}
    <Composition
      id="creator-voice"
      component={CreatorVoiceVideo}
      durationInFrames={450}
      fps={30}
      width={1080}
      height={1920}
    />
    {/* Startup → XP-Chaos → Refresh → echtes Y-Dude (15 s, 9:16) */}
    <Composition
      id="xp-chaos"
      component={XpChaosVideo}
      durationInFrames={456}
      fps={30}
      width={1080}
      height={1920}
    />
    {/* "ONE PLATFORM. ONE COMMON LANGUAGE." – 14 s Social-Short (9:16) */}
    <Composition
      id="one-platform"
      component={OnePlatformVideo}
      durationInFrames={420}
      fps={30}
      width={1080}
      height={1920}
    />
    {/* "Alle Sprachen. Ein Messenger." – 11 s Messenger-Werbeclip (9:16) */}
    <Composition
      id="messenger-ad"
      component={MessengerAdVideo}
      durationInFrames={330}
      fps={30}
      width={1080}
      height={1920}
    />

    {/* 10s App-Werbespot: Feed → Globe → Arena → Messenger → Logo (9:16) */}
    <Composition
      id="app-tour"
      component={AppTourVideo}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
    />

    {/* "A word that doesn't exist in English…" – KAPSOURA (exakt 10 s, 9:16) */}
    <Composition
      id="kapsoura"
      component={KapsouraVideo}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
    />

    {/* "A word that doesn't exist in English…" – FERNWEH (exakt 10 s, 9:16) */}
    <Composition
      id="fernweh"
      component={FernwehVideo}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
    />

    {/* Messenger-Produktdemo: Deutsch <-> Griechisch Auto-Uebersetzung (14 s, 9:16) */}
    <Composition
      id="messenger-demo"
      component={MessengerDemoVideo}
      durationInFrames={420}
      fps={30}
      width={1080}
      height={1920}
    />

    {/* "Far apart. Still together." – Geburtstagsgruesse aus vier Laendern (15,2 s, 9:16) */}
    <Composition
      id="ronja"
      component={RonjaVideo}
      durationInFrames={456}
      fps={30}
      width={1080}
      height={1920}
    />

    {/* "Hashtags sind stumm. Deine Stadt nicht." (10 s, 9:16) */}
    <Composition
      id="silent-city"
      component={SilentCityVideo}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
    />

    {/* Screen-Recording-Short: "Hashtags, die sprechen" (15,4 s, 9:16) */}
    <Composition
      id="slang-short"
      component={SlangShortVideo}
      durationInFrames={462}
      fps={30}
      width={1080}
      height={1920}
    />

    {/* YouTube-Short: echter Feed + hörbare SlangTags (15 s, 9:16) */}
    <Composition
      id="feed-short"
      component={FeedShortVideo}
      durationInFrames={450}
      fps={30}
      width={1080}
      height={1920}
    />

    {/* "Schwäbisch" – Community-Short (exakt 9 s, 9:16) */}
    <Composition
      id="swabia"
      component={SwabiaVideo}
      durationInFrames={270}
      fps={30}
      width={1080}
      height={1920}
    />

    {/* "Ein Klick" – Promo auf Basis des Globe-Spots (~11 s, 9:16) */}
    <Composition
      id="oneclick"
      component={OneClickVideo}
      durationInFrames={334}
      fps={30}
      width={1080}
      height={1920}
    />

    {/* "Kann Google Translate Sachsen?" – Humor-Short mit Y-Dude-Erklaerung (~13,7 s, 9:16) */}
    <Composition
      id="explain"
      component={ExplainVideo}
      durationInFrames={410}
      fps={30}
      width={1080}
      height={1920}
    />
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

    {/* "Was ist Y-Dude?" – trockener 10s Social-Media-Spot (9:16) */}
    <Composition
      id="was-ist-ydude"
      component={WasIstYdudeVideo}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
    />

    {/* 5-Sekunden-Y-Dude-Spot – „Was ist Y-Dude eigentlich?“ (9:16) */}
    <Composition
      id="ydude-5s"
      component={Ydude5sVideo}
      durationInFrames={150}
      fps={30}
      width={1080}
      height={1920}
    />

    {/* "Verteidige deine Stadt" – energiegeladener 10s-Werbespot (9:16) */}
    <Composition
      id="defend-city"
      component={DefendCityVideo}
      durationInFrames={300}
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
