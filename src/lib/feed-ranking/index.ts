/**
 * Feed-Algorithmus 2.0 – öffentlicher Einstiegspunkt (UI- und DB-frei).
 *
 * Client- und Serverschichten importieren ausschließlich von hier, damit
 * einzelne Module später ersetzt werden können, ohne Aufrufer anzupassen.
 */

export * from "./types";
export * from "./config";
export * from "./utils";
export * from "./factors";
export * from "./diversity";
export * from "./engine";
export * from "./learning";
