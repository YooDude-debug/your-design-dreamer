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

let current: { owner: string; audio: HTMLAudioElement } | null = null;
/** Laufende Sequenz (mehrere SlangTags nacheinander) */
let sequence: { owner: string; timer: ReturnType<typeof setTimeout> | null } | null = null;

/** Kurzer, natürlicher Übergang zwischen zwei SlangTags. */
const GAP_MS = 260;

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

/**
 * Spielt mehrere SlangTags in der übergebenen Reihenfolge nacheinander ab.
 * Nach dem letzten Eintrag endet die Wiedergabe automatisch.
 */
export function playSequence(
  owner: string,
  sources: string[],
  hooks?: { onStart?: (index: number) => void; onEnd?: () => void },
) {
  stopAll();
  const list = sources.filter(Boolean);
  if (!list.length) return;
  sequence = { owner, timer: null };

  const step = (i: number) => {
    if (sequence?.owner !== owner) return;
    if (i >= list.length) {
      sequence = null;
      hooks?.onEnd?.();
      return;
    }
    hooks?.onStart?.(i);
    const audio = getAudio(list[i]!);
    audio.onended = () => {
      if (sequence?.owner !== owner) return;
      if (current?.owner === owner) current = null;
      sequence.timer = setTimeout(() => step(i + 1), GAP_MS);
    };
    if (audio.currentTime) audio.currentTime = 0;
    current = { owner, audio };
    void audio.play().catch(() => {
      if (sequence?.owner === owner) {
        sequence = null;
        hooks?.onEnd?.();
      }
    });
  };

  step(0);
}

/** Stoppt die Wiedergabe, falls sie von diesem Owner stammt. */
export function stopOwner(owner: string) {
  if (current?.owner === owner || sequence?.owner === owner) stopAll();
}

export function stopAll() {
  if (sequence?.timer) clearTimeout(sequence.timer);
  sequence = null;
  if (!current) return;
  current.audio.pause();
  current.audio.currentTime = 0;
  current = null;
}

export function isOwnerPlaying(owner: string) {
  return current?.owner === owner || sequence?.owner === owner;
}

