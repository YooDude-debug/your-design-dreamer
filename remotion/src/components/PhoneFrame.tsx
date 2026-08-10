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
        {/* Kein eigenes Topbar-Branding: Der echte Y-Dude-Feed bringt seine
            eigene Oberflaeche mit. */}

        {children}
      </div>
    </div>
  );
};
