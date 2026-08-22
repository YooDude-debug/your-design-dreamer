import React from "react";
import { Img, staticFile } from "remotion";
import { C } from "../theme";
import { SlangChip } from "./SlangChip";

export type CardData = {
  image: string;
  name: string;
  handle: string;
  place: string;
  tag: string;
  kind?: "community" | "creator";
  likes: string;
};

/** Ein Feed-Beitrag in der Y-Dude-Optik. */
export const FeedCard: React.FC<{
  data: CardData;
  frame: number;
  playing?: boolean;
  glow?: number;
}> = ({ data, frame, playing = false, glow = 0 }) => {
  const color = data.kind === "creator" ? C.blue : C.green;
  return (
    <div
      style={{
        borderRadius: 26,
        overflow: "hidden",
        background: C.card,
        border: `1px solid ${glow > 0 ? `${color}55` : C.border}`,
        boxShadow: glow > 0 ? `0 0 ${60 * glow}px ${color}33` : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px" }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            background: `linear-gradient(140deg, ${C.green}, ${C.cyan})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#04120b",
            fontWeight: 800,
            fontSize: 20,
          }}
        >
          {data.name.slice(0, 1)}
        </div>
        <div style={{ lineHeight: 1.25 }}>
          <div style={{ color: C.ink, fontSize: 22, fontWeight: 600 }}>{data.name}</div>
          <div style={{ color: C.muted, fontSize: 17 }}>
            {data.handle} · {data.place}
          </div>
        </div>
      </div>

      <div style={{ position: "relative" }}>
        <Img
          src={staticFile(`images/${data.image}`)}
          style={{ width: "100%", height: 420, objectFit: "cover", display: "block" }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.55))",
          }}
        />
        <div style={{ position: "absolute", left: 26, bottom: 26 }}>
          <SlangChip
            label={data.tag}
            kind={data.kind ?? "community"}
            frame={frame}
            playing={playing}
            scale={0.72}
          />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 26, padding: "16px 20px" }}>
        <div style={{ color: color, fontSize: 19, fontWeight: 600 }}>♥ {data.likes}</div>
        <div style={{ color: C.muted, fontSize: 19 }}>💬 24</div>
        <div style={{ color: C.muted, fontSize: 19 }}>↗ 8</div>
      </div>
    </div>
  );
};
