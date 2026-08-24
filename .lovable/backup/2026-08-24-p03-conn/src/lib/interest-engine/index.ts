/**
 * Interest Engine – zentraler Einstiegspunkt (UI-frei).
 *
 * Client-/Komponentencode importiert die Server Functions aus
 * `@/lib/interest-engine.functions`. Hier liegen Typen, Konfiguration und
 * reine Berechnungslogik, die überall verwendet werden können.
 */

export * from "./types";
export * from "./config";
export * from "./scoring";
