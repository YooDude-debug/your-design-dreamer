/**
 * Slang Globe – verstecktes Mond-Easter-Egg.
 *
 * Sichtbar wird nur ein winziger Ausschnitt des Mondes in der absoluten
 * Zoom-Out-Maximalstufe. Bewusst extrem dezent: kein Button-Look, kein Label,
 * keine Animation, die Aufmerksamkeit erzwingt.
 *
 * Performance: die Sichtbarkeit wird nicht pro Frame, sondern in einem ruhigen
 * Intervall aus `engine.zoomProgress` gelesen (kein React-Render im RAF-Loop).
 * Das Audio wird erst beim Tap geladen – vorher findet keine Datenbank- oder
 * Netzwerkanfrage statt.
 */
import { useEffect, useRef, useState } from "react";
import type { GlobeEngine } from "@/lib/globe/globe-engine";
import { supabase } from "@/integrations/supabase/client";

/** Zoom-Progress bei maximal herausgezoomtem Globus (0 = weitestes Zoom-Out). */
const WORLD_ZOOM_MAX = 0.04;
/** Ruhiges Polling-Intervall (ms) – kein RAF, keine Renders pro Frame. */
const POLL_MS = 600;
/** Schlüssel im Easter-Egg-Bereich des Backends. */
const EGG_KEY = "globe_moon_one_small_step";

export function MoonEasterEgg({ engine }: { engine: GlobeEngine | null }) {
  const [visible, setVisible] = useState(false);
  const [glow, setGlow] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!engine) return;
    const check = () => setVisible(engine.zoomProgress <= WORLD_ZOOM_MAX);
    check();
    const id = window.setInterval(check, POLL_MS);
    return () => window.clearInterval(id);
  }, [engine]);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      audioRef.current = null;
    },
    [],
  );

  const trigger = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setGlow(true);
    window.setTimeout(() => setGlow(false), 1600);
    try {
      // Erst jetzt (Tap) wird der Easter-Egg-Datensatz gelesen.
      if (!urlRef.current) {
        const { data } = await supabase
          .from("easter_eggs")
          .select("audio_url")
          .eq("key", EGG_KEY)
          .maybeSingle();
        urlRef.current = data?.audio_url ?? null;
      }
      const url = urlRef.current;
      if (!url) return;
      const audio = audioRef.current ?? new Audio(url);
      audioRef.current = audio;
      audio.currentTime = 0;
      audio.volume = 0.9;
      await audio.play().catch(() => undefined);
    } finally {
      busyRef.current = false;
    }
  };

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-hidden="true"
      tabIndex={-1}
      onClick={trigger}
      className="pointer-events-auto absolute left-0 top-[18%] z-10 h-20 w-20 border-0 p-0 outline-none"
      style={{ background: "transparent", cursor: "default" }}
    >
      {/* Sichtbarer Mond: nur eine winzige Ecke (ca. 1 %) am oberen linken Rand. */}
      <span
        className="pointer-events-none absolute block h-14 w-14 rounded-full"
        style={{
          left: 0,
          top: 0,
          transform: "translate(-94%, -94%)",
          background:
            "radial-gradient(circle at 68% 34%, rgba(232,240,236,0.92), rgba(150,166,158,0.72) 46%, rgba(72,84,80,0.55) 78%, rgba(40,48,45,0.35) 100%)",
          boxShadow: glow
            ? "0 0 26px 6px rgba(47,240,140,0.28)"
            : "0 0 18px 2px rgba(200,220,210,0.08)",
          opacity: glow ? 0.9 : 0.38,
          transition: "opacity 0.7s ease, box-shadow 0.7s ease",
        }}
      >
        {/* Krater – nur als leichte Textur, keine UI-Anmutung */}
        <span
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 78% 58%, rgba(70,80,76,0.30) 0 6%, transparent 7%), radial-gradient(circle at 62% 78%, rgba(70,80,76,0.24) 0 4%, transparent 5%), radial-gradient(circle at 86% 30%, rgba(70,80,76,0.20) 0 3%, transparent 4%)",
          }}
        />
      </span>
    </button>
  );
}
