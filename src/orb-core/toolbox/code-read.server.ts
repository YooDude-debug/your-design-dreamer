/**
 * P21 – begrenzter, rein lesender Zugriff auf den Projekt-Code.
 *
 * Harte Grenzen dieser Datei:
 *  · sie schreibt nichts: kein `writeFile`, kein `mkdir`, kein `rm`,
 *  · sie liest ausschliesslich innerhalb von `CODE_ANALYSIS_SCOPE`,
 *  · sie entfernt mögliche Zugangsdaten aus jedem gelesenen Inhalt,
 *  · sie kennt Obergrenzen für Dateigrösse, Dateizahl und Treffer,
 *  · sie wirft nur `CodeAccessUnavailableError`, wenn überhaupt kein
 *    Dateizugriff existiert – der Aufrufer meldet dann ANALYSIS_UNAVAILABLE.
 */

import { readFile, readdir, stat } from "node:fs/promises";

import {
  CODE_ANALYSIS_DENY_PATTERNS,
  CODE_ANALYSIS_SCOPE,
  normalizeCodeTarget,
  redactSecrets,
} from "@/orb-core/toolbox/code-contract";

export const MAX_FILE_BYTES = 240_000;
export const MAX_DIRECTORY_ENTRIES = 300;
export const MAX_SEARCH_FILES = 600;
export const MAX_SEARCH_MATCHES = 80;
export const MAX_EXCERPT_CHARS = 240;

export class CodeAccessUnavailableError extends Error {
  constructor(message = "Kein Dateizugriff im aktuellen Laufzeitumfeld.") {
    super(message);
    this.name = "CodeAccessUnavailableError";
  }
}

/** Projektwurzel – ausschliesslich das laufende Projekt, kein fremder Pfad. */
function projectRoot(): string {
  const cwd = typeof process !== "undefined" ? process.cwd?.() : undefined;
  if (!cwd) throw new CodeAccessUnavailableError();
  return cwd.replace(/\/+$/, "");
}

function absolute(relPath: string): string {
  return `${projectRoot()}/${relPath}`;
}

function unavailable(error: unknown): never {
  const code = (error as { code?: string } | null)?.code;
  if (code === "ENOENT" || code === "ENOTDIR")
    throw new CodeAccessUnavailableError("Ziel existiert nicht.");
  if (error instanceof CodeAccessUnavailableError) throw error;
  throw new CodeAccessUnavailableError();
}

export type ReadResult =
  | { ok: true; path: string; lines: string[] }
  | { ok: false; reason: string };

/** Eine Datei lesen – maskiert, begrenzt, nur im Lesebereich. */
export async function readCodeFile(target: string): Promise<ReadResult> {
  const scope = normalizeCodeTarget(target);
  if (!scope.ok) return { ok: false, reason: scope.reason };
  try {
    const info = await stat(absolute(scope.path));
    if (!info.isFile()) return { ok: false, reason: "Ziel ist keine Datei." };
    if (info.size > MAX_FILE_BYTES)
      return {
        ok: false,
        reason: `Datei überschreitet die Obergrenze von ${MAX_FILE_BYTES} Byte.`,
      };
    const raw = await readFile(absolute(scope.path), "utf8");
    return { ok: true, path: scope.path, lines: redactSecrets(raw).split("\n") };
  } catch (error) {
    unavailable(error);
  }
}

export type DirectoryEntry = { path: string; kind: "file" | "directory" };

export type ListResult =
  | { ok: true; path: string; entries: DirectoryEntry[] }
  | { ok: false; reason: string };

/** Verzeichnisstruktur lesen (eine Ebene), ausgeschlossene Pfade entfallen. */
export async function listCodeDirectory(target: string): Promise<ListResult> {
  const scope = normalizeCodeTarget(target);
  if (!scope.ok) return { ok: false, reason: scope.reason };
  try {
    const raw = await readdir(absolute(scope.path), { withFileTypes: true });
    const entries: DirectoryEntry[] = [];
    for (const entry of raw) {
      const path = `${scope.path}/${entry.name}`;
      if (CODE_ANALYSIS_DENY_PATTERNS.some((re) => re.test(path))) continue;
      entries.push({ path, kind: entry.isDirectory() ? "directory" : "file" });
      if (entries.length >= MAX_DIRECTORY_ENTRIES) break;
    }
    return { ok: true, path: scope.path, entries };
  } catch (error) {
    unavailable(error);
  }
}

/** Alle lesbaren Dateien unterhalb eines Ziels – mit Obergrenze. */
export async function collectCodeFiles(
  target: string,
  limit = MAX_SEARCH_FILES,
): Promise<string[]> {
  const scope = normalizeCodeTarget(target);
  if (!scope.ok) return [];
  const out: string[] = [];
  const queue: string[] = [scope.path];
  while (queue.length > 0 && out.length < limit) {
    const current = queue.shift() as string;
    let info: Awaited<ReturnType<typeof stat>>;
    try {
      info = await stat(absolute(current));
    } catch {
      continue;
    }
    if (info.isFile()) {
      out.push(current);
      continue;
    }
    const listed = await listCodeDirectory(current);
    if (!listed.ok) continue;
    for (const entry of listed.entries) {
      if (entry.kind === "directory") queue.push(entry.path);
      else if (out.length + queue.length < limit * 4) queue.push(entry.path);
    }
  }
  return out.slice(0, limit);
}

export type CodeMatch = { file: string; line: number; excerpt: string };

/**
 * Textsuche im Lesebereich. Kein Volltextindex, keine Modellsuche: einfache
 * zeilenweise Suche mit harter Obergrenze für Dateien und Treffer.
 */
export async function searchCode(
  pattern: RegExp | string,
  opts?: {
    target?: string;
    maxMatches?: number;
    maxFiles?: number;
    extensions?: readonly string[];
  },
): Promise<CodeMatch[]> {
  const target = opts?.target ?? CODE_ANALYSIS_SCOPE[0];
  const maxMatches = opts?.maxMatches ?? MAX_SEARCH_MATCHES;
  const files = await collectCodeFiles(target, opts?.maxFiles ?? MAX_SEARCH_FILES);
  const exts = opts?.extensions ?? [".ts", ".tsx", ".md", ".sql", ".json", ".css"];
  const re =
    typeof pattern === "string"
      ? new RegExp(escapeRegExp(pattern), "i")
      : new RegExp(pattern.source, pattern.flags.replace("g", ""));
  const matches: CodeMatch[] = [];
  for (const file of files) {
    if (!exts.some((e) => file.endsWith(e))) continue;
    const read = await readCodeFile(file);
    if (!read.ok) continue;
    for (let i = 0; i < read.lines.length; i += 1) {
      const line = read.lines[i] ?? "";
      if (!re.test(line)) continue;
      matches.push({ file, line: i + 1, excerpt: excerpt(line) });
      if (matches.length >= maxMatches) return matches;
    }
  }
  return matches;
}

/** Referenzen verfolgen: wer importiert ein Modul? */
export async function findImporters(modulePath: string, target = "src"): Promise<CodeMatch[]> {
  const base = modulePath.replace(/^src\//, "@/").replace(/\.(ts|tsx)$/, "");
  const name = base.split("/").pop() ?? base;
  return searchCode(new RegExp(`from\\s+["'][^"']*${escapeRegExp(name)}["']`), {
    target,
    maxMatches: MAX_SEARCH_MATCHES,
  });
}

export function excerpt(line: string): string {
  const clean = redactSecrets(line).trim();
  return clean.length > MAX_EXCERPT_CHARS ? `${clean.slice(0, MAX_EXCERPT_CHARS)}…` : clean;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Nächstliegender Funktions-/Symbolname oberhalb einer Zeile (1-basiert). */
export function symbolAt(lines: readonly string[], line: number): string | null {
  for (let i = Math.min(line, lines.length) - 1; i >= 0; i -= 1) {
    const m =
      /^\s*(?:export\s+)?(?:async\s+)?(?:function|const|class|type|interface)\s+([A-Za-z0-9_$]+)/.exec(
        lines[i] ?? "",
      );
    if (m) return m[1] ?? null;
  }
  return null;
}
