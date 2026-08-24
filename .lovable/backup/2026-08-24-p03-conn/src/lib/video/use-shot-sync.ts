/**
 * SlangShot-Wiedergabe: Video + SlangTag-Audio als eine Einheit.
 *
 * Grundsatz: das Video ist die Master-Zeitquelle. Das SlangTag-Audio bleibt
 * eine separate Datei (bestehendes Datenmodell) und wird niemals unabhaengig
 * gestartet. Erst wenn beide Medien abspielbereit sind, startet die Einheit –
 * beide bei Zeitposition 0 und im selben Tick.
 *
 * Diese Datei ergaenzt nur die Wiedergabe. Aufnahme, VAD, SlangTag-Erstellung
 * und -Speicherung bleiben unveraendert.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { getAudio } from "@/lib/autoplay";

/**
 * Ab dieser Abweichung wird das Audio sanft (per Abspielrate) an die Videozeit
 * gezogen. Ein Sprung per currentTime erzeugt hoerbare Aussetzer und wird nur
 * bei grober Abweichung genutzt.
 */
const DRIFT_TOLERANCE = 0.12;
/** Ab hier ist ein harter Sprung unvermeidlich. */
const DRIFT_HARD = 0.4;
/** Abgleichintervall waehrend der Wiedergabe (guenstig fuer Mobile). */
const DRIFT_INTERVAL_MS = 500;
/** Notausgang, falls ein Medium nie "canplaythrough" meldet. */
const READY_TIMEOUT_MS = 8000;

export type ShotSyncStatus = "idle" | "preparing" | "ready" | "playing" | "paused";

function waitReady(el: HTMLMediaElement, min = 3): Promise<void> {
  if (el.readyState >= min) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.removeEventListener("canplay", finish);
      el.removeEventListener("canplaythrough", finish);
      el.removeEventListener("loadeddata", onData);
      clearTimeout(timer);
      resolve();
    };
    const onData = () => {
      if (el.readyState >= min) finish();
    };
    el.addEventListener("canplay", finish);
    el.addEventListener("canplaythrough", finish);
    el.addEventListener("loadeddata", onData);
    const timer = setTimeout(finish, READY_TIMEOUT_MS);
    // Nur laden, wenn noch keine Daten vorliegen – sonst wuerde ein erneuter
    // load() den bereits gepufferten Stream verwerfen (Netzwerk + Stocken).
    if (el.readyState === 0) {
      try {
        el.load();
      } catch {
        /* bereits geladen */
      }
    }
  });
}

type Options = {
  /** Quelle des SlangTag-Audios. Fehlt sie, ist der SlangShot nicht bereit. */
  audioSrc?: string | null;
  /** Video-Quelle (nur zur Erkennung von Wechseln). */
  videoSrc?: string | null;
  /** true, solange der SlangTag noch erzeugt/gespeichert wird. */
  processing?: boolean;
  /** Wiedergabe beim Ende des Videos beenden (Vorschau) statt zu wiederholen. */
  loop?: boolean;
};

export function useShotSync({ audioSrc, videoSrc, processing = false, loop = false }: Options) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState<ShotSyncStatus>("idle");
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const driftTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startToken = useRef(0);

  const stopDrift = () => {
    if (driftTimer.current) clearInterval(driftTimer.current);
    driftTimer.current = null;
  };

  /** Audio-Element passend zur Quelle bereitstellen (Cache wird genutzt). */
  const audioFor = useCallback((src: string) => {
    const el = getAudio(src);
    if (audioRef.current && audioRef.current !== el) audioRef.current.pause();
    el.preload = "auto";
    el.loop = false;
    audioRef.current = el;
    // Stabile Referenz fuer die bestehende SlangTag-Wellenform (kein neuer
    // Animations-Code): sie liest currentTime direkt von diesem Element.
    setAudioEl((prev) => (prev === el ? prev : el));
    return el;
  }, []);

  /** Beide Medien vorbereiten; danach ist die Einheit abspielbereit. */
  useEffect(() => {
    stopDrift();
    setStatus("idle");
    if (!videoSrc) return;
    if (processing || !audioSrc) {
      setStatus("preparing");
      return;
    }
    let alive = true;
    setStatus("preparing");
    const audio = audioFor(audioSrc);
    // Beide Medien frueh vorbereiten, damit beim Play kein Request mehr faellt.
    const video0 = videoRef.current;
    if (video0 && video0.preload !== "auto") video0.preload = "auto";
    const prepare = async () => {
      await waitReady(audio, 3);
      const video = videoRef.current;
      if (video) await waitReady(video, 3);
      if (!alive) return;
      setStatus("ready");
    };
    void prepare();
    return () => {
      alive = false;
      stopDrift();
      audio.pause();
      videoRef.current?.pause();
    };
  }, [audioSrc, videoSrc, processing, audioFor]);

  const startDrift = useCallback(() => {
    stopDrift();
    driftTimer.current = setInterval(() => {
      const video = videoRef.current;
      const audio = audioRef.current;
      if (!video || !audio || video.paused) return;
      // Audio darf nie geloopt, gestreckt oder verlaengert werden: ist es zu
      // Ende, laeuft nur das Video weiter.
      if (audio.ended || audio.paused) return;
      // Video ist Master: Audio nur bei merkbarer Abweichung nachziehen.
      const diff = audio.currentTime - video.currentTime;
      const dur = audio.duration;
      if (Number.isFinite(dur) && video.currentTime >= dur - 0.02) {
        audio.playbackRate = 1;
        audio.pause();
        return;
      }
      const abs = Math.abs(diff);
      if (abs > DRIFT_HARD) {
        audio.playbackRate = 1;
        audio.currentTime = video.currentTime;
      } else if (abs > DRIFT_TOLERANCE) {
        // Sanfte Korrektur ohne Seek: minimal schneller/langsamer abspielen.
        audio.playbackRate = diff > 0 ? 0.97 : 1.03;
      } else if (audio.playbackRate !== 1) {
        audio.playbackRate = 1;
      }
    }, DRIFT_INTERVAL_MS);
  }, []);

  /** Gemeinsamer Start bei Position 0 – erst wenn beide Medien bereit sind. */
  const play = useCallback(
    async (fromStart = true) => {
      const video = videoRef.current;
      if (!video || !audioSrc || processing) return;
      const token = (startToken.current += 1);
      const audio = audioFor(audioSrc);
      if (status !== "playing") setStatus((s) => (s === "paused" ? s : "preparing"));
      await Promise.all([waitReady(audio, 3), waitReady(video, 3)]);
      if (token !== startToken.current) return;
      const dur = audio.duration;
      // Audio ist beim Fortsetzen ggf. schon vorbei – dann laeuft nur das Video.
      const audioDone =
        !fromStart && Number.isFinite(dur) && video.currentTime >= (dur as number) - 0.02;
      audio.playbackRate = 1;
      if (fromStart) {
        if (video.currentTime !== 0) video.currentTime = 0;
        if (audio.currentTime !== 0) audio.currentTime = 0;
      } else if (!audioDone) {
        audio.currentTime = video.currentTime;
      }
      // Beide im selben Tick starten – identischer Startzeitpunkt.
      const started = await Promise.allSettled(
        audioDone ? [video.play()] : [video.play(), audio.play()],
      );
      if (token !== startToken.current) return;
      if (started.some((r) => r.status === "rejected")) {
        video.pause();
        audio.pause();
        setStatus("ready");
        return;
      }
      setStatus("playing");
      startDrift();
    },
    [audioSrc, audioFor, processing, startDrift, status],
  );

  const pause = useCallback(() => {
    startToken.current += 1;
    stopDrift();
    videoRef.current?.pause();
    if (audioRef.current) {
      audioRef.current.playbackRate = 1;
      audioRef.current.pause();
    }
    setStatus((s) => (s === "playing" ? "paused" : s));
  }, []);

  const resume = useCallback(() => void play(false), [play]);

  const restart = useCallback(() => void play(true), [play]);

  const toggle = useCallback(() => {
    if (status === "playing") pause();
    else if (status === "paused") void play(false);
    else void play(true);
  }, [status, pause, play]);

  /** Videoende (ohne Loop): Einheit gemeinsam beenden. */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onEnded = () => {
      if (loop) return;
      stopDrift();
      if (audioRef.current) {
        audioRef.current.playbackRate = 1;
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      video.currentTime = 0;
      setStatus("ready");
    };
    video.addEventListener("ended", onEnded);
    return () => video.removeEventListener("ended", onEnded);
  }, [loop, videoSrc]);

  useEffect(() => () => stopDrift(), []);

  return {
    videoRef,
    /** Aktives Audio-Element (zum Anmelden im globalen Audio-Bus). */
    audioRef,
    /** Aktives Audio-Element als State (fuer die SlangTag-Wellenform). */
    audio: audioEl,
    status,
    /** Nur wahr, wenn Video und SlangTag-Audio gemeinsam startbereit sind. */
    ready: status === "ready" || status === "playing" || status === "paused",
    preparing: status === "preparing",
    playing: status === "playing",
    play: restart,
    resume,
    pause,
    restart,
    toggle,
  };
}
