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

  const start = useCallback(() => {
    if (started.current) return;
    started.current = true;
    onStart();
  }, [onStart]);

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
            onImpression();
          }
          if (on && !snapped.current) {
            snapped.current = true;
            // Kein automatisches Zentrieren (`scrollIntoView`): das riss den
            // Nutzer beim Scrollen mehrere Beiträge weit mit. Der Clip startet
            // einfach dort, wo die Karte sichtbar geworden ist.
            timer = window.setTimeout(start, policy.snapDelayMs);
          }
        }
      },
      { threshold: [policy.visibleRatio] },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) window.clearTimeout(timer);
    };
  }, [onImpression, policy.snapDelayMs, policy.visibleRatio, start]);

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

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = 0;
    el.muted = true; // Autoplay ist nur stumm zuverlaessig erlaubt.
    void el.play().catch(() => setNeedsTap(true));
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
    onError: onSkip,
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
