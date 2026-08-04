import { useEffect, useState } from "react";

import markUrl from "@/assets/ydude-mark.png";

/**
 * Nativer PWA-Startbildschirm.
 *
 * Erscheint ausschliesslich, wenn die App als installierte PWA
 * (standalone) startet – im Browser bleibt die Oberflaeche unveraendert.
 * Reines Schwarz, zentriertes Original-Logo mit Fade-In, darunter der Claim.
 */
export function AppSplash() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!standalone) return;
    setVisible(true);
    const t1 = window.setTimeout(() => setLeaving(true), 900);
    const t2 = window.setTimeout(() => setVisible(false), 1250);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483647,
        background: "#000000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        opacity: leaving ? 0 : 1,
        transition: "opacity 350ms ease-out",
        pointerEvents: "none",
      }}
    >
      <img
        src={markUrl}
        alt=""
        style={{
          width: "27vw",
          maxWidth: 320,
          height: "auto",
          animation: "ydude-splash-fade 420ms ease-out both",
        }}
      />
      <div
        style={{
          textAlign: "center",
          color: "#FFFFFF",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          fontSize: "clamp(15px, 4.2vw, 20px)",
          lineHeight: 1.35,
          letterSpacing: "0.01em",
          animation: "ydude-splash-fade 420ms ease-out both",
        }}
      >
        <div style={{ fontWeight: 600 }}>Speak local.</div>
        <div style={{ fontWeight: 400 }}>Connect Global</div>
      </div>
      <style>{`@keyframes ydude-splash-fade{from{opacity:0}to{opacity:1}}`}</style>
    </div>
  );
}
