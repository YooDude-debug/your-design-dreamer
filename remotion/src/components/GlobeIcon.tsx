import React from "react";
import { C } from "../theme";

/** Kleines Globus-Symbol (Ersatz fuer das 🌍-Emoji, das im Render fehlt). */
export const GlobeIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 54,
  color = C.green,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={1.9}
    strokeLinecap="round"
    style={{ display: "inline-block", verticalAlign: "-0.14em" }}
  >
    <circle cx="12" cy="12" r="9.2" />
    <path d="M2.8 12h18.4" />
    <path d="M12 2.8c2.7 2.6 4 5.7 4 9.2s-1.3 6.6-4 9.2c-2.7-2.6-4-5.7-4-9.2s1.3-6.6 4-9.2z" />
  </svg>
);
