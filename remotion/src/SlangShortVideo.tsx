import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Video,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";
import { C } from "./theme";
import { BrandLockup } from "./components/BrandLockup";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "800"],
  subsets: ["latin"],
});

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

/**
 * Ein Ausschnitt aus dem echten Y-Dude-Screen-Recording.
 * `at` = Sekunde im Quellmaterial, `zoom`/`pan` = Kamerafahrt im Clip.
 */
const Cut: React.FC<{
  at: number;
  len: number;
  zoom?: [number, number];
  pan?: [number, number];
  dim?: number;
}> = ({ at, len, zoom = [1.12, 1.24], pan = [0, 0], dim = 0 }) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, len], zoom, {
    ...clamp,
    easing: Easing.out(Easing.quad),
  });
  const y = interpolate(frame, [0, len], pan, clamp);
  const inFade = interpolate(frame, [0, 4], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ overflow: "hidden", opacity: inFade }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: "50%",
          width: 1080,
          transform: `translateY(calc(-50% + ${y}px)) scale(${scale})`,
        }}
      >
        <Video
          src={staticFile("video/app-capture.mp4")}
          startFrom={Math.round(at * 30)}
          muted
          style={{ width: 1080, display: "block" }}
        />
      </div>
      {dim > 0 && <AbsoluteFill style={{ background: `rgba(0,0,0,${dim})` }} />}
    </AbsoluteFill>
  );
};

/** Grosse, gut lesbare Textzeile mit weichem Auftritt. */
const Line: React.FC<{
  children: React.ReactNode;
  top?: number;
  bottom?: number;
  size?: number;
  color?: string;
  delay?: number;
}> = ({ children, top, bottom, size = 78, color = C.ink, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 200 } });

  return (
    <div
      style={{
        position: "absolute",
        left: 62,
        right: 62,
        top,
        bottom,
        textAlign: "center",
        color,
        fontSize: size,
        fontWeight: 800,
        lineHeight: 1.08,
        letterSpacing: -2,
        textShadow: "0 14px 46px rgba(0,0,0,0.95)",
        opacity: s,
        transform: `translateY(${interpolate(s, [0, 1], [34, 0])}px)`,
      }}
    >
      {children}
    </div>
  );
};

/** Dunkler Textbalken hinter Untertiteln – haelt den Text lesbar. */
const Scrim: React.FC<{ from: "top" | "bottom" }> = ({ from }) => (
  <AbsoluteFill
    style={{
      background:
        from === "top"
          ? "linear-gradient(180deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.55) 26%, rgba(0,0,0,0) 46%)"
          : "linear-gradient(0deg, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.9) 22%, rgba(0,0,0,0.45) 38%, rgba(0,0,0,0) 56%)",
    }}
  />
);

export const SlangShortVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const brand = spring({ frame: frame - 372, fps, config: { damping: 200 } });
  const claim = spring({ frame: frame - 390, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ background: "#000", fontFamily }}>
      {/* 0–2 s · HOOK – auffaellige Feed-Szene mit SlangTags */}
      <Sequence from={0} durationInFrames={62}>
        <Cut at={4.1} len={62} zoom={[1.14, 1.3]} pan={[0, -40]} dim={0.18} />
        <Scrim from="top" />
        <Line top={150} size={82}>
          Was wäre, wenn
          <br />
          Hashtags <span style={{ color: C.green }}>sprechen</span> könnten?
        </Line>
      </Sequence>

      {/* 2–5 s · SLANGTAG ERKLAEREN – Sound hoerbar */}
      <Sequence from={62} durationInFrames={90}>
        <Cut at={6.4} len={90} zoom={[1.2, 1.34]} pan={[-40, -90]} dim={0.2} />
        <Scrim from="bottom" />
        <Sequence from={4} durationInFrames={40}>
          <Audio src={staticFile("audio/hamburg-moin.mp3")} volume={1} />
        </Sequence>
        <Sequence durationInFrames={46}>
          <Line bottom={300} size={92} color={C.green}>
            Das sind SlangTags.
          </Line>
        </Sequence>
        <Sequence from={46}>
          <Audio src={staticFile("audio/berlin-reingeguckt.mp3")} volume={1} />
          <Line bottom={300} size={78}>
            Hashtags –<br />
            nur zum <span style={{ color: C.green }}>Anhören</span>.
          </Line>
        </Sequence>
      </Sequence>

      {/* 5–9 s · FUNKTION – schnelle Cuts mit hoerbaren SlangTags */}
      <Sequence from={152} durationInFrames={118}>
        <Sequence durationInFrames={40}>
          <Cut at={8.3} len={40} zoom={[1.3, 1.44]} pan={[120, 60]} dim={0.12} />
          <Audio src={staticFile("audio/berlin-kickste.mp3")} volume={1} />
        </Sequence>
        <Sequence from={40} durationInFrames={40}>
          <Cut at={24.2} len={40} zoom={[1.26, 1.4]} pan={[-140, -80]} dim={0.12} />
          <Audio src={staticFile("audio/bayern-oida.mp3")} playbackRate={1.2} volume={1} />
        </Sequence>
        <Sequence from={80} durationInFrames={38}>
          <Cut at={21.4} len={38} zoom={[1.16, 1.3]} pan={[0, -30]} dim={0.12} />
        </Sequence>
        <Scrim from="bottom" />
        <Line bottom={280} size={86} delay={2}>
          Lokaler Slang.
          <br />
          <span style={{ color: C.green }}>Als Sound.</span>
        </Line>
      </Sequence>

      {/* 9–12 s · BESONDERHEIT – Globe & Karte */}
      <Sequence from={270} durationInFrames={102}>
        <Sequence durationInFrames={48}>
          <Cut at={27.4} len={48} zoom={[1.06, 1.2]} pan={[220, 180]} dim={0.16} />
        </Sequence>
        <Sequence from={48} durationInFrames={54}>
          <Cut at={34.2} len={54} zoom={[1.1, 1.26]} pan={[120, 60]} dim={0.16} />
        </Sequence>
        <Scrim from="top" />
        <Line top={170} size={76} delay={3}>
          Welcher Slang ist
          <br />
          gerade wo angesagt? <span style={{ color: C.green }}>🌍</span>
        </Line>
      </Sequence>

      {/* 12–15 s · ABSCHLUSS – Branding ueber starker SlangTag-Szene */}
      <Sequence from={372} durationInFrames={90}>
        <Cut at={36.4} len={90} zoom={[1.18, 1.3]} pan={[80, 20]} dim={0.72} />
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <BrandLockup
            frame={frame}
            appear={brand}
            sloganAppear={claim}
            markWidth={300}
            textHeight={168}
            energy={0.8}
          />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
