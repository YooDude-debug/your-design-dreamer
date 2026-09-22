/**
 * Kernpräsenz des ORB – clientseitiger Leerlauf-Beobachter.
 *
 * Der Takt läuft ausschliesslich im Browser (ein Intervall von 5 Sekunden,
 * reine Rechenarbeit). Es gibt kein Server-Polling und keine Datenbankabfrage
 * pro Takt: erst wenn alle Bedingungen erfüllt sind, wird genau EIN Aufruf
 * ausgelöst. Die Entscheidung selbst liegt in `shouldAskProactively`.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  PROACTIVE_COOLDOWN_MS,
  curiosityBand,
  shouldAskProactively,
  type ProactiveDimension,
} from "@/orb-sdk";

/** Takt des Beobachters – bewusst grob, rein clientseitig. */
export const PRESENCE_TICK_MS = 5000;

type Options = {
  /** Bestehender Zustandswert `curiosity` aus dem ORB-Snapshot. */
  curiosity: number;
  typing: boolean;
  speaking: boolean;
  listening: boolean;
  pending: boolean;
  /** Erst aktiv, wenn der Snapshot geladen ist. */
  enabled: boolean;
  /** Löst die einzelne kontrollierte ORB-Anfrage aus. */
  onAsk: () => void;
};

export type PresenceStatus = {
  idleMs: number;
  reason: string;
  cooldownMs: number;
};

/**
 * Nachvollziehbarkeit der Browser-Vorfilter: welcher Filter hat verhindert,
 * dass überhaupt ein Serveraufruf entstand. Bewusst nur im Arbeitsspeicher und
 * nur bei einer ÄNDERUNG des Grundes – kein Logging je Takt.
 */
export type PresenceFilterEntry = { at: number; reason: string; idleMs: number };

/** Obergrenze des Verlaufs – verhindert unbegrenztes Wachstum. */
export const PRESENCE_FILTER_LOG_MAX = 20;

/**
 * Fügt einen Vorfilter-Grund hinzu – aber nur, wenn er sich vom letzten Eintrag
 * unterscheidet. Damit entsteht kein Eintrag je 5-Sekunden-Takt.
 */
export function appendFilterEntry(
  log: PresenceFilterEntry[],
  entry: PresenceFilterEntry,
): PresenceFilterEntry[] {
  const last = log[log.length - 1];
  if (last && last.reason === entry.reason) return log;
  return [...log, entry].slice(-PRESENCE_FILTER_LOG_MAX);
}

export function useOrbPresence(options: Options): {
  status: PresenceStatus;
  /** Bei jeder Benutzeraktivität aufrufen (Eingabe, Senden, Sprache). */
  noteActivity: () => void;
  /** Nach einer gestellten Frage: Cooldown starten. */
  noteProactive: (entry?: { topic: string | null; dimension: ProactiveDimension | null }) => void;
  /** Bereits gestellte proaktive Fragen (Thema + Dimension). */
  asked: { topic: string; dimension: ProactiveDimension }[];
  /** Nicht ausgeführte Serveraufrufe samt auslösendem Vorfilter. */
  filterLog: PresenceFilterEntry[];
} {
  const { curiosity, typing, speaking, listening, pending, enabled, onAsk } = options;

  const lastActivityRef = useRef(Date.now());
  const lastProactiveRef = useRef<number | null>(null);
  const [asked, setAsked] = useState<{ topic: string; dimension: ProactiveDimension }[]>([]);
  const [status, setStatus] = useState<PresenceStatus>({
    idleMs: 0,
    reason: "Beobachtung noch nicht gestartet.",
    cooldownMs: 0,
  });

  const noteActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    // Eine Benutzereingabe beendet den Cooldown.
    lastProactiveRef.current = null;
  }, []);

  const noteProactive = useCallback(
    (entry?: { topic: string | null; dimension: ProactiveDimension | null }) => {
      lastProactiveRef.current = Date.now();
      lastActivityRef.current = Date.now();
      if (entry?.topic && entry.dimension) {
        const next = { topic: entry.topic, dimension: entry.dimension };
        setAsked((prev) =>
          prev.some((a) => a.topic === next.topic && a.dimension === next.dimension)
            ? prev
            : [...prev, next],
        );
      }
    },
    [],
  );

  // Tippen, Senden, Sprache und Tabwechsel setzen die Leerlaufzeit zurück.
  useEffect(() => {
    if (typing || speaking || listening || pending) lastActivityRef.current = Date.now();
  }, [typing, speaking, listening, pending]);

  useEffect(() => {
    const onVisible = () => {
      // Rückkehr zum Tab: Leerlauf wird neu bewertet, nicht nachträglich gefragt.
      if (document.visibilityState === "visible") lastActivityRef.current = Date.now();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      const verdict = shouldAskProactively({
        idleMs: now - lastActivityRef.current,
        curiosity,
        typing,
        speaking,
        listening,
        pending,
        tabVisible: document.visibilityState === "visible",
        hasCandidate: true, // endgültige Prüfung erfolgt serverseitig am Gedächtnis
        lastProactiveAt: lastProactiveRef.current,
        now,
      });
      const cooldown =
        lastProactiveRef.current === null
          ? 0
          : Math.max(
              0,
              PROACTIVE_COOLDOWN_MS[curiosityBand(curiosity)] - (now - lastProactiveRef.current),
            );
      setStatus({
        idleMs: now - lastActivityRef.current,
        reason: verdict.reason,
        cooldownMs: cooldown,
      });
      if (verdict.ask) {
        // Sofort sperren, damit kein zweiter Aufruf entsteht.
        lastProactiveRef.current = now;
        onAsk();
      }
    }, PRESENCE_TICK_MS);
    return () => window.clearInterval(timer);
  }, [enabled, curiosity, typing, speaking, listening, pending, onAsk]);

  return { status, noteActivity, noteProactive, asked };
}
