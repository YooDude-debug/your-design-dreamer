/**
 * Zentrale Video-Ad-Abspiellogik des Werbekernels.
 *
 * Jede Videowerbung, die ueber den Werbekernel (`AdPlanSlot.kind === "video"`)
 * ausgespielt wird, nutzt genau diese Logik – unabhaengig von Kampagne,
 * Werbekunde oder Clip. Es gibt bewusst keine zweite, anzeigenspezifische
 * Steuerung:
 *
 *   Karte sichtbar → einrasten → Feed pausieren → Autostart (stumm)
 *   → Lautstaerke steuerbar → Skip gesperrt → Skip nach Wartezeit frei
 *   → Ende oder Skip → Karte beenden → Feed freigeben.
 *
 * Neue Videoanzeigen werden ausschliesslich ueber Katalog + Medienpool
 * konfiguriert (optional mit eigener Wartezeit/Maximallaenge) und erben diesen
 * Ablauf automatisch.
 */

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { VideoAd } from "@/lib/ad-video-demo";
import { VIDEO_AD_MAX_LENGTH, VIDEO_AD_SKIP_AFTER } from "@/lib/ad-catalog.shared";
import { freezeFeed } from "@/lib/feed-freeze";

/** Abspielregeln einer Videowerbung (Sekunden). */
export type VideoAdPolicy = {
  /** Wartezeit, bis „Ueberspringen“ freigeschaltet wird. */
  skipAfter: number;
  /** Harte Obergrenze der Abspieldauer. */
  maxLength: number;
  /** Verzoegerung zwischen Einrasten und Autostart (ms). */
  snapDelayMs: number;
  /** Sichtbarkeitsanteil, ab dem eingerastet wird. */
  visibleRatio: number;
  /** Schrittweite der Lautstaerketasten. */
  volumeStep: number;
};

export const VIDEO_AD_DEFAULT_POLICY: VideoAdPolicy = {
  skipAfter: VIDEO_AD_SKIP_AFTER,
  maxLength: VIDEO_AD_MAX_LENGTH,
  snapDelayMs: 420,
  visibleRatio: 0.5,
  volumeStep: 0.2,
};

/** Kampagnenwerte (falls gesetzt) ueber die Kernel-Standards legen. */
export function resolveVideoAdPolicy(ad: VideoAd): VideoAdPolicy {
  return {
    ...VIDEO_AD_DEFAULT_POLICY,
    ...(typeof ad.skipAfter === "number" ? { skipAfter: ad.skipAfter } : {}),
    ...(typeof ad.maxLength === "number" ? { maxLength: ad.maxLength } : {}),
  };
}

/**
 * Karten-Seite: Impression melden, Werbekarte einrasten und Clip automatisch
 * starten. Gilt fuer jede Videowerbung des Kernels.
 */
export function useVideoAdCardAutostart({
  ad,
  onImpression,
  onStart,
}: {
  ad: VideoAd;
  onImpression: () => void;
  onStart: () => void;
}) {
  const policy = resolveVideoAdPolicy(ad);
  const cardRef = useRef<HTMLElement | null>(null);
  const reported = useRef(false);
  const snapped = useRef(false);
  const started = useRef(false);

  /**
   * Callbacks werden vom Feed als Inline-Funktionen uebergeben und aendern
   * sich bei jedem Render. Ueber Refs bleibt der Beobachter stabil – sonst
   * wurde der Autostart-Timer bei jedem Feed-Render abgeraeumt, waehrend
   * `snapped` schon gesetzt war: das Video startete dann nie.
   */
  const onImpressionRef = useRef(onImpression);
  const onStartRef = useRef(onStart);
  onImpressionRef.current = onImpression;
  onStartRef.current = onStart;

  const start = useCallback(() => {
    if (started.current) return;
    started.current = true;
    onStartRef.current();
  }, []);

  /** Manueller Start (Tap auf das Standbild). */
  const restart = useCallback(() => {
    started.current = false;
    start();
  }, [start]);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    let timer: number | undefined;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const on = entry.isIntersecting && entry.intersectionRatio >= policy.visibleRatio;
          if (on && !reported.current) {
            reported.current = true;
            onImpressionRef.current();
          }
          if (on && !started.current) {
            // Kein automatisches Zentrieren (`scrollIntoView`): das riss den
            // Nutzer beim Scrollen mehrere Beiträge weit mit. Der Clip startet
            // einfach dort, wo die Karte sichtbar geworden ist.
            if (snapped.current) {
              // Sichtbar und Einrasten lag schon vor (z. B. nach einem
              // Re-Render): sofort starten statt auf einen neuen Timer warten.
              start();
            } else {
              snapped.current = true;
              if (timer) window.clearTimeout(timer);
              timer = window.setTimeout(start, policy.snapDelayMs);
            }
          }
        }
      },
      { threshold: [0, policy.visibleRatio] },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) window.clearTimeout(timer);
    };
  }, [policy.snapDelayMs, policy.visibleRatio, start]);

  return { cardRef, start, restart };
}

/**
 * Overlay-Seite: Feed einfrieren, stummer Autostart, Lautstaerke,
 * Skip-Freigabe und Restlaufzeit – zentral fuer alle Videoanzeigen.
 */
export function useVideoAdPlayback({
  ad,
  anchor,
  onEnded,
  onSkip,
}: {
  ad: VideoAd;
  anchor: HTMLElement | null;
  onEnded: () => void;
  onSkip: () => void;
}) {
  const policy = resolveVideoAdPolicy(ad);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const [left, setLeft] = useState<number | null>(null);
  const [skipIn, setSkipIn] = useState(policy.skipAfter);
  const [needsTap, setNeedsTap] = useState(false);

  // Feed bleibt eingefroren, solange die Werbung laeuft.
  useEffect(() => freezeFeed(anchor), [anchor]);

  /**
   * Stummer Autostart. `play()` wird nicht nur einmal beim Mounten versucht,
   * sondern erneut sobald der Clip abspielbereit ist (`canplay`/`loadeddata`) –
   * beim Mounten ist `readyState` oft noch 0, und ein `play()` in diesem
   * Moment scheitert je nach Browser mit `AbortError`/`NotAllowedError`.
   * Fehler werden nicht verschluckt, sondern mit Name/Meldung protokolliert.
   */
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    let cancelled = false;

    el.muted = true; // Autoplay ist nur stumm zuverlaessig erlaubt.
    el.defaultMuted = true;
    el.playsInline = true;
    el.autoplay = true;
    try {
      el.currentTime = 0;
    } catch {
      /* currentTime vor Metadaten ignorieren */
    }

    const attempt = () => {
      if (cancelled) return;
      const p = el.play();
      if (!p || typeof p.catch !== "function") return;
      p.then(() => {
        if (!cancelled) setNeedsTap(false);
      }).catch((err: unknown) => {
        if (cancelled) return;
        const e = err as { name?: string; message?: string };
        console.warn(
          `[video-ad] play() abgelehnt: ${e?.name ?? "Error"} – ${e?.message ?? ""} (muted=${el.muted}, playsInline=${el.playsInline}, readyState=${el.readyState})`,
        );
        // Nur echte Autoplay-Sperren brauchen einen Tap; ein AbortError
        // entsteht durch schnelle Re-Renders und loest sich beim naechsten
        // `canplay`-Versuch selbst.
        if (e?.name === "NotAllowedError") setNeedsTap(true);
      });
    };

    if (el.readyState >= 2) attempt();
    el.addEventListener("loadeddata", attempt);
    el.addEventListener("canplay", attempt);
    attempt();

    return () => {
      cancelled = true;
      el.removeEventListener("loadeddata", attempt);
      el.removeEventListener("canplay", attempt);
    };
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = muted;
    el.volume = volume;
  }, [muted, volume]);

  const changeVolume = useCallback(
    (direction: 1 | -1) => {
      const delta = direction * policy.volumeStep;
      setVolume((v) => Math.min(1, Math.max(0, Math.round((v + delta) * 10) / 10)));
      if (direction > 0) setMuted(false);
    },
    [policy.volumeStep],
  );

  const toggleMuted = useCallback(() => setMuted((m) => !m), []);

  const playManually = useCallback(() => {
    void videoRef.current?.play().catch(() => undefined);
  }, []);

  const canSkip = skipIn <= 0;

  const skip = useCallback(() => {
    if (!canSkip) return;
    videoRef.current?.pause();
    onSkip();
  }, [canSkip, onSkip]);

  /** Auf das <video>-Element anzuwendende Handler. */
  const videoProps = {
    ref: videoRef,
    onLoadedMetadata: (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const d = e.currentTarget.duration;
      setLeft(Number.isFinite(d) ? Math.ceil(Math.min(d, policy.maxLength)) : null);
    },
    onTimeUpdate: (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const el = e.currentTarget;
      if (Number.isFinite(el.duration)) {
        setLeft(Math.max(0, Math.ceil(Math.min(el.duration, policy.maxLength) - el.currentTime)));
      }
      setSkipIn(Math.max(0, Math.ceil(policy.skipAfter - el.currentTime)));
      if (el.currentTime >= policy.maxLength) {
        el.pause();
        onEnded();
      }
    },
    onEnded,
    onPlaying: () => setNeedsTap(false),
    onError: (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const err = e.currentTarget.error;
      console.warn(`[video-ad] Medienfehler code=${err?.code ?? "?"} ${err?.message ?? ""}`);
      onSkip();
    },
  };

  return {
    policy,
    videoRef,
    videoProps,
    muted,
    volume,
    left,
    skipIn,
    canSkip,
    needsTap,
    changeVolume,
    toggleMuted,
    playManually,
    skip,
  };
}
