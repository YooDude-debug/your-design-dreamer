/**
 * Slang Globe – Jahreslogik (Sprach-Jahrgänge).
 *
 * Jeder Kalenderjahrgang ist ein eigener dokumentierter Datensatz. Die Logik
 * ist bewusst rein datumsbasiert und benötigt keine jährliche Codeanpassung:
 * das aktive Jahr ergibt sich immer aus der aktuellen Zeit, ältere Jahre
 * bleiben als Archiv erhalten.
 */

import { useEffect, useState } from "react";

/** Erstes dokumentiertes Slang-Jahr (Start des Globe-Archivs). */
export const GLOBE_FIRST_YEAR = 2025;

/** Aktuelles Slang-Jahr (Kalenderjahr der lokalen Zeit). */
export function currentSlangYear(now: number = Date.now()): number {
  return new Date(now).getFullYear();
}

/** Ende eines Slang-Jahres: 31.12., 23:59:59.999 (lokale Zeit). */
export function slangYearEnd(year: number): number {
  return new Date(year, 11, 31, 23, 59, 59, 999).getTime();
}

/** Start eines Slang-Jahres: 01.01., 00:00:00. */
export function slangYearStart(year: number): number {
  return new Date(year, 0, 1, 0, 0, 0, 0).getTime();
}

/** Verbleibende Millisekunden bis zum Jahresende (nie negativ). */
export function msUntilYearEnd(now: number = Date.now()): number {
  return Math.max(0, slangYearEnd(currentSlangYear(now)) - now);
}

/**
 * Fortschritt des laufenden Jahres (0…1). Wird genutzt, damit der Globe im
 * neuen Jahr bei 0 startet und die Jahresstatistik über das Jahr wächst.
 */
export function slangYearProgress(year: number, now: number = Date.now()): number {
  const active = currentSlangYear(now);
  if (year < active) return 1;
  if (year > active) return 0;
  const start = slangYearStart(year);
  const end = slangYearEnd(year);
  return Math.min(1, Math.max(0, (now - start) / (end - start)));
}

/** Alle auswählbaren Jahre – neuestes zuerst. */
export function availableSlangYears(now: number = Date.now()): number[] {
  const active = currentSlangYear(now);
  const years: number[] = [];
  for (let y = active; y >= GLOBE_FIRST_YEAR; y -= 1) years.push(y);
  return years;
}

export type SlangCountdown = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
};

export function countdownParts(ms: number): SlangCountdown {
  const total = Math.max(0, ms);
  const seconds = Math.floor(total / 1000);
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
    totalMs: total,
  };
}

/**
 * Live-Countdown bis zum Jahresende inklusive automatischem Jahreswechsel.
 * Um 0:00 wechselt `activeYear` von selbst auf das neue Kalenderjahr.
 */
export function useSlangYearClock() {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const stamp = now ?? slangYearStart(GLOBE_FIRST_YEAR);
  return {
    /** Erst nach dem ersten Client-Tick verfügbar (keine Hydration-Differenz). */
    ready: now !== null,
    activeYear: now === null ? null : currentSlangYear(now),
    countdown: countdownParts(now === null ? 0 : msUntilYearEnd(now)),
    years: now === null ? [] : availableSlangYears(stamp),
  };
}
