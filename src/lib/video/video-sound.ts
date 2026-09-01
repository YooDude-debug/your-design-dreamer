/**
 * Ton-Praeferenz fuer Feed-Videos.
 *
 * EINZIGE Quelle ist der bereits vorhandene Feed-Ton-Schalter oben rechts im
 * Feed (`useAutoPlay` / `ydude:autoplay`, sitzungsbezogen). Es gibt hier keine
 * zweite Einstellung und keine eigene Persistenz:
 *
 *   Schalter AUS → Feed-Videos starten stumm
 *   Schalter AN  → Feed-Videos versuchen, mit Ton zu starten
 *
 * Zusaetzlich darf der Nutzer den Ton direkt an der nativen Videosteuerung
 * aendern. Das gilt als kurzlebige Ausnahme fuer die laufende Feed-Sitzung
 * (`override`, nur im Speicher) und wird verworfen, sobald der Feed-Schalter
 * wieder bedient wird – der Schalter bleibt also die globale Einstellung.
 *
 * Hintergrund (Browser-Autoplay-Policies):
 * Chrome, Safari/iOS, Firefox und Edge erlauben automatisches Starten eines
 * Videos ohne Nutzergeste nur stumm. `play()` mit Ton ohne Geste wird mit
 * `NotAllowedError` abgelehnt – eine Browserregel, die nicht umgangen wird.
 * Deshalb wird Ton nur *versucht*, wenn der Schalter AN ist UND eine echte
 * Nutzergeste vorlag; lehnt der Browser ab, laeuft das Video stumm weiter.
 */

import { isAutoPlayEnabled, subscribeAutoPlay } from "@/lib/autoplay";

/** Kurzlebige Ausnahme durch die native Videosteuerung (kein Speicher). */
let override: boolean | null = null;

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

/** Aktuelle Ton-Praeferenz: Feed-Schalter, ggf. mit manueller Ausnahme. */
export function isVideoSoundPreferred() {
  return override ?? isAutoPlayEnabled();
}

/**
 * Nutzer hat den Ton direkt am Video geaendert. Gilt als Ausnahme, bis der
 * Feed-Ton-Schalter das naechste Mal bedient wird.
 */
export function noteManualSoundChange(muted: boolean) {
  override = !muted;
  markGesture();
}

/**
 * Aenderungen der Ton-Praeferenz abonnieren. Ein Umschalten des Feed-Schalters
 * ist immer eine echte Nutzeraktion (Klick/Tap auf den Regler) und setzt die
 * manuelle Ausnahme zurueck.
 */
export function subscribeVideoSound(cb: () => void) {
  return subscribeAutoPlay(() => {
    override = null;
    markGesture();
    cb();
  });
}

/**
 * Darf ein automatisch startendes Video mit Ton versuchen zu starten?
 * Nur mit aktiver Ton-Praeferenz UND vorheriger echter Nutzergeste.
 */
export function mayAutoplayWithSound() {
  return isVideoSoundPreferred() && gestureSeen;
}

/** Nur fuer Tests. */
export function __resetVideoSound() {
  override = null;
  gestureSeen = false;
}

/** Nur fuer Tests: Geste setzen, um den Praeferenzpfad zu pruefen. */
export function __setUserGestureForTests(v: boolean) {
  gestureSeen = v;
}
