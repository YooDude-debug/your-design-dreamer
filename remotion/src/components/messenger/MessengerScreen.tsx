import React from "react";
import { interpolate } from "remotion";
import { C } from "../../theme";
import { Bubble, TranslationBlock, VoiceBubble } from "./ChatParts";

/**
 * Nachbau des echten Y-Dude-Messengers (schwarzer Hintergrund, gruene Akzente,
 * dunkle Blasen). Reine Demo-Darstellung: Der sichtbare Nutzer ist @nikos_demo.
 */
export const MessengerScreen: React.FC<{ frame: number; recording: number }> = ({
  frame,
  recording,
}) => {
  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        background: C.bg,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        border: "1px solid rgba(47,240,140,0.16)",
      }}
    >
      {/* Statusleiste */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "26px 46px 10px",
          color: C.ink,
          fontSize: 34,
          opacity: 0.85,
        }}
      >
        <span>21:12</span>
        <span style={{ letterSpacing: 6 }}>▮▮▮ 86 %</span>
      </div>

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 26,
          padding: "18px 40px 26px",
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <span style={{ fontSize: 44, color: C.ink, opacity: 0.7 }}>←</span>
        <div
          style={{
            width: 108,
            height: 108,
            borderRadius: 99,
            background: "linear-gradient(160deg, #2ff08c, #0f7f4c)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 52,
            fontWeight: 700,
            color: "#04150c",
          }}
        >
          N
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 44, fontWeight: 700, color: C.ink }}>@nikos_demo</div>
          <div style={{ fontSize: 30, color: C.muted, marginTop: 4 }}>zuletzt aktiv jetzt</div>
          <div
            style={{
              marginTop: 8,
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 32,
              color: C.ink,
            }}
          >
            <span style={{ color: C.green }}>🌐</span> 🇩🇪 Deutsch{" "}
            <span style={{ color: C.muted }}>→</span> <span style={{ color: C.cyan }}>🌐</span>{" "}
            Automatisch
          </div>
        </div>
        <span style={{ fontSize: 44, color: C.ink, opacity: 0.6 }}>✕</span>
      </div>

      {/* Chatverlauf – unten verankert, neue Nachrichten schieben nach oben */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          gap: 26,
          padding: "30px 40px 24px",
          overflow: "hidden",
        }}
      >
        <Bubble
          frame={frame}
          start={54}
          time="21:06"
          translated={
            <TranslationBlock
              frame={frame}
              start={78}
              text="Na Alter, mir geht's jetzt gut 😂"
              showButtons
              buttonsStart={96}
            />
          }
        >
          Γεια σου φίλε, τώρα είμαι καλά 😂
        </Bubble>

        <Bubble frame={frame} start={146} time="21:08" outgoing>
          Ja, war eine gute Idee von dir mit dem Übersetzer 😂
        </Bubble>

        <Bubble
          frame={frame}
          start={176}
          time="21:09"
          translated={<TranslationBlock frame={frame} start={192} text="Haha, ja! Läuft 😂" />}
        >
          Χαχα, ναι! 😂
        </Bubble>

        <Bubble
          frame={frame}
          start={214}
          time="21:10"
          translated={
            <TranslationBlock
              frame={frame}
              start={252}
              text="Du verschwendest dein Talent, du hättest Programmierer werden sollen."
              showButtons
              buttonsStart={266}
              highlight
            />
          }
        >
          Έχεις ταλέντο, θα έπρεπε να γίνεις προγραμματιστής.
        </Bubble>

        <VoiceBubble frame={frame} start={332} time="21:12" />

        {frame >= 344 ? (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div
              style={{
                maxWidth: "82%",
                borderRadius: 30,
                padding: "22px 28px",
                background: "rgba(20,54,36,0.7)",
                border: "2px solid rgba(47,240,140,0.35)",
                color: C.ink,
                fontSize: 40,
                opacity: interpolate(frame, [344, 358], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              Έχεις δίκιο, θα το δοκιμάσω!
              <div style={{ fontSize: 27, color: C.muted, marginTop: 10 }}>
                Übersetzt ins Griechische
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Composer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 26,
          padding: "24px 40px 44px",
          borderTop: `1px solid ${C.border}`,
        }}
      >
        <span style={{ fontSize: 44, opacity: 0.55 }}>☺</span>
        <span style={{ fontSize: 44, opacity: 0.55 }}>🖼</span>
        <div
          style={{
            flex: 1,
            borderRadius: 34,
            border: `2px solid ${recording > 0 ? "rgba(47,240,140,0.6)" : C.border}`,
            padding: "22px 28px",
            color: recording > 0 ? C.green : C.muted,
            fontSize: 34,
            background: "rgba(255,255,255,0.02)",
          }}
        >
          {recording > 0 ? "Aufnahme läuft …" : "Nachricht schreiben — $ für SlangTag"}
        </div>
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 99,
            background: recording > 0 ? C.green : "rgba(47,240,140,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 44,
            color: "#04150c",
            transform: `scale(${1 + recording * 0.08 * Math.abs(Math.sin(frame / 5))})`,
          }}
        >
          {recording > 0 ? "🎤" : "➤"}
        </div>
      </div>
    </div>
  );
};
