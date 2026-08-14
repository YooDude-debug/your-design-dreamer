import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { C } from "../theme";
import { SlangChip } from "../components/SlangChip";
import { BrandLockup } from "../components/BrandLockup";

/**
 * Y-Dude Werbespot 9:16 – "Digitales Geburtstags-Klassenfoto".
 *
 * Ein gemeinsames Gruppenfoto, an jeder Person haengt ein SlangTag. Die Tags
 * werden nacheinander "abgespielt", die jeweilige Person wird hervorgehoben und
 * ihr persoenlicher Geburtstagsgruss erscheint. Alles frame-basiert.
 */

const W = 1080;
const H = 1920;

// Bildkarte
const CARD_W = 940;
const CARD_H = Math.round((CARD_W / 1080) * 1350);
const CARD_X = (W - CARD_W) / 2;
const CARD_Y = 470;

type Person = {
  name: string;
  tag: string;
  greet: string;
  /** Kopfposition relativ zum Foto (0..1). */
  hx: number;
  hy: number;
  /** Chip-Position relativ zum Foto (0..1). */
  cx: number;
  cy: number;
  kind?: "community" | "creator";
};

const PEOPLE: Person[] = [
  { name: "Jonas", tag: "moin", greet: "Alles Gute zum Geburtstag!", hx: 0.13, hy: 0.4, cx: 0.2, cy: 0.63 },
  { name: "Mai", tag: "digga", greet: "Lass dich feiern!", hx: 0.3, hy: 0.5, cx: 0.36, cy: 0.75 },
  { name: "Sam", tag: "habibi", greet: "Liebe Grüße von uns allen!", hx: 0.53, hy: 0.42, cx: 0.55, cy: 0.58, kind: "creator" },
  { name: "Lena", tag: "chido", greet: "Feier schön, wir sind bei dir!", hx: 0.72, hy: 0.44, cx: 0.7, cy: 0.7 },
  { name: "Noa", tag: "yabai", greet: "Bleib genau so wie du bist!", hx: 0.9, hy: 0.5, cx: 0.78, cy: 0.86 },
];

// Timeline
const PLAY_START = 150;
const PLAY_LEN = 30;
const ALL_START = PLAY_START + PEOPLE.length * PLAY_LEN; // 300
const SEND_START = 390;
const END_START = 440;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const Caption: React.FC<{
  text: React.ReactNode;
  from: number;
  to: number;
  frame: number;
  fps: number;
  size?: number;
}> = ({ text, from, to, frame, fps, size = 74 }) => {
  if (frame < from || frame >= to) return null;
  const inn = spring({ frame: frame - from, fps, config: { damping: 17, stiffness: 165 } });
  const out = interpolate(frame, [to - 9, to], [1, 0], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: 64,
        right: 64,
        top: 150,
        textAlign: "center",
        color: C.ink,
        fontSize: size,
        lineHeight: 1.12,
        fontWeight: 700,
        letterSpacing: -1.6,
        opacity: inn * out,
        transform: `translateY(${interpolate(inn, [0, 1], [40, 0])}px)`,
        textShadow: "0 10px 44px rgba(0,0,0,0.9)",
      }}
    >
      {text}
    </div>
  );
};

export const SceneBirthday: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Foto-Karte: sanfter Push-in, waehrend der Grussrunde leichter Zoom auf Person
  const cardIn = spring({ frame, fps, config: { damping: 200 } });
  const activeIdx = Math.floor((frame - PLAY_START) / PLAY_LEN);
  const active = frame >= PLAY_START && activeIdx >= 0 && activeIdx < PEOPLE.length ? activeIdx : -1;
  const person = active >= 0 ? PEOPLE[active]! : null;
  const localPlay = active >= 0 ? frame - (PLAY_START + active * PLAY_LEN) : 0;

  const baseZoom = interpolate(frame, [0, 58, 150, 300, 330, 420], [1.1, 1.0, 1.02, 1.02, 1.0, 1.0], clamp);
  const focusZoom = active >= 0 ? 1.14 : 1;
  const zoom = baseZoom * focusZoom * (1 + Math.sin(frame / 34) * 0.006);

  // Kamera folgt der aktiven Person (Verschiebung der Karte)
  const panX = person ? (0.5 - person.hx) * CARD_W * 0.34 : 0;
  const panY = person ? (0.46 - person.hy) * CARD_H * 0.22 : 0;
  const panEase = interpolate(localPlay, [0, 12], [0, 1], clamp);

  // Versand ans Geburtstagskind
  const send = interpolate(frame, [SEND_START, SEND_START + 40], [0, 1], clamp);
  const sendLift = interpolate(send, [0, 1], [0, -300]);
  const sendScale = interpolate(send, [0, 1], [1, 0.42]);

  const endIn = interpolate(frame, [END_START, END_START + 16], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      {/* Weicher Party-Glow im Hintergrund */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 50% 34%, rgba(47,240,140,0.16) 0%, rgba(0,0,0,0) 58%), radial-gradient(circle at 78% 82%, rgba(79,209,245,0.12) 0%, rgba(0,0,0,0) 60%)",
        }}
      />

      {/* Foto-Karte */}
      <div
        style={{
          position: "absolute",
          left: CARD_X,
          top: CARD_Y,
          width: CARD_W,
          height: CARD_H,
          borderRadius: 44,
          overflow: "hidden",
          border: "2px solid rgba(255,255,255,0.14)",
          boxShadow: "0 40px 120px rgba(0,0,0,0.85), 0 0 90px rgba(47,240,140,0.16)",
          opacity: cardIn,
          transform: `translateY(${interpolate(cardIn, [0, 1], [70, 0]) + sendLift}px) scale(${
            sendScale * interpolate(cardIn, [0, 1], [0.92, 1])
          })`,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `translate(${panX * panEase}px, ${panY * panEase}px) scale(${zoom})`,
          }}
        >
          <Img
            src={staticFile("images/birthday-group.jpg")}
            style={{ width: CARD_W, height: CARD_H, objectFit: "cover", display: "block" }}
          />

          {/* Spotlight auf die aktive Person: dunkelt alles ausserhalb ab */}
          {person && (
            <div
              style={{
                position: "absolute",
                left: person.hx * CARD_W,
                top: person.hy * CARD_H,
                width: 300,
                height: 300,
                marginLeft: -150,
                marginTop: -150,
                borderRadius: 999,
                boxShadow: `0 0 0 2400px rgba(0,0,0,${0.6 * interpolate(localPlay, [0, 10], [0, 1], clamp)}), inset 0 0 70px rgba(0,0,0,0.35)`,
                border: `4px solid ${C.green}`,
                opacity: interpolate(localPlay, [0, 8, PLAY_LEN - 4, PLAY_LEN], [0, 1, 1, 0.2], clamp),
              }}
            />
          )}
        </div>

        {/* SlangTags an den Personen */}
        {PEOPLE.map((p, i) => {
          const appearAt = 62 + i * 14;
          const local = frame - appearAt;
          if (local < 0) return null;
          const pop = spring({ frame: local, fps, config: { damping: 12, stiffness: 200 } });
          const isActive = active === i;
          const allOn = frame >= ALL_START && frame < SEND_START + 20;
          const playing = isActive || allOn;
          const lift = isActive ? interpolate(localPlay, [0, 10], [0, -14], clamp) : 0;
          return (
            <div
              key={p.tag}
              style={{
                position: "absolute",
                left: p.cx * CARD_W,
                top: p.cy * CARD_H + lift,
                transform: `translate(-50%,-50%) scale(${interpolate(pop, [0, 1], [0.5, 1]) * (isActive ? 1.24 : 1)})`,
                opacity: pop * (active >= 0 && !isActive ? 0.55 : 1),
                filter: isActive ? `drop-shadow(0 0 26px ${C.green})` : "none",
              }}
            >
              <SlangChip
                label={p.tag}
                kind={p.kind ?? "community"}
                frame={frame}
                playing={playing}
                scale={0.62}
              />
            </div>
          );
        })}

        {/* Verlauf unten fuer Lesbarkeit der Namen */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 260,
            background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.85) 100%)",
          }}
        />
      </div>

      {/* Sprechblase: persoenlicher Gruss */}
      {person && (
        <div
          style={{
            position: "absolute",
            left: 70,
            right: 70,
            top: 300,
            textAlign: "center",
            opacity: interpolate(localPlay, [0, 8, PLAY_LEN - 5, PLAY_LEN], [0, 1, 1, 0], clamp),
            transform: `translateY(${interpolate(localPlay, [0, 12], [26, 0], clamp)}px)`,
          }}
        >
          <div
            style={{
              display: "inline-block",
              padding: "26px 40px",
              borderRadius: 34,
              background: "rgba(12,14,13,0.78)",
              border: `2px solid ${C.green}55`,
              boxShadow: `0 0 60px ${C.green}30`,
              color: C.ink,
              fontSize: 58,
              fontWeight: 700,
              letterSpacing: -1,
              lineHeight: 1.15,
            }}
          >
            „{person.greet}“
            <div style={{ marginTop: 12, fontSize: 36, fontWeight: 600, color: C.green, letterSpacing: 0 }}>
              @{person.name}
            </div>
          </div>
        </div>
      )}

      <Caption
        frame={frame}
        fps={fps}
        from={0}
        to={60}
        size={72}
        text={
          <>
            Was wäre, wenn alle deine
            <br />
            Freunde auf einem Bild wären?
          </>
        }
      />
      <Caption
        frame={frame}
        fps={fps}
        from={62}
        to={148}
        text={
          <>
            Jede Person hat ihren
            <br />
            eigenen SlangTag. 🔊
          </>
        }
      />
      <Caption
        frame={frame}
        fps={fps}
        from={ALL_START}
        to={SEND_START - 4}
        size={86}
        text={
          <>
            5 Freunde. 5 Stimmen.
            <br />1 Erinnerung.
          </>
        }
      />
      <Caption
        frame={frame}
        fps={fps}
        from={SEND_START}
        to={END_START}
        size={80}
        text={<>Dein Geburtstags-Klassenfoto. ❤️</>}
      />

      {/* Tippen-Hinweis: SlangTags sind interaktiv */}
      {frame >= 96 && frame < 150 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: CARD_Y + CARD_H + 42,
            textAlign: "center",
            color: C.muted,
            fontSize: 40,
            fontWeight: 600,
            letterSpacing: 1,
            opacity: interpolate(frame, [96, 110, 142, 150], [0, 1, 1, 0], clamp),
          }}
        >
          Antippen und anhören
        </div>
      )}

      {/* Sende-Feedback */}
      {frame >= SEND_START + 10 && frame < END_START && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 1420,
            textAlign: "center",
            color: C.green,
            fontSize: 46,
            fontWeight: 700,
            letterSpacing: 2,
            opacity: interpolate(frame, [SEND_START + 10, SEND_START + 24], [0, 1], clamp),
            transform: `translateY(${interpolate(frame, [SEND_START + 10, SEND_START + 40], [22, -8], clamp)}px)`,
          }}
        >
          ✔ An das Geburtstagskind gesendet
        </div>
      )}

      {/* Endcard */}
      <AbsoluteFill
        style={{
          background: "#000",
          opacity: endIn,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {endIn > 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 52 }}>
            <BrandLockup
              frame={frame}
              appear={endIn}
              sloganAppear={endIn}
              markWidth={230}
              textHeight={132}
              energy={0.85}
            />
            <div
              style={{
                opacity: interpolate(frame, [END_START + 10, END_START + 24], [0, 1], clamp),
                color: C.ink,
                fontSize: 50,
                fontWeight: 600,
                letterSpacing: 3,
              }}
            >
              www.y-dude.com
            </div>
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
