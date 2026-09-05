import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";
import { C } from "./theme";
import { PhoneFrame } from "./components/PhoneFrame";
import { BrandLockup } from "./components/BrandLockup";

/**
 * "Y-Dude – Community. Creator. Unternehmer." (60 s, 9:16)
 *
 * Produkt-Demo ausschliesslich mit echten Screenshots der aktuellen
 * Y-Dude Production (public/tour60): echter Feed, echter Kampagnen-Editor mit
 * Live-Vorschau, echte Beitrags-Statistiken, echter SlangTag-QR-Code
 * ($mieseBrise), echter Messenger, echter Market-Artikel.
 * Nichts davon ist nachgebaut oder erfunden.
 */

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "800"],
  subsets: ["latin"],
});

const FONT = `${fontFamily}, sans-serif`;
const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

const PHONE_W = 820;
const PHONE_H = 1740;
/** Skalierung des Screenshots (880x1912) auf die Telefonbreite. */
const SHOT_W = PHONE_W - 24;
const SHOT_SCALE = SHOT_W / 880;
const SHOT_H = 1912 * SHOT_SCALE;

/** Screenshot im Telefon, mit weichem Vertikal-Pan (Ken Burns). */
const Screen: React.FC<{
  src: string;
  from: number;
  to: number;
  local: number;
  duration: number;
  zoom?: [number, number];
}> = ({ src, from, to, local, duration, zoom = [1.02, 1.08] }) => {
  const p = interpolate(local, [0, duration], [0, 1], clamp);
  const y = interpolate(p, [0, 1], [from, to], { easing: Easing.inOut(Easing.quad) });
  const s = interpolate(p, [0, 1], zoom, { easing: Easing.inOut(Easing.quad) });
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <Img
        src={staticFile(`tour60/${src}`)}
        style={{
          width: SHOT_W,
          height: SHOT_H,
          transform: `translateY(${y}px) scale(${s})`,
          transformOrigin: "center top",
        }}
      />
    </div>
  );
};

/** Telefon mit sanfter Kamerabewegung. */
const Phone: React.FC<{ local: number; children: React.ReactNode; scale?: number }> = ({
  local,
  children,
  scale = 1,
}) => {
  const { fps } = useVideoConfig();
  const enter = spring({ frame: local, fps, config: { damping: 200 } });
  const drift = Math.sin(local / 52) * 7;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          transform: `translateY(${interpolate(enter, [0, 1], [140, 0]) + drift}px) scale(${
            interpolate(enter, [0, 1], [0.94, 1]) * scale
          })`,
          opacity: enter,
        }}
      >
        <PhoneFrame width={PHONE_W} height={PHONE_H}>
          {children}
        </PhoneFrame>
      </div>
    </AbsoluteFill>
  );
};

const Backdrop: React.FC<{ local: number }> = ({ local }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(70% 50% at 50% ${28 + Math.sin(local / 90) * 6}%, ${C.green}1f, transparent 70%), #000`,
    }}
  />
);

const Caption: React.FC<{
  local: number;
  from: number;
  to: number;
  kicker?: string;
  main: string;
  accent?: string;
  top?: boolean;
}> = ({ local, from, to, kicker, main, accent, top = false }) => {
  const a = interpolate(local, [from, from + 9, to - 9, to], [0, 1, 1, 0], clamp);
  if (a <= 0) return null;
  const y = interpolate(local, [from, from + 12], [top ? -22 : 24, 0], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  return (
    <>
      {/* Lesbarkeits-Verlauf hinter dem Text – die Oberflaeche bleibt sichtbar. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          ...(top ? { top: 0, height: 420 } : { bottom: 0, height: 520 }),
          background: `linear-gradient(${top ? "180deg" : "0deg"}, rgba(0,0,0,0.88), rgba(0,0,0,0))`,
          opacity: a,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 62,
          right: 62,
          ...(top ? { top: 92 } : { bottom: 108 }),
          opacity: a,
          transform: `translateY(${y}px)`,
          textAlign: "center",
        }}
      >

      {kicker && (
        <div
          style={{
            color: C.muted,
            fontSize: 30,
            letterSpacing: 7,
            textTransform: "uppercase",
            fontWeight: 600,
            marginBottom: 12,
          }}
        >
          {kicker}
        </div>
      )}
      <div style={{ color: C.ink, fontSize: 62, fontWeight: 800, letterSpacing: -1.6, lineHeight: 1.1 }}>
        {main}
        {accent && (
          <>
            <br />
            <span style={{ color: C.green }}>{accent}</span>
          </>
        )}
      </div>
      </div>
    </>
  );

};

/* ------------------------------- 0–7 s ---------------------------------- */

const SceneIntro: React.FC = () => {
  const local = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logoOut = interpolate(local, [58, 72], [1, 0], clamp);
  const app = spring({ frame: local - 58, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill>
      <Backdrop local={local} />
      {logoOut > 0 && (
        <AbsoluteFill
          style={{ alignItems: "center", justifyContent: "center", opacity: logoOut, zIndex: 5 }}
        >
          <div
            style={{
              transform: `scale(${interpolate(local, [0, 58], [0.94, 1.02], clamp)})`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <BrandLockup
              frame={local}
              markWidth={300}
              textHeight={168}
              appear={interpolate(local, [0, 12], [0, 1], clamp)}
              sloganAppear={interpolate(local, [8, 22], [0, 1], clamp)}
              energy={0.9}
            />
            <div
              style={{
                marginTop: 44,
                maxWidth: 880,
                textAlign: "center",
                color: C.ink,
                fontSize: 46,
                fontWeight: 600,
                lineHeight: 1.25,
                opacity: interpolate(local, [20, 34], [0, 1], clamp),
              }}
            >
              Das soziale Netzwerk für{" "}
              <span style={{ color: C.green }}>Community, Creator &amp; Unternehmer.</span>
            </div>
          </div>
        </AbsoluteFill>
      )}
      <div style={{ opacity: app }}>
        <Phone local={local - 58}>
          <Screen src="feed0.png" from={0} to={-260} local={local - 58} duration={152} />
        </Phone>
      </div>
      <Caption
        local={local}
        from={82}
        to={208}
        kicker="Der Feed"
        main="Eine Community. Ein Feed."
        accent="Alles verbunden."
      />
    </AbsoluteFill>
  );
};


/* ------------------------------- 7–17 s --------------------------------- */

const SceneCampaign: React.FC = () => {
  const local = useCurrentFrame();
  const { fps } = useVideoConfig();
  // 0–108: echter Kampagnen-Editor (Desktop) mit Live-Vorschau
  const editorA = interpolate(local, [0, 12, 100, 116], [0, 1, 1, 0], clamp);
  const cardIn = spring({ frame: local - 104, fps, config: { damping: 26, stiffness: 90 } });

  return (
    <AbsoluteFill>
      <Backdrop local={local} />

      {editorA > 0 && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: editorA }}>
          <div
            style={{
              display: "flex",
              gap: 28,
              alignItems: "flex-start",
              transform: `scale(${interpolate(local, [0, 116], [0.62, 0.7], clamp)}) translateY(${interpolate(
                local,
                [0, 116],
                [30, -30],
                clamp,
              )}px)`,
            }}
          >
            <Img
              src={staticFile("tour60/editor-left.png")}
              style={{ width: 880, borderRadius: 26, border: `1px solid ${C.border}` }}
            />
            <Img
              src={staticFile("tour60/campaign-card.png")}
              style={{
                width: 470,
                borderRadius: 26,
                boxShadow: `0 0 90px ${C.green}44`,
              }}
            />
          </div>
        </AbsoluteFill>
      )}

      {local > 96 && (
        <Phone local={local - 96}>
          <div style={{ position: "relative", width: "100%", height: "100%" }}>
            <Screen src="feed1.png" from={-120} to={-360} local={local - 96} duration={200} />
            {/* Die echte Kampagnenkarte, wie sie der Feed ausspielt. */}
            <div
              style={{
                position: "absolute",
                left: 24,
                right: 24,
                top: 300,
                opacity: cardIn,
                transform: `translateY(${interpolate(cardIn, [0, 1], [420, 0])}px)`,
              }}
            >
              <Img
                src={staticFile("tour60/campaign-card.png")}
                style={{
                  width: "100%",
                  borderRadius: 22,
                  boxShadow: `0 30px 90px rgba(0,0,0,0.8), 0 0 70px ${C.green}33`,
                }}
              />
            </div>
          </div>
        </Phone>
      )}

      <Caption local={local} from={8} to={100} kicker="Für Unternehmen" main="Kampagne anlegen." accent="Live im echten Feed." />
      <Caption local={local} from={124} to={288} main="Werbung wird" accent="zur Interaktion." />

    </AbsoluteFill>
  );
};

/* ------------------------------ 17–27 s --------------------------------- */

const SceneAnalytics: React.FC = () => {
  const local = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Backdrop local={local} />
      <Phone local={local}>
        {local < 150 ? (
          <Screen src="posts.png" from={-120} to={-430} local={local} duration={150} zoom={[1.02, 1.08]} />
        ) : (
          <Screen src="feed2.png" from={-300} to={-520} local={local - 150} duration={150} zoom={[1.04, 1.12]} />
        )}
      </Phone>

      <Caption
        local={local}
        from={12}
        to={286}
        kicker="Likes · Kommentare · Aufrufe"
        main="Nicht nur Reichweite."
        accent="Messbare Interaktionen."
      />
    </AbsoluteFill>
  );
};

/* ------------------------------ 27–38 s --------------------------------- */

const SceneSlangQr: React.FC = () => {
  const local = useCurrentFrame();
  const { fps } = useVideoConfig();
  const qrUp = spring({ frame: local - 128, fps, config: { damping: 200 } });
  const scan = interpolate(local, [176, 268], [0, 1], clamp);
  const beam = interpolate(scan, [0, 1], [0, 1]);

  return (
    <AbsoluteFill>
      <Backdrop local={local} />
      <Phone local={local} scale={interpolate(qrUp, [0, 1], [1, 0.82])}>
        <Screen src="manager-qr.png" from={-330} to={-470} local={local} duration={300} zoom={[1.12, 1.2]} />
      </Phone>

      {qrUp > 0 && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <AbsoluteFill style={{ background: `rgba(0,0,0,${0.72 * qrUp})` }} />

          <div
            style={{
              opacity: qrUp,
              transform: `translateY(${interpolate(qrUp, [0, 1], [120, 0])}px) scale(${interpolate(
                qrUp,
                [0, 1],
                [0.8, 1],
              )})`,
              padding: 26,
              borderRadius: 30,
              background: "#fff",
              boxShadow: `0 40px 120px rgba(0,0,0,0.85), 0 0 90px ${C.green}55`,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <Img src={staticFile("tour60/qr-miesebrise.png")} style={{ width: 460, display: "block" }} />
            {/* Scan-Linie */}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 26 + beam * 460,
                height: 6,
                background: C.green,
                boxShadow: `0 0 40px 12px ${C.green}`,
                opacity: scan > 0 && scan < 1 ? 0.95 : 0,
              }}
            />
          </div>
          <div
            style={{
              marginTop: 26,
              opacity: qrUp,
              color: C.green,
              fontSize: 34,
              fontWeight: 700,
              letterSpacing: 3,
            }}
          >
            $mieseBrise
          </div>
        </AbsoluteFill>
      )}

      <Caption local={local} from={10} to={120} kicker="SlangTag" main="Online trifft" accent="Offline." />
      <Caption local={local} from={186} to={318} main="SlangTags verbinden reale Orte" accent="mit deiner Community." />

    </AbsoluteFill>
  );
};

/* ------------------------------ 38–47 s --------------------------------- */

const SceneMessenger: React.FC = () => {
  const local = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Backdrop local={local} />
      <Phone local={local}>
        <Screen src="messenger.png" from={-30} to={-190} local={local} duration={260} zoom={[1.06, 1.16]} />
      </Phone>
      <Caption
        local={local}
        from={12}
        to={256}
        kicker="Messenger mit Live-Übersetzung"
        main="Sprich deine Sprache."
        accent="Verstehe die Community weltweit."
      />
    </AbsoluteFill>
  );
};

/* ------------------------------ 47–55 s --------------------------------- */

const SceneMarket: React.FC = () => {
  const local = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Backdrop local={local} />
      <Phone local={local}>
        {local < 96 ? (
          <Screen src="market.png" from={-20} to={-260} local={local} duration={96} />
        ) : (
          <Screen src="marketitem.png" from={-60} to={-330} local={local - 96} duration={114} zoom={[1.05, 1.14]} />
        )}
      </Phone>
      <Caption local={local} from={10} to={200} kicker="Y-Dude Market" main="Entdecken. Verbinden." accent="Kaufen." />
    </AbsoluteFill>
  );
};

/* --------------------- 54–57 s: Alles zusammen --------------------------- */

const RECAP = [
  "feed0.png",
  "campaign-card.png",
  "posts.png",
  "qr-row.png",
  "messenger.png",
  "marketitem.png",
];

/** Kurze Montage der bereits gezeigten Bereiche – "eine Plattform". */
const SceneEcosystem: React.FC = () => {
  const local = useCurrentFrame();
  const per = 16;
  const idx = Math.min(RECAP.length - 1, Math.floor(local / per));
  const a = interpolate(local, [0, 10, 92, 102], [0, 1, 1, 0], clamp);

  const line = (text: string, from: number, green = false) => {
    const o = interpolate(local, [from, from + 8, from + 30, from + 38], [0, 1, 1, 0], clamp);
    if (o <= 0) return null;
    return (
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 210,
          textAlign: "center",
          opacity: o,
          color: green ? C.green : C.ink,
          fontSize: 74,
          fontWeight: 800,
          letterSpacing: -2,
          textShadow: "0 10px 50px rgba(0,0,0,0.9)",
        }}
      >
        {text}
      </div>
    );
  };

  return (
    <AbsoluteFill>
      <Backdrop local={local} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: a }}>
        <div
          style={{
            width: 720,
            height: 1260,
            borderRadius: 40,
            overflow: "hidden",
            border: `1px solid ${C.green}55`,
            boxShadow: `0 0 110px ${C.green}33`,
            transform: `scale(${1 + (local % per) * 0.003})`,
          }}
        >
          <Img
            src={staticFile(`tour60/${RECAP[idx]}`)}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
          />
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background: "linear-gradient(0deg, rgba(0,0,0,0.92), rgba(0,0,0,0) 45%)",
          pointerEvents: "none",
        }}
      />
      {line("Eine Plattform.", 4)}
      {line("Viele Möglichkeiten.", 36)}
      {line("Alles verbunden.", 66, true)}
    </AbsoluteFill>
  );
};

/* ------------------------------ 57–60 s --------------------------------- */

const SceneOutro: React.FC = () => {
  const local = useCurrentFrame();
  const { fps } = useVideoConfig();
  const brand = spring({ frame: local, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill>
      <Backdrop local={local} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", zIndex: 6 }}>
        <div style={{ transform: `scale(${interpolate(brand, [0, 1], [0.94, 1])})`, opacity: brand }}>
          <BrandLockup
            frame={local}
            markWidth={300}
            textHeight={168}
            appear={brand}
            sloganAppear={interpolate(local, [12, 26], [0, 1], clamp)}
            energy={0.85}
          />
          <div
            style={{
              marginTop: 48,
              textAlign: "center",
              opacity: interpolate(local, [30, 44], [0, 1], clamp),
            }}
          >
            <div style={{ color: C.ink, fontSize: 52, fontWeight: 800, letterSpacing: -1 }}>
              Community. Creator. Unternehmer.
            </div>
            <div
              style={{
                color: C.green,
                fontSize: 52,
                fontWeight: 800,
                marginTop: 8,
                opacity: interpolate(local, [48, 60], [0, 1], clamp),
              }}
            >
              Alles verbunden.
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ------------------------------- Montage -------------------------------- */

const S = {
  intro: { from: 0, dur: 210 },
  campaign: { from: 210, dur: 300 },
  analytics: { from: 510, dur: 300 },
  slang: { from: 810, dur: 330 },
  messenger: { from: 1140, dur: 270 },
  market: { from: 1410, dur: 210 },
  ecosystem: { from: 1620, dur: 102 },
  outro: { from: 1722, dur: 78 },
};


export const ProductTour60Video: React.FC = () => {
  const frame = useCurrentFrame();
  // Kurze, harte Blenden zwischen den Kapiteln (kein Schwarz-Fade).
  const cutFlash = Object.values(S)
    .slice(1)
    .reduce((acc, s) => acc + interpolate(frame, [s.from - 4, s.from, s.from + 5], [0, 0.5, 0], clamp), 0);

  return (
    <AbsoluteFill style={{ background: "#000", fontFamily: FONT }}>
      <Sequence from={S.intro.from} durationInFrames={S.intro.dur}>
        <SceneIntro />
      </Sequence>
      <Sequence from={S.campaign.from} durationInFrames={S.campaign.dur}>
        <SceneCampaign />
      </Sequence>
      <Sequence from={S.analytics.from} durationInFrames={S.analytics.dur}>
        <SceneAnalytics />
      </Sequence>
      <Sequence from={S.slang.from} durationInFrames={S.slang.dur}>
        <SceneSlangQr />
      </Sequence>
      <Sequence from={S.messenger.from} durationInFrames={S.messenger.dur}>
        <SceneMessenger />
      </Sequence>
      <Sequence from={S.market.from} durationInFrames={S.market.dur}>
        <SceneMarket />
      </Sequence>
      <Sequence from={S.ecosystem.from} durationInFrames={S.ecosystem.dur}>
        <SceneEcosystem />
      </Sequence>
      <Sequence from={S.outro.from} durationInFrames={S.outro.dur}>
        <SceneOutro />
      </Sequence>


      <AbsoluteFill
        style={{ background: "#fff", opacity: Math.min(0.5, cutFlash), pointerEvents: "none" }}
      />
    </AbsoluteFill>
  );
};
