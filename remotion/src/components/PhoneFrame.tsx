import React from "react";
import { C } from "../theme";

/** Smartphone-Rahmen mit Y-Dude-Topbar. */
export const PhoneFrame: React.FC<{
  width: number;
  height: number;
  children: React.ReactNode;
}> = ({ width, height, children }) => {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 62,
        padding: 12,
        background: "linear-gradient(160deg, #2a2f2d, #0a0b0b 55%, #1b1f1e)",
        boxShadow: `0 60px 140px rgba(0,0,0,0.75), 0 0 90px ${C.green}22`,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 52,
          background: C.bg,
          overflow: "hidden",
          position: "relative",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 3,
            height: 96,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            padding: "0 26px 12px",
            background: "#000000",
          }}
        >
          <div style={{ color: C.ink, fontSize: 26, fontWeight: 700, letterSpacing: -0.6 }}>
            <span style={{ color: C.green }}>y</span>-Dude
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {["Lokal", "Global"].map((t, i) => (
              <div
                key={t}
                style={{
                  fontSize: 16,
                  padding: "6px 14px",
                  borderRadius: 999,
                  color: i === 0 ? "#04120b" : C.muted,
                  background: i === 0 ? C.green : "rgba(255,255,255,0.06)",
                  fontWeight: 600,
                }}
              >
                {t}
              </div>
            ))}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
};
