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

/* ---------------- Audio-Bus: genau eine Wiedergabe gleichzeitig ---------------- */

let current: { owner: string; audio: HTMLAudioElement } | null = null;

/** Startet ein Audio und stoppt jede laufende Wiedergabe. */
export function playExclusive(owner: string, src: string, onEnded?: () => void) {
  stopAll();
  const audio = new Audio(src);
  audio.onended = () => {
    if (current?.owner === owner) current = null;
    onEnded?.();
  };
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
  current.audio.pause();
  current.audio.currentTime = 0;
  current = null;
}

export function isOwnerPlaying(owner: string) {
  return current?.owner === owner;
}
