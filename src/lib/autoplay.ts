import { useSyncExternalStore } from "react";

/**
 * AutoPlay für SlangTags im Live Feed.
 * - Status wird für die Sitzung in sessionStorage gehalten (Standard: AUS).
 * - Es spielt immer nur ein SlangTag gleichzeitig (globaler Audio-Bus).
 * - Kommentare nutzen diesen Bus nicht und werden nie automatisch abgespielt.
 */

const KEY = "ydude:autoplay";

let enabled = (() => {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(KEY) === "1";
})();

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * Aenderungen am Feed-Ton-Schalter abonnieren (z. B. fuer die Videowiedergabe).
 * Gleiche Quelle wie `useAutoPlay` – nur ohne React-Bindung.
 */
export function subscribeAutoPlay(cb: () => void) {
  return subscribe(cb);
}

export function setAutoPlay(next: boolean) {
  enabled = next;
  if (typeof window !== "undefined") window.sessionStorage.setItem(KEY, next ? "1" : "0");
  if (!next) stopAll();
  emit();
}

export function isAutoPlayEnabled() {
  return enabled;
}

export function useAutoPlay() {
  const on = useSyncExternalStore(subscribe, isAutoPlayEnabled, () => false);
  return { autoPlay: on, setAutoPlay, toggleAutoPlay: () => setAutoPlay(!isAutoPlayEnabled()) };
}

/* ---------------- Audio-Cache: erst auf Anforderung laden ---------------- */

/**
 * Audio wird niemals beim Rendern des Feeds geladen, sondern erst beim ersten
 * Abspielen. Einmal geladene Dateien bleiben im Cache (max. 24 Einträge),
 * damit erneutes Abspielen keinen neuen Download auslöst.
 */
const AUDIO_CACHE_LIMIT = 24;
const audioCache = new Map<string, HTMLAudioElement>();

export function getAudio(src: string): HTMLAudioElement {
  const hit = audioCache.get(src);
  if (hit) {
    audioCache.delete(src);
    audioCache.set(src, hit);
    return hit;
  }
  const audio = new Audio();
  audio.preload = "none";
  audio.src = src;
  audioCache.set(src, audio);
  if (audioCache.size > AUDIO_CACHE_LIMIT) {
    const oldest = audioCache.keys().next().value as string | undefined;
    if (oldest && oldest !== src) {
      audioCache.get(oldest)?.pause();
      audioCache.delete(oldest);
    }
  }
  return audio;
}

/* ---------------- Audio-Bus: genau eine Wiedergabe gleichzeitig ---------------- */

let current: { owner: string; audio: HTMLAudioElement; onStop?: () => void } | null = null;

/** Startet ein Audio und stoppt jede laufende Wiedergabe. */
export function playExclusive(owner: string, src: string, onEnded?: () => void) {
  stopAll();
  const audio = getAudio(src);
  audio.onended = () => {
    if (current?.owner === owner) current = null;
    onEnded?.();
  };
  if (audio.currentTime) audio.currentTime = 0;
  current = { owner, audio };
  void audio.play().catch(() => {
    if (current?.owner === owner) current = null;
  });
}

/** Stoppt die Wiedergabe, falls sie von diesem Owner stammt. */
export function stopOwner(owner: string) {
  if (current?.owner === owner) stopAll();
}

export function stopAll() {
  if (!current) return;
  const stop = current.onStop;
  current.audio.pause();
  current.audio.currentTime = 0;
  current = null;
  // Extern gesteuerte Einheiten (SlangShot: Video + SlangTag) mitstoppen.
  stop?.();
}

/**
 * Eine bereits selbst gestartete Wiedergabe im Audio-Bus anmelden
 * (SlangShot: Video ist Master, das Audio laeuft synchron mit).
 * Damit gilt weiterhin: es spielt nur eine Quelle gleichzeitig.
 */
export function claimBus(owner: string, audio: HTMLAudioElement, onStop?: () => void) {
  if (current && current.owner !== owner) stopAll();
  current = { owner, audio, onStop };
}

export function isOwnerPlaying(owner: string) {
  return current?.owner === owner;
}

/**
 * Sichtbarkeitsregel des AutoPlay-Systems (eine Quelle fuer Beitraege und
 * Werbekarten): entweder 60 % der Karte sind sichtbar – oder die Karte ist
 * hoeher als der Viewport und fuellt mindestens die Haelfte davon.
 */
export function isAutoPlayVisible(entry: IntersectionObserverEntry) {
  if (!entry.isIntersecting) return false;
  if (entry.intersectionRatio >= 0.6) return true;
  const rootHeight = entry.rootBounds?.height ?? 0;
  return rootHeight > 0 && entry.intersectionRect.height >= rootHeight * 0.5;
}
