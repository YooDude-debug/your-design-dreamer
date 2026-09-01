/**
 * Ton-Praeferenz fuer Feed-Videos.
 *
 * Hintergrund (Browser-Autoplay-Policies):
 * Chrome, Safari/iOS, Firefox und Edge erlauben automatisches Starten eines
 * Videos ohne Nutzergeste nur, wenn es stumm ist. Ein `play()` mit Ton ohne
 * vorherige Geste wird vom Browser mit `NotAllowedError` abgelehnt – das ist
 * eine Sicherheits-/UX-Regel des Browsers und laesst sich nicht umgehen.
 *
 * Deshalb gilt hier:
 *  - Standard: automatischer Start immer stumm.
 *  - Schaltet der Nutzer den Ton bewusst ein (native Videosteuerung), wird das
 *    als Praeferenz fuer die Sitzung gespeichert.
 *  - Fuer nachfolgende Videos wird dann *versucht*, mit Ton zu starten. Lehnt
 *    der Browser ab, faellt die Wiedergabe automatisch auf stumm zurueck –
 *    ohne Trick, ohne simulierte Interaktion.
 */

const KEY = "ydude:videosound";

let preferred = (() => {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
})();

/** Wurde in dieser Sitzung schon echt interagiert (Voraussetzung fuer Ton)? */
let gestureSeen = false;
let gestureBound = false;

function markGesture() {
  gestureSeen = true;
}

/** Passive, einmalige Erfassung einer echten Nutzergeste (kein Simulieren). */
export function trackUserGesture() {
  if (gestureBound || typeof window === "undefined") return;
  gestureBound = true;
  const opts = { passive: true, capture: true } as AddEventListenerOptions;
  window.addEventListener("pointerdown", markGesture, opts);
  window.addEventListener("touchstart", markGesture, opts);
  window.addEventListener("keydown", markGesture, opts);
}

export function hasUserGesture() {
  return gestureSeen;
}

export function isVideoSoundPreferred() {
  return preferred;
}

export function setVideoSoundPreferred(next: boolean) {
  preferred = next;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    /* Storage nicht verfuegbar (Private Mode) – Praeferenz gilt nur im Speicher. */
  }
}

/**
 * Darf ein automatisch startendes Video mit Ton versuchen zu starten?
 * Nur mit gespeicherter Nutzerpraeferenz UND vorheriger echter Nutzergeste.
 */
export function mayAutoplayWithSound() {
  return preferred && gestureSeen;
}

/** Nur fuer Tests. */
export function __resetVideoSound() {
  preferred = false;
  gestureSeen = false;
}

/** Nur fuer Tests: Geste simulieren, um den Praeferenzpfad zu pruefen. */
export function __setUserGestureForTests(v: boolean) {
  gestureSeen = v;
}
