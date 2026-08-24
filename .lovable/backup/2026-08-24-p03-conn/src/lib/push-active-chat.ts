/**
 * Meldet dem Push-Worker, in welchem Chat der Nutzer gerade aktiv ist.
 *
 * Zweck: Eine neue Nachricht soll KEINE System-Push erzeugen, solange der
 * Empfaenger genau diese Unterhaltung sichtbar geoeffnet hat. Alles andere
 * (App im Feed, App im Hintergrund, App geschlossen) bleibt unveraendert und
 * erhaelt weiterhin eine Push.
 *
 * Umsetzung: Der Messenger meldet die aktive Unterhaltung per `postMessage` an
 * den Service Worker und haelt die Meldung mit einem kurzen Herzschlag frisch.
 * Faellt die Meldung aus (Worker neu gestartet, Tab im Hintergrund, App
 * geschlossen), verfaellt sie automatisch – dann wird wieder gepusht.
 */

import { useEffect } from "react";

/** Abstand der Frischhalte-Meldungen. Muss kleiner sein als ACTIVE_CHAT_TTL_MS im Worker. */
const HEARTBEAT_MS = 15_000;

function post(message: unknown) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  void navigator.serviceWorker
    .getRegistration("/push-sw.js")
    .then((reg) => {
      const target = reg?.active ?? navigator.serviceWorker.controller;
      target?.postMessage(message);
    })
    .catch(() => undefined);
}

/** Aktive Unterhaltung melden (oder mit `null` abmelden). */
export function reportActiveChat(conversationId: string | null) {
  post({ type: "active-chat", conversationId });
}

/**
 * Haelt die Meldung fuer die uebergebene Unterhaltung aktuell, solange die
 * Seite sichtbar ist. `null` bedeutet: kein Chat offen.
 */
export function useActiveChatReporter(conversationId: string | null) {
  useEffect(() => {
    if (!conversationId) {
      reportActiveChat(null);
      return;
    }

    const send = () => {
      // Nur melden, wenn der Chat tatsaechlich sichtbar ist.
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        reportActiveChat(null);
        return;
      }
      reportActiveChat(conversationId);
    };

    send();
    const timer = setInterval(send, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", send);
    window.addEventListener("pagehide", () => reportActiveChat(null));

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", send);
      reportActiveChat(null);
    };
  }, [conversationId]);
}
