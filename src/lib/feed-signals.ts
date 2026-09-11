/**
 * Gemeinsamer Signalbus des Feed-Kernels.
 *
 * Es gibt genau EINE Warteschlange für die gesamte Anwendung. Jede Interaktion
 * (Like, Kommentar, Teilen, Merken, Folgen, Verweildauer, Melden) legt ihr
 * Signal hier ab; gesendet wird gebündelt über den bereits vorhandenen
 * Server-Pfad `recordFeedSignals`. Dadurch entsteht keine Anfrageflut und die
 * Oberfläche wird nie blockiert – Fehler werden bewusst verschluckt.
 */

import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { recordFeedSignals } from "@/lib/feed.functions";
import type { FeedSignalInput } from "@/lib/feed-ranking";

type Sender = (args: { data: { signals: FeedSignalInput[] } }) => Promise<unknown>;

/** Verzögerung des Bündelns (ms) – identisch zum bisherigen Verhalten. */
const FLUSH_DELAY = 2_500;
/** Serverseitige Obergrenze pro Aufruf (`recordSignals` schneidet bei 50 ab). */
const MAX_BATCH = 50;

let sender: Sender | null = null;
let queue: FeedSignalInput[] = [];
let timer: number | undefined;

function clearTimer() {
  if (timer !== undefined) {
    window.clearTimeout(timer);
    timer = undefined;
  }
}

/** Wartende Signale sofort abschicken (best effort). */
export function flushFeedSignals() {
  clearTimer();
  if (!sender || queue.length === 0) return;
  const signals = queue.slice(0, MAX_BATCH);
  queue = queue.slice(MAX_BATCH);
  void sender({ data: { signals } }).catch(() => undefined);
  // Rest (sehr selten) im nächsten Fenster nachschicken.
  if (queue.length > 0) timer = window.setTimeout(flushFeedSignals, FLUSH_DELAY);
}

/** Ein Signal einreihen. Kein Netzwerkaufruf, keine Blockierung. */
export function trackFeedSignal(input: FeedSignalInput) {
  if (typeof window === "undefined") return;
  queue.push(input);
  // Schutz vor unbegrenztem Wachstum, falls noch kein Sender bereit ist.
  if (queue.length > 200) queue = queue.slice(-200);
  clearTimer();
  timer = window.setTimeout(flushFeedSignals, FLUSH_DELAY);
}

/**
 * Registriert den Server-Pfad einmalig (im Datenprovider). Erst danach werden
 * Signale tatsächlich versendet – vorher warten sie in der Warteschlange.
 */
export function useFeedSignalBridge() {
  const send = useServerFn(recordFeedSignals) as unknown as Sender;
  useEffect(() => {
    sender = send;
    if (queue.length > 0) {
      clearTimer();
      timer = window.setTimeout(flushFeedSignals, FLUSH_DELAY);
    }
    const onHide = () => {
      if (document.visibilityState === "hidden") flushFeedSignals();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushFeedSignals);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushFeedSignals);
      flushFeedSignals();
      if (sender === send) sender = null;
    };
  }, [send]);
}