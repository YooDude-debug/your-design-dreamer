import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  spring,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";
import { C } from "./theme";
import { PhoneFrame } from "./components/PhoneFrame";
import { FeedCard, type CardData } from "./components/FeedCard";
import { BrandLockup } from "./components/BrandLockup";
import { PeekHand } from "./components/PeekHand";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "800"],
  subsets: ["latin"],
});

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const CARD_H = 554;
const GAP = 28;
const STEP = CARD_H + GAP;
const CENTER = 400;

const CARDS: CardData[] = [
  { image: "rostock.jpg", name: "Lena", handle: "@lena", place: "Rostock", tag: "moin-moin", likes: "1,2k" },
  { image: "rio.jpg", name: "Duda", handle: "@duda", place: "Rio", tag: "sextou", likes: "5,6k" },
  { image: "athens.jpg", name: "Nikos", handle: "@nikos", place: "Athen", tag: "re-malaka", likes: "890" },
  // Fokus-Post (Szene 2 + 3)
  { image: "berlin.jpg", name: "Kaan", handle: "@kaan", place: "Berlin", tag: "wat-kickste", kind: "creator", likes: "3,4k" },
  // Post 2 – eigener SlangTag "reingeguckt" mit der Reingeguckt-Handgeste
  { image: "burger.jpg", name: "Jonte", handle: "@jonte", place: "Berlin", tag: "reingeguckt", likes: "2,3k" },
  { image: "tokyo.jpg", name: "Basti", handle: "@basti", place: "München", tag: "oida", likes: "4,1k" },
];

/** Sprach-Sounds exakt auf die SlangTag-Animation getimt. */
const SOUNDS = [
  { file: "berlin-kickste.mp3", from: 66, len: 62, card: 3, caption: "„Ey, wat kickste so?“", rate: 1 },
  { file: "berlin-reingeguckt.mp3", from: 200, len: 38, card: 4, caption: "„Reingeguckt!“", rate: 1 },
  { file: "bayern-oida.mp3", from: 268, len: 63, card: 5, caption: "„Ja host du des g'sehn, Oida?“", rate: 1.2 },
];

const SCROLL_KEYS = [0, 18, 34, 54, 138, 158, 248, 266, 300];
const SCROLL_VALS = [
  0,
  520,
  980,
  3 * STEP - CENTER,
  3 * STEP - CENTER,
  4 * STEP - CENTER,
  4 * STEP - CENTER,
  5 * STEP - 640,
  5 * STEP - 640,
];

export const FeedShortVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scroll = interpolate(frame, SCROLL_KEYS, SCROLL_VALS, {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });

  const active = SOUNDS.find((s) => frame >= s.from && frame < s.from + s.len);
  const activeCaption = SOUNDS.find((s) => frame >= s.from - 4 && frame < s.from + s.len + 8);

  // Kamera: Zoom auf den Fokus-Post (Szene 3) und Zoom-out am Ende
  const punchZoom = interpolate(frame, [96, 116, 136], [1, 1.12, 1.0], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  const outro = interpolate(frame, [336, 380], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const phoneScale = interpolate(outro, [0, 1], [1, 0.62]) * (frame < 140 ? punchZoom : 1);
  const phoneY = interpolate(outro, [0, 1], [0, -180]);
  const phoneOpacity = interpolate(frame, [352, 392], [1, 0], clamp);

  // Reingeguckt-Geste: Hand kommt hoch, schaut neugierig durchs Guckloch,
  // danach klingt der eigene SlangTag des zweiten Posts.
  const handAppear =
    spring({ frame: frame - 150, fps, config: { damping: 18, stiffness: 130 } }) *
    interpolate(frame, [232, 252], [1, 0], clamp);
  const handPeek = interpolate(frame, [168, 182], [0, 1], clamp);

  const entry = spring({ frame, fps, config: { damping: 200 } });
  const drift = Math.sin(frame / 52) * 5;

  const line1 = spring({ frame: frame - 342, fps, config: { damping: 200 } });
  const line2 = spring({ frame: frame - 366, fps, config: { damping: 200 } });
  const brandIn = spring({ frame: frame - 396, fps, config: { damping: 200 } });
  const claimIn = spring({ frame: frame - 410, fps, config: { damping: 200 } });
  const urlIn = spring({ frame: frame - 424, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ background: "#000", fontFamily, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(70% 46% at 50% 40%, ${C.green}18 0%, rgba(0,0,0,0.96) 70%)`,
        }}
      />

      {/* Sprach-Sounds der SlangTags */}
      {SOUNDS.map((s) => (
        <Sequence key={s.file + s.from} from={s.from} durationInFrames={s.len + 4}>
          <Audio src={staticFile(`audio/${s.file}`)} playbackRate={s.rate} volume={1} />
        </Sequence>
      ))}

      {/* Feed im Smartphone */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            transform: `translateY(${interpolate(entry, [0, 1], [90, 18]) + drift + phoneY}px) scale(${phoneScale}) rotate(-1.2deg)`,
            opacity: entry * phoneOpacity,
          }}
        >
          <PhoneFrame width={640} height={1360}>
            <div
              style={{
                position: "absolute",
                left: 20,
                right: 20,
                top: 24,
                transform: `translateY(${-scroll}px)`,
                display: "flex",
                flexDirection: "column",
                gap: GAP,
              }}
            >
              {CARDS.map((c, i) => {
                const playing = active?.card === i;
                return (
                  <div
                    key={c.tag}
                    style={{
                      opacity: playing ? 1 : 0.86,
                      transform: `scale(${playing ? 1 : 0.99})`,
                    }}
                  >
                    <FeedCard data={c} frame={frame + i * 7} playing={playing} glow={playing ? 1 : 0} />
                  </div>
                );
              })}
            </div>
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 16%, rgba(0,0,0,0) 80%, rgba(0,0,0,0.72) 100%)",
              }}
            />
          </PhoneFrame>
        </div>
      </AbsoluteFill>

      {/* Reingeguckt-Geste über dem zweiten Post */}
      {frame >= 146 && frame < 254 && (
        <div style={{ position: "absolute", right: 24, bottom: 300, transform: "rotate(-8deg)" }}>
          <PeekHand width={540} appear={handAppear} peek={handPeek} frame={frame} />
        </div>
      )}

      {/* Untertitel zum jeweils klingenden SlangTag */}
      {activeCaption && frame < 336 && (
        <div
          style={{
            position: "absolute",
            left: 70,
            right: 70,
            bottom: 210,
            textAlign: "center",
            color: C.ink,
            fontSize: 58,
            fontWeight: 800,
            letterSpacing: -1.4,
            textShadow: "0 10px 40px rgba(0,0,0,0.9)",
            opacity: interpolate(
              frame,
              [activeCaption.from - 4, activeCaption.from + 4, activeCaption.from + activeCaption.len, activeCaption.from + activeCaption.len + 8],
              [0, 1, 1, 0],
              clamp,
            ),
            transform: `translateY(${interpolate(frame, [activeCaption.from - 4, activeCaption.from + 6], [22, 0], clamp)}px)`,
          }}
        >
          {activeCaption.caption}
        </div>
      )}

      {/* Szene 5 – Aussage */}
      {frame >= 336 && frame < 396 && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: 380 }}>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                color: C.ink,
                fontSize: 74,
                fontWeight: 800,
                letterSpacing: -2,
                opacity: line1,
                transform: `translateY(${interpolate(line1, [0, 1], [30, 0])}px)`,
              }}
            >
              Bilder können mehr
              <br />
              als Worte.
            </div>
            <div
              style={{
                marginTop: 34,
                color: C.green,
                fontSize: 56,
                fontWeight: 700,
                letterSpacing: -1,
                opacity: line2,
                transform: `translateY(${interpolate(line2, [0, 1], [24, 0])}px)`,
              }}
            >
              SlangTags machen sie hörbar.
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* Szene 6 – Abschluss */}
      {frame >= 392 && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <BrandLockup
            frame={frame}
            appear={brandIn}
            sloganAppear={claimIn}
            markWidth={300}
            textHeight={170}
            energy={0.7}
          />
          <div
            style={{
              marginTop: 44,
              color: C.muted,
              fontSize: 44,
              fontWeight: 600,
              letterSpacing: 3,
              opacity: urlIn,
            }}
          >
            y-dude.com
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
