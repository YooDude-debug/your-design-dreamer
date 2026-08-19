import React from "react";
import { interpolate } from "remotion";
import { C } from "../theme";

/**
 * „Reingeguckt“-Geste (Referenzbild): Hand im schwarzen Handschuh, Daumen und
 * Zeigefinger bilden ein rundes Guckloch, der Zeigefinger steht nach oben.
 * Durch das Loch schaut ein neugieriges Auge.
 *
 * `appear` 0..1 = Auftritt, `frame` = fortlaufende Bewegung (Neugier-Wackeln),
 * `peek` 0..1 = das Auge schaut durch das Loch.
 */
export const PeekHand: React.FC<{
  width?: number;
  appear?: number;
  peek?: number;
  frame: number;
}> = ({ width = 460, appear = 1, peek = 1, frame }) => {
  const glove = "#0b0d0c";
  const gloveHi = "#1e2422";

  // Neugieriges Umherschauen des Auges im Guckloch
  const eyeX = Math.sin(frame / 9) * 9;
  const eyeY = Math.cos(frame / 13) * 5;
  // Blinzeln
  const blinkPhase = (frame % 46) / 46;
  const lid = blinkPhase > 0.9 ? 1 : 0;

  const tilt = Math.sin(frame / 16) * 3.2;
  const bob = Math.sin(frame / 11) * 8;

  return (
    <div
      style={{
        width,
        transform: `translateY(${interpolate(appear, [0, 1], [340, 0]) + bob}px) rotate(${interpolate(
          appear,
          [0, 1],
          [-14, tilt],
        )}deg) scale(${interpolate(appear, [0, 1], [0.88, 1])})`,
        opacity: appear,
        filter: `drop-shadow(0 26px 60px rgba(0,0,0,0.85)) drop-shadow(0 0 34px ${C.green}33)`,
      }}
    >
      <svg viewBox="0 0 420 620" width="100%">
        <defs>
          <linearGradient id="gl" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={gloveHi} />
            <stop offset="0.55" stopColor={glove} />
            <stop offset="1" stopColor="#050706" />
          </linearGradient>
          <clipPath id="hole">
            <circle cx="196" cy="238" r="66" />
          </clipPath>
        </defs>

        {/* Handrücken / Faust */}
        <path
          d="M116 300 C96 348 100 424 130 470 C160 516 232 528 274 500 C312 474 322 414 312 356 C306 322 292 300 268 288 C232 272 150 268 116 300 Z"
          fill="url(#gl)"
          stroke={`${C.green}44`}
          strokeWidth="3"
        />
        {/* Eingerollte Finger */}
        <g fill={gloveHi} opacity="0.85">
          <rect x="252" y="352" width="58" height="34" rx="17" />
          <rect x="256" y="396" width="52" height="32" rx="16" />
          <rect x="254" y="438" width="46" height="30" rx="15" />
        </g>

        {/* Zeigefinger zeigt nach oben (hinter dem Guckloch) */}
        <path
          d="M282 250 C280 186 284 122 298 74 C306 50 336 50 344 74 C356 124 350 200 336 262"
          fill="none"
          stroke="url(#gl)"
          strokeWidth="50"
          strokeLinecap="round"
        />
        <path
          d="M292 190 C290 138 294 100 306 70"
          fill="none"
          stroke={`${C.green}44`}
          strokeWidth="3"
        />

        {/* Auge hinter dem Guckloch */}
        <g clipPath="url(#hole)" opacity={peek}>
          <rect x="110" y="150" width="180" height="180" fill="#f3efe6" />
          <ellipse cx={196 + eyeX} cy={238 + eyeY} rx="34" ry="34" fill="#cfe9dc" />
          <ellipse cx={196 + eyeX} cy={238 + eyeY} rx="24" ry="24" fill={C.green} opacity="0.85" />
          <circle cx={196 + eyeX} cy={238 + eyeY} r="12" fill="#050807" />
          <circle cx={196 + eyeX - 7} cy={238 + eyeY - 8} r="4.5" fill="#ffffff" opacity="0.9" />
          <rect
            x="110"
            y="150"
            width="180"
            height={lid ? 180 : 0}
            fill="url(#gl)"
            opacity={lid ? 0.96 : 0}
          />
        </g>

        {/* Guckloch: Daumen + Zeigefinger bilden die runde Öffnung */}
        <circle
          cx="196"
          cy="238"
          r="92"
          fill="none"
          stroke="url(#gl)"
          strokeWidth="52"
          strokeLinecap="round"
        />
        <circle cx="196" cy="238" r="92" fill="none" stroke={`${C.green}55`} strokeWidth="3" />
        <circle cx="196" cy="238" r="66" fill="none" stroke="rgba(0,0,0,0.9)" strokeWidth="4" />

        {/* Daumenansatz */}
        <path
          d="M118 268 C96 250 92 214 112 196 C130 180 158 190 166 214"
          fill="none"
          stroke="url(#gl)"
          strokeWidth="46"
          strokeLinecap="round"
        />

        {/* Handschuh-Bündchen */}
        <path
          d="M130 470 C160 512 236 524 276 498 L296 540 C246 578 156 566 118 512 Z"
          fill="#101413"
          stroke={`${C.green}55`}
          strokeWidth="3"
        />
      </svg>
    </div>
  );
};
