import React from "react";
import { interpolate } from "remotion";
import { C } from "../../theme";
import { Bubble, TranslationBlock } from "./ChatParts";

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

export type TargetLang = {
  flag: string;
  label: string;
  /** Uebersetzung der eingehenden Nachricht in dieser Sprache. */
  translated: string;
  /** Antwort des Nutzers, wie sie beim Empfaenger ankommt. */
  reply: string;
};

/**
 * Messenger-Vorschau exakt in der Optik des Y-Dude-Messengers
 * (schwarzer Grund, gruene Akzente, dunkle Blasen, Header mit Sprachpaar).
 * Nur die Timeline ist auf den 11-Sekunden-Werbeclip zugeschnitten.
 */
export const MessengerAdScreen: React.FC<{
  frame: number;
  lang: TargetLang;
  /** 0..1 – Wechsel-Impuls beim Sprachwechsel (Szene 5–8 s). */
  swap: number;
}> = ({ frame, lang, swap }) => {
  const typing = interpolate(frame, [0, 10, 40, 48], [0, 1, 1, 0], clamp);

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
          A
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 44, fontWeight: 700, color: C.ink }}>@alex</div>
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
            <span style={{ color: C.green }}>🌐</span> {lang.flag} {lang.label}{" "}
            <span style={{ color: C.muted }}>→</span> <span style={{ color: C.cyan }}>🌐</span>{" "}
            <span
              style={{
                color: C.green,
                opacity: interpolate(swap, [0, 1], [1, 0.45]),
              }}
            >
              Automatisch
            </span>
          </div>
        </div>
        <span style={{ fontSize: 44, color: C.ink, opacity: 0.6 }}>✕</span>
      </div>

      {/* Chatverlauf */}
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
        <Bubble frame={frame} start={0} time="21:05" outgoing>
          Hey! Alles gut bei dir?
        </Bubble>

        <Bubble
          frame={frame}
          start={22}
          time="21:06"
          translated={
            <TranslationBlock
              frame={frame}
              start={62}
              text={lang.translated}
              showButtons
              buttonsStart={82}
              highlight
            />
          }
        >
          Γεια σου φίλε, όλα καλά! Εσύ;
        </Bubble>

        <Bubble frame={frame} start={158} time="21:08" outgoing>
          {lang.reply}
        </Bubble>

        <Bubble
          frame={frame}
          start={214}
          time="21:09"
          translated={
            <TranslationBlock frame={frame} start={228} text="Perfekt – dann bis später! 🙌" />
          }
        >
          Τέλεια – τα λέμε μετά! 🙌
        </Bubble>
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
            border: `2px solid ${typing > 0.2 ? "rgba(47,240,140,0.6)" : C.border}`,
            padding: "22px 28px",
            color: typing > 0.2 ? C.green : C.muted,
            fontSize: 34,
            background: "rgba(255,255,255,0.02)",
          }}
        >
          {typing > 0.2 ? "schreibt …" : "Nachricht schreiben — $ für SlangTag"}
        </div>
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 99,
            background: "rgba(47,240,140,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 44,
            color: "#04150c",
          }}
        >
          ➤
        </div>
      </div>
    </div>
  );
};
